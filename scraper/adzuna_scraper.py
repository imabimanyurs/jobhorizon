"""
Adzuna API Integration — searches jobs across India, US, UK.
API docs: https://developer.adzuna.com/overview
"""
import time
import random
import httpx
from datetime import datetime
from typing import Optional

from config import (
    ADZUNA_APP_ID,
    ADZUNA_APP_KEY,
    INCLUDE_KEYWORDS,
    EXCLUDE_KEYWORDS,
    SCORING,
    USER_AGENT,
    FAANG_COMPANIES,
    ADZUNA_QUERIES,
)
from db import init_db, insert_jobs_batch
from salary_parser import parse_salary
from location_parser import parse_location
from perks_detector import detect_perks


ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"


def search_adzuna(
    client: httpx.Client,
    what: str,
    where: str = "",
    country: str = "in",
    page: int = 1,
    results_per_page: int = 50,
) -> list[dict]:
    """
    Search Adzuna API for jobs.
    country: 'in' (India), 'us' (US), 'gb' (UK), 'ca' (Canada), etc.
    """
    url = f"{ADZUNA_BASE}/{country}/search/{page}"
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": what,
        "results_per_page": results_per_page,
        "content-type": "application/json",
        "sort_by": "date",
    }
    if where:
        params["where"] = where

    try:
        resp = client.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            print(f"  [ADZ] HTTP {resp.status_code} for: {what} in {country}", flush=True)
            return []

        data = resp.json()
        return data.get("results", [])

    except Exception as e:
        print(f"  [ADZ] Error: {e}", flush=True)
        return []


def extract_job_from_adzuna(result: dict) -> Optional[dict]:
    """Extract a job record from an Adzuna API result."""
    title = result.get("title", "")
    company_data = result.get("company", {})
    company = company_data.get("display_name", "") if isinstance(company_data, dict) else ""
    location_data = result.get("location", {})

    # Build location string
    location_parts: list[str] = []
    if isinstance(location_data, dict):
        for area in location_data.get("area", []):
            if area:
                location_parts.append(str(area))
        display_name = location_data.get("display_name", "")
        if display_name and not location_parts:
            location_parts.append(str(display_name))
    location = ", ".join(location_parts) if location_parts else ""

    url = result.get("redirect_url", "") or result.get("adref", "")
    if not title or not url:
        return None

    # Clean HTML from title
    import re
    title = re.sub(r"<[^>]+>", "", title).strip()

    # Check exclusions
    title_lower = title.lower()
    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return None

    # Score
    score = calc_adzuna_score(title, location, company)
    if score == 0:
        return None

    # Parse location + salary
    loc_data = parse_location(location)

    # Adzuna provides salary data directly
    salary_min = result.get("salary_min")
    salary_max = result.get("salary_max")
    sal_data = {"salary_min_lpa": None, "salary_max_lpa": None, "salary_currency": ""}

    if salary_min is not None or salary_max is not None:
        # Adzuna India returns INR annual; US returns USD annual
        country_code = loc_data.get("country", "")
        if country_code == "IN" or loc_data.get("is_india"):
            if salary_min:
                sal_data["salary_min_lpa"] = round(float(salary_min) / 100000, 2)
            if salary_max:
                sal_data["salary_max_lpa"] = round(float(salary_max) / 100000, 2)
            sal_data["salary_currency"] = "INR"
        elif country_code == "US":
            from config import USD_TO_INR
            if salary_min:
                sal_data["salary_min_lpa"] = round(float(salary_min) * USD_TO_INR / 100000, 2)
            if salary_max:
                sal_data["salary_max_lpa"] = round(float(salary_max) * USD_TO_INR / 100000, 2)
            sal_data["salary_currency"] = "USD"
        elif country_code == "GB":
            from config import USD_TO_INR
            GBP_TO_INR = 106.0
            if salary_min:
                sal_data["salary_min_lpa"] = round(float(salary_min) * GBP_TO_INR / 100000, 2)
            if salary_max:
                sal_data["salary_max_lpa"] = round(float(salary_max) * GBP_TO_INR / 100000, 2)
            sal_data["salary_currency"] = "GBP"
        else:
            # Fallback: try raw salary parser
            salary_text = result.get("salary_is_predicted", "")
            parsed = parse_salary(str(salary_min or "") + " " + str(salary_max or ""))
            sal_data = parsed

    # Posted date
    created = result.get("created", "")
    posted_date = created[:10] if created else ""

    # Detect perks from description
    description = result.get("description", "") or ""
    perks_text = f"{title} {description}"
    perks = detect_perks(perks_text)

    return {
        "title": title,
        "company": company,
        "location": loc_data.get("location_raw", location),
        "remote": loc_data.get("is_remote", False),
        "apply_url": url,
        "source": "adzuna",
        "posted_date": posted_date,
        "match_score": score,
        "country": loc_data.get("country", ""),
        "state": loc_data.get("state", ""),
        "city": loc_data.get("city", ""),
        "is_india": loc_data.get("is_india", False),
        "salary_min_lpa": sal_data.get("salary_min_lpa"),
        "salary_max_lpa": sal_data.get("salary_max_lpa"),
        "salary_currency": sal_data.get("salary_currency", ""),
        "source_type": "ADZUNA",
        "visa_sponsored": perks["visa_sponsored"],
        "has_equity": perks["has_equity"],
    }


