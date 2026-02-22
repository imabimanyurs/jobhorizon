"""
Ashby Job Board API Integration — scrapes public Ashby job boards.
API: https://api.ashbyhq.com/posting-api/job-board/{company}
Free, no auth required. Returns JSON with all published job postings.
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
    ASHBY_COMPANIES,
)
from db import init_db, insert_jobs_batch
from salary_parser import parse_salary
from location_parser import parse_location
from perks_detector import detect_perks

ASHBY_API_BASE = "https://api.ashbyhq.com/posting-api/job-board"


def fetch_ashby_board(client: httpx.Client, company: str) -> list[dict]:
    """Fetch all jobs from an Ashby company job board."""
    url = f"{ASHBY_API_BASE}/{company}?includeCompensation=true"
    try:
        resp = client.get(url, timeout=15)
        if resp.status_code != 200:
            return []

        data = resp.json()
        # Ashby returns { jobs: [...] }
        jobs = data.get("jobs", [])
        if isinstance(jobs, list):
            return jobs
        return []
    except Exception as e:
        print(f"  [ASH] {company}: Error - {e}", flush=True)
        return []


def extract_job_from_ashby(result: dict, board_company: str) -> Optional[dict]:
    """Extract a normalized job record from an Ashby API result."""
    # Ashby fields: id, title, location, department, team,
    #               compensation, employmentType, publishedAt,
    #               externalLink, jobUrl, isRemote, descriptionHtml/Plain
    title = result.get("title", "")
    if not title:
        return None

    # Company name from info or fallback to board name
    company = board_company.replace("-", " ").title()
    # Some Ashby responses have organizationName at root level
    if result.get("organizationName"):
        company = result["organizationName"]

    # Location
    location = result.get("location", "") or ""
    if isinstance(location, dict):
        location = location.get("name", "") or ""

    # Is remote
    is_remote = result.get("isRemote", False)
    if isinstance(is_remote, str):
        is_remote = is_remote.lower() in ("true", "yes")

    # Check for remote indicators in location
    if not is_remote:
        loc_lower = (location or "").lower()
        if any(t in loc_lower for t in ["remote", "anywhere", "wfh", "work from home"]):
            is_remote = True

    # Apply URL
    apply_url = result.get("jobUrl", "") or result.get("externalLink", "")
    if not apply_url:
        job_id = result.get("id", "")
        if job_id:
            apply_url = f"https://jobs.ashbyhq.com/{board_company}/{job_id}"
    if not apply_url:
        return None

    # Clean title
    title = re.sub(r"<[^>]+>", "", title).strip()

    # Check exclusions
    title_lower = title.lower()
    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return None

    # Score
    score = calc_ashby_score(title, location, company, is_remote)
    if score == 0:
        return None

    # Parse location
    loc_data = parse_location(location)

    # Compensation from Ashby
    sal_data = {"salary_min_lpa": None, "salary_max_lpa": None, "salary_currency": ""}
    compensation = result.get("compensation", {}) or result.get("compensationTierSummary", "")

    if isinstance(compensation, dict):
        # Some Ashby responses have structured compensation
        comp_min = compensation.get("min") or compensation.get("salaryMin")
        comp_max = compensation.get("max") or compensation.get("salaryMax")
        currency = compensation.get("currency", "USD")
        period = compensation.get("period", "year")

        sal_data = _convert_compensation(comp_min, comp_max, currency, period)
    elif isinstance(compensation, str) and compensation:
        # Try parsing from text
        parsed = parse_salary(compensation)
        if parsed.get("salary_min_lpa"):
            sal_data = parsed

    # Also try the compensationTierSummary field
    comp_summary = result.get("compensationTierSummary", "")
    if not sal_data["salary_min_lpa"] and comp_summary:
        parsed = parse_salary(str(comp_summary))
        if parsed.get("salary_min_lpa"):
            sal_data = parsed

    # Posted date
    published = result.get("publishedAt", "") or result.get("updatedAt", "")
    posted_date = ""
    if published:
        try:
            posted_date = published[:10]
        except Exception:
            posted_date = ""

    # Detect perks from description
    description = result.get("descriptionPlain", "") or result.get("descriptionHtml", "") or ""
    # Strip HTML if needed
    description = re.sub(r"<[^>]+>", " ", description)
    perks_text = f"{title} {description[:1000]} {location}"
    perks = detect_perks(perks_text)

    # Department info for context
    department = result.get("department", "")
    if isinstance(department, dict):
        department = department.get("name", "")

    return {
        "title": title,
        "company": company,
        "location": loc_data.get("location_raw", location) or "",
        "remote": is_remote,
        "apply_url": apply_url,
        "source": "ashby",
        "posted_date": posted_date,
        "match_score": score,
        "country": loc_data.get("country", ""),
        "state": loc_data.get("state", ""),
        "city": loc_data.get("city", ""),
        "is_india": loc_data.get("is_india", False),
        "salary_min_lpa": sal_data.get("salary_min_lpa"),
        "salary_max_lpa": sal_data.get("salary_max_lpa"),
        "salary_currency": sal_data.get("salary_currency", ""),
        "source_type": "ASHBY",
        "visa_sponsored": perks["visa_sponsored"],
        "has_equity": perks["has_equity"],
    }


def _convert_compensation(
    min_val: Optional[float],
    max_val: Optional[float],
    currency: str = "USD",
    period: str = "year",
) -> dict:
    """Convert Ashby compensation to LPA."""
    try:
        from config import USD_TO_INR
    except ImportError:
        USD_TO_INR = 83.5

    GBP_TO_INR = 106.0
    EUR_TO_INR = 91.0
    CAD_TO_INR = 62.0

    currency = (currency or "USD").upper()
    period = (period or "year").lower()

    # Determine conversion factor
    rate_map = {
        "USD": USD_TO_INR,
        "GBP": GBP_TO_INR,
        "EUR": EUR_TO_INR,
        "CAD": CAD_TO_INR,
        "INR": 1.0,
    }
    rate = rate_map.get(currency, USD_TO_INR)

    # Annualize if needed
    period_multiplier = 1.0
    if "hour" in period:
        period_multiplier = 2080  # ~40 hrs/week * 52 weeks
    elif "month" in period:
        period_multiplier = 12
    elif "week" in period:
        period_multiplier = 52

    result = {"salary_min_lpa": None, "salary_max_lpa": None, "salary_currency": currency}

    if min_val is not None:
        try:
            annual = float(min_val) * period_multiplier
            result["salary_min_lpa"] = round(annual * rate / 100000, 2)
        except (ValueError, TypeError):
            pass

    if max_val is not None:
        try:
            annual = float(max_val) * period_multiplier
            result["salary_max_lpa"] = round(annual * rate / 100000, 2)
        except (ValueError, TypeError):
            pass

    return result


def calc_ashby_score(title: str, location: str, company: str, is_remote: bool = False) -> int:
    """Calculate match score for an Ashby result."""
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

    # Remote bonus
    if is_remote or any(t in combined for t in ["remote", "wfh", "work from home", "anywhere"]):
        score += SCORING["remote_bonus"]

    # FAANG bonus
    company_lower = company.lower()
    if any(f in company_lower for f in FAANG_COMPANIES):
        score += SCORING.get("faang_bonus", 10)

    return min(score, 100)


def run_ashby_scraper() -> None:
    """Run Ashby job board scraper across configured companies."""
    print(f"\n{'='*60}", flush=True)
    print(f"[ASH] Ashby Job Board Scraper - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    init_db()
    all_jobs: list[dict] = []

    client = httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )

    companies = ASHBY_COMPANIES
    print(f"  Scraping {len(companies)} Ashby boards...\n", flush=True)

    for i, company in enumerate(companies, 1):
        print(f"  [{i}/{len(companies)}] {company}...", end=" ", flush=True)
        results = fetch_ashby_board(client, company)
        jobs_found = 0

        for r in results:
            job = extract_job_from_ashby(r, company)
            if job:
                all_jobs.append(job)
                jobs_found += 1

        print(f"-> {len(results)} postings, {jobs_found} matches", flush=True)

        # Polite delay between requests
        time.sleep(random.uniform(0.3, 0.8))

    client.close()

    # Insert
    new_count = insert_jobs_batch(all_jobs)

    print(f"\n{'='*60}", flush=True)
    print(f"[OK] Ashby Done!", flush=True)
    print(f"   Total extracted: {len(all_jobs)}", flush=True)
    print(f"   New jobs added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {len(all_jobs) - new_count}", flush=True)
    print(f"{'='*60}\n", flush=True)


if __name__ == "__main__":
    run_ashby_scraper()
