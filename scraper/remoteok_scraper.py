"""
Remote OK API Integration — fetches remote-only jobs.
API: https://remoteok.com/api (free, no auth required)
Returns JSON array of remote job listings.
"""
import time
import random
import re
import httpx
from datetime import datetime
from typing import Optional

from config import (
    INCLUDE_KEYWORDS,
    EXCLUDE_KEYWORDS,
    SCORING,
    USER_AGENT,
    FAANG_COMPANIES,
)
from db import init_db, insert_jobs_batch
from salary_parser import parse_salary
from location_parser import parse_location
from perks_detector import detect_perks

REMOTEOK_API_URL = "https://remoteok.com/api"


def fetch_remoteok_jobs(client: httpx.Client) -> list[dict]:
    """Fetch all jobs from Remote OK API."""
    try:
        resp = client.get(
            REMOTEOK_API_URL,
            timeout=30,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
        )
        if resp.status_code != 200:
            print(f"  [ROK] HTTP {resp.status_code}", flush=True)
            return []

        data = resp.json()
        # First element is metadata/legal notice, skip it
        if isinstance(data, list) and len(data) > 1:
            return data[1:]
        return []
    except Exception as e:
        print(f"  [ROK] Error fetching: {e}", flush=True)
        return []


def extract_job_from_remoteok(result: dict) -> Optional[dict]:
    """Extract a normalized job record from a Remote OK API result."""
    # Remote OK fields: id, epoch, date, company, position, tags, logo,
    #                   description, location, salary_min, salary_max, url, slug
    title = result.get("position", "")
    company = result.get("company", "")
    location = result.get("location", "Worldwide (Remote)")
    url = result.get("url", "")
    slug = result.get("slug", "")

    if not title or (not url and not slug):
        return None

    # Build apply URL
    if not url:
        url = f"https://remoteok.com/remote-jobs/{slug}" if slug else ""
    if not url:
        return None

    # Clean HTML from title/company
    title = re.sub(r"<[^>]+>", "", title).strip()
    company = re.sub(r"<[^>]+>", "", company).strip()

    # Check exclusions
    title_lower = title.lower()
    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return None

    # Score
    score = calc_remoteok_score(title, location, company)
    if score == 0:
        return None

    # Parse location
    loc_data = parse_location(location)

    # Salary from Remote OK (provides annual USD)
    salary_min = result.get("salary_min")
    salary_max = result.get("salary_max")
    sal_data = {"salary_min_lpa": None, "salary_max_lpa": None, "salary_currency": ""}

    try:
        from config import USD_TO_INR
    except ImportError:
        USD_TO_INR = 83.5

    if salary_min and str(salary_min).strip():
        try:
            sal_min_f = float(salary_min)
            if sal_min_f > 0:
                sal_data["salary_min_lpa"] = round(sal_min_f * USD_TO_INR / 100000, 2)
                sal_data["salary_currency"] = "USD"
        except (ValueError, TypeError):
            pass

    if salary_max and str(salary_max).strip():
        try:
            sal_max_f = float(salary_max)
            if sal_max_f > 0:
                sal_data["salary_max_lpa"] = round(sal_max_f * USD_TO_INR / 100000, 2)
                sal_data["salary_currency"] = "USD"
        except (ValueError, TypeError):
            pass

    # If no salary from API, try parsing from description
    if not sal_data["salary_min_lpa"]:
        description = result.get("description", "") or ""
        parsed_sal = parse_salary(f"{title} {description[:500]}")
        if parsed_sal.get("salary_min_lpa"):
            sal_data = parsed_sal

    # Posted date
    date_str = result.get("date", "")
    posted_date = ""
    if date_str:
        try:
            # Remote OK returns ISO format: "2026-02-22T12:00:00+00:00"
            posted_date = date_str[:10]
        except Exception:
            posted_date = ""

    # Tags for extra context
    tags = result.get("tags", [])
    tags_str = ", ".join(tags) if isinstance(tags, list) else ""

    # Detect perks
    description = result.get("description", "") or ""
    perks_text = f"{title} {description[:1000]} {tags_str}"
    perks = detect_perks(perks_text)

    return {
        "title": title,
        "company": company,
        "location": loc_data.get("location_raw", location) or "Remote",
        "remote": True,  # All Remote OK jobs are remote
        "apply_url": url,
        "source": "remoteok",
        "posted_date": posted_date,
        "match_score": score,
        "country": loc_data.get("country", ""),
        "state": loc_data.get("state", ""),
        "city": loc_data.get("city", ""),
        "is_india": loc_data.get("is_india", False),
        "salary_min_lpa": sal_data.get("salary_min_lpa"),
        "salary_max_lpa": sal_data.get("salary_max_lpa"),
        "salary_currency": sal_data.get("salary_currency", ""),
        "source_type": "REMOTEOK",
        "visa_sponsored": perks["visa_sponsored"],
        "has_equity": perks["has_equity"],
    }


def calc_remoteok_score(title: str, location: str, company: str) -> int:
    """Calculate match score for a Remote OK result."""
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

    # All Remote OK jobs are remote, so always add bonus
    score += SCORING["remote_bonus"]

    # FAANG bonus
    company_lower = company.lower()
    if any(f in company_lower for f in FAANG_COMPANIES):
        score += SCORING.get("faang_bonus", 10)

    return min(score, 100)


def run_remoteok_scraper() -> None:
    """Run Remote OK API job fetch."""
    print(f"\n{'='*60}", flush=True)
    print(f"[ROK] Remote OK Job Fetch - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    init_db()
    all_jobs: list[dict] = []

    client = httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )

    print("  Fetching Remote OK API...", end=" ", flush=True)
    results = fetch_remoteok_jobs(client)
    print(f"-> {len(results)} listings", flush=True)

    for r in results:
        job = extract_job_from_remoteok(r)
        if job:
            all_jobs.append(job)

    client.close()

    # Insert
    new_count = insert_jobs_batch(all_jobs)

    print(f"\n{'='*60}", flush=True)
    print(f"[OK] Remote OK Done!", flush=True)
    print(f"   Total extracted: {len(all_jobs)}", flush=True)
    print(f"   New jobs added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {len(all_jobs) - new_count}", flush=True)
    print(f"{'='*60}\n", flush=True)


if __name__ == "__main__":
    run_remoteok_scraper()
