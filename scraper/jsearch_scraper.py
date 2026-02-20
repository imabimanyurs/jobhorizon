"""
JSearch API Integration (via RapidAPI) — broad job discovery across multiple boards.
API docs: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
"""
import time
import random
import re
import httpx
from datetime import datetime
from typing import Optional

from config import (
    JSEARCH_API_KEY,
    INCLUDE_KEYWORDS,
    EXCLUDE_KEYWORDS,
    SCORING,
    USER_AGENT,
    FAANG_COMPANIES,
    JSEARCH_QUERIES,
    USD_TO_INR,
)
from db import init_db, insert_jobs_batch
from salary_parser import parse_salary
from location_parser import parse_location
from perks_detector import detect_perks


JSEARCH_BASE = "https://jsearch.p.rapidapi.com/search"

# ─── Currency conversion (from config) ────────────────────────
try:
    from config import USD_TO_INR
except ImportError:
    USD_TO_INR = 85.0
GBP_TO_INR = 106.0
EUR_TO_INR = 91.0
CAD_TO_INR = 62.0


def search_jsearch(
    client: httpx.Client,
    query: str,
    country: str = "us",
    page: int = 1,
    num_pages: int = 1,
    date_posted: str = "week",
    remote_only: bool = False,
) -> list[dict]:
    """
    Search JSearch API for jobs.
    date_posted: 'all', 'today', '3days', 'week', 'month'
    """
    params: dict[str, str | int | bool] = {
        "query": query,
        "page": page,
        "num_pages": num_pages,
        "country": country,
        "date_posted": date_posted,
    }
    if remote_only:
        params["remote_jobs_only"] = True

    headers = {
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
        "x-rapidapi-key": JSEARCH_API_KEY,
    }

    try:
        resp = client.get(JSEARCH_BASE, params=params, headers=headers, timeout=20)
        if resp.status_code == 429:
            print("  [JS] Rate limited — waiting 5s...", flush=True)
            time.sleep(5)
            return []
        if resp.status_code != 200:
            print(f"  [JS] HTTP {resp.status_code} for: {query}", flush=True)
            return []

        data = resp.json()
        if data.get("status") != "OK":
            print(f"  [JS] API error: {data.get('status')}", flush=True)
            return []

        return data.get("data", [])

    except Exception as e:
        print(f"  [JS] Error: {e}", flush=True)
        return []


def _convert_salary_to_lpa(
    min_sal: Optional[float],
    max_sal: Optional[float],
    currency: Optional[str],
    period: Optional[str],
) -> dict:
    """Convert JSearch salary fields to LPA (Lakhs Per Annum)."""
    result: dict = {
        "salary_min_lpa": None,
        "salary_max_lpa": None,
        "salary_currency": currency or "",
    }

    if min_sal is None and max_sal is None:
        return result

    # Annualize based on period
    multiplier = 1.0  # default: YEAR
    if period == "MONTH":
        multiplier = 12.0
    elif period == "HOUR":
        multiplier = 2080.0  # 40h * 52w
    elif period == "WEEK":
        multiplier = 52.0
    elif period == "DAY":
        multiplier = 260.0  # 5d * 52w

    # Currency conversion to INR
    cur = (currency or "USD").upper()
    rate_map = {
        "USD": USD_TO_INR,
        "INR": 1.0,
        "GBP": GBP_TO_INR,
        "EUR": EUR_TO_INR,
        "CAD": CAD_TO_INR,
    }
    rate = rate_map.get(cur, USD_TO_INR)

    if min_sal is not None:
        annual_inr = float(min_sal) * multiplier * rate
        result["salary_min_lpa"] = round(annual_inr / 100000, 2)
    if max_sal is not None:
        annual_inr = float(max_sal) * multiplier * rate
        result["salary_max_lpa"] = round(annual_inr / 100000, 2)

    result["salary_currency"] = cur
    return result