def calc_adzuna_score(title: str, location: str, company: str) -> int:
    """Calculate match score for an Adzuna result."""
    title_lower = title.lower()
    combined = f"{title_lower} {location.lower()}"

    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return 0

    score = 0
    for kw in SCORING["high_match"]:
        if kw in title_lower:
            score = max(score, SCORING["high_score"])
            break

    if score == 0:
        for kw in SCORING["medium_match"]:
            if kw in title_lower:
                score = max(score, SCORING["medium_score"])
                break

    if score == 0:
        for kw in SCORING["low_match"]:
            if kw in title_lower:
                score = max(score, SCORING["low_score"])
                break

    if score == 0:
        matched = any(kw in title_lower for kw in INCLUDE_KEYWORDS)
        if not matched:
            return 0
        score = 40

    # Bonuses
    if any(t in combined for t in ["remote", "wfh", "work from home"]):
        score += SCORING["remote_bonus"]

    company_lower = company.lower()
    if any(f in company_lower for f in FAANG_COMPANIES):
        score += SCORING.get("faang_bonus", 10)

    return min(score, 100)


def run_adzuna_scraper() -> None:
    """Run Adzuna API job search."""
    print(f"\n{'='*60}", flush=True)
    print(f"[ADZ] Adzuna Job Search - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        print("  [!] Adzuna credentials not set. Skipping.", flush=True)
        return

    init_db()
    all_jobs: list[dict] = []

    client = httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )

    queries = ADZUNA_QUERIES
    print(f"  Running {len(queries)} Adzuna queries...\n", flush=True)

    for i, q in enumerate(queries, 1):
        what = q["what"]
        where = q.get("where", "")
        country = q.get("country", "in")

        label = f"{what} in {where or country.upper()}"
        print(f"  [{i}/{len(queries)}] {label}...", end=" ", flush=True)

        results = search_adzuna(client, what=what, where=where, country=country)
        jobs_found = 0

        for r in results:
            job = extract_job_from_adzuna(r)
            if job:
                all_jobs.append(job)
                jobs_found += 1

        print(f"-> {len(results)} results, {jobs_found} jobs", flush=True)

        # Polite delay
        time.sleep(random.uniform(0.5, 1.0))

    client.close()

    # Insert
    new_count = insert_jobs_batch(all_jobs)

    print(f"\n{'='*60}", flush=True)
    print(f"[OK] Adzuna Done!", flush=True)
    print(f"   Total extracted: {len(all_jobs)}", flush=True)
    print(f"   New jobs added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {len(all_jobs) - new_count}", flush=True)
    print(f"{'='*60}\n", flush=True)


if __name__ == "__main__":
    run_adzuna_scraper()