def extract_job_from_jsearch(result: dict) -> Optional[dict]:
    """Extract a normalized job record from a JSearch API result."""
    title = result.get("job_title", "") or ""
    company = result.get("employer_name", "") or ""
    apply_url = result.get("job_apply_link", "") or ""

    if not title or not apply_url:
        return None

    # Clean HTML entities from title
    title = re.sub(r"<[^>]+>", "", title).strip()

    # Check exclusions
    title_lower = title.lower()
    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return None

    # Score
    location_str = result.get("job_location", "") or ""
    score = calc_jsearch_score(title, location_str, company, result.get("job_is_remote", False) or False)
    if score == 0:
        return None

    # Location from API (JSearch provides structured data)
    city = result.get("job_city", "") or ""
    state = result.get("job_state", "") or ""
    country_code = (result.get("job_country", "") or "").upper()
    is_remote = result.get("job_is_remote", False) or False
    is_india = country_code == "IN"

    # Also run our location parser for richer data
    loc_data = parse_location(location_str)
    if not city and loc_data.get("city"):
        city = loc_data["city"]
    if not state and loc_data.get("state"):
        state = loc_data["state"]
    if not country_code and loc_data.get("country"):
        country_code = loc_data["country"]
    if loc_data.get("is_india"):
        is_india = True
    if loc_data.get("is_remote"):
        is_remote = True

    # Salary — JSearch provides native salary data
    sal_data = _convert_salary_to_lpa(
        result.get("job_min_salary"),
        result.get("job_max_salary"),
        result.get("job_salary_currency"),
        result.get("job_salary_period"),
    )

    # If no native salary, try parsing from description highlights
    if sal_data["salary_min_lpa"] is None and sal_data["salary_max_lpa"] is None:
        highlights = result.get("job_highlights", {})
        if isinstance(highlights, dict):
            benefits = highlights.get("Benefits", [])
            for b in benefits:
                if isinstance(b, str) and ("$" in b or "salary" in b.lower() or "lpa" in b.lower()):
                    parsed = parse_salary(b)
                    if parsed.get("salary_min_lpa") is not None:
                        sal_data = parsed
                        break

    # Posted date
    posted_utc = result.get("job_posted_at_datetime_utc", "")
    posted_date = posted_utc[:10] if posted_utc else ""

    # Perks detection from title + description
    description = result.get("job_description", "") or ""
    highlights = result.get("job_highlights", {})
    benefits_text = ""
    if isinstance(highlights, dict):
        for b in highlights.get("Benefits", []):
            if isinstance(b, str):
                benefits_text += " " + b
    perks_text = f"{title} {description[:500]} {benefits_text}"
    perks = detect_perks(perks_text)

    return {
        "title": title,
        "company": company,
        "location": location_str,
        "remote": is_remote,
        "apply_url": apply_url,
        "source": "jsearch",
        "posted_date": posted_date,
        "match_score": score,
        "country": country_code,
        "state": state,
        "city": city,
        "is_india": is_india,
        "salary_min_lpa": sal_data.get("salary_min_lpa"),
        "salary_max_lpa": sal_data.get("salary_max_lpa"),
        "salary_currency": sal_data.get("salary_currency", ""),
        "source_type": "JSEARCH",
        "visa_sponsored": perks["visa_sponsored"],
        "has_equity": perks["has_equity"],
    }


def calc_jsearch_score(title: str, location: str, company: str, is_remote: bool = False) -> int:
    """Calculate match score for a JSearch result."""
    title_lower = (title or "").lower()
    combined = f"{title_lower} {(location or '').lower()}"

    # Exclude check
    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return 0

    # Score based on keyword tiers
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
    if is_remote or any(t in combined for t in ["remote", "wfh", "work from home"]):
        score += SCORING["remote_bonus"]

    company_lower = (company or "").lower()
    if any(f in company_lower for f in FAANG_COMPANIES):
        score += SCORING.get("faang_bonus", 10)

    return min(score, 100)


def run_jsearch_scraper() -> None:
    """Run JSearch API job search across configured queries."""
    print(f"\n{'='*60}", flush=True)
    print(f"[JS] JSearch Job Search - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    if not JSEARCH_API_KEY:
        print("  [!] JSearch API key not set. Skipping.", flush=True)
        return

    init_db()
    all_jobs: list[dict] = []

    client = httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )

    queries = JSEARCH_QUERIES
    print(f"  Running {len(queries)} JSearch queries...\n", flush=True)

    for i, q in enumerate(queries, 1):
        query_text = q["query"]
        country = q.get("country", "us")
        date_posted = q.get("date_posted", "week")
        remote_only = q.get("remote_only", False)
        num_pages = q.get("num_pages", 1)
        label = q.get("label", query_text[:40])

        print(f"  [{i}/{len(queries)}] {label}...", end=" ", flush=True)

        results = search_jsearch(
            client,
            query=query_text,
            country=country,
            date_posted=date_posted,
            remote_only=remote_only,
            num_pages=num_pages,
        )
        jobs_found = 0

        for r in results:
            job = extract_job_from_jsearch(r)
            if job:
                all_jobs.append(job)
                jobs_found += 1

        print(f"-> {len(results)} results, {jobs_found} jobs", flush=True)

        # Polite delay — RapidAPI has rate limits
        time.sleep(random.uniform(1.0, 2.0))

    client.close()

    # Insert
    new_count = insert_jobs_batch(all_jobs)

    print(f"\n{'='*60}", flush=True)
    print(f"[OK] JSearch Done!", flush=True)
    print(f"   Total extracted: {len(all_jobs)}", flush=True)
    print(f"   New jobs added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {len(all_jobs) - new_count}", flush=True)
    print(f"{'='*60}\n", flush=True)


if __name__ == "__main__":
    run_jsearch_scraper()
