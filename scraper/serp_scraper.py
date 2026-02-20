"""
SerpAPI Google Dorking Integration — discovers jobs via site-restricted Google searches.
Uses targeted queries against ATS domains for high-quality results.
Auto-discovers new company slugs and expands companies.json permanently.
"""
import json
import time
import random
import re
import httpx
from datetime import datetime, timedelta
from typing import Optional

# Max age for collected jobs (in days)
MAX_AGE_DAYS = 30

from config import (
    SERPAPI_KEY,
    SERP_QUERIES,
    INCLUDE_KEYWORDS,
    EXCLUDE_KEYWORDS,
    SCORING,
    USER_AGENT,
    COMPANIES_FILE,
    FAANG_COMPANIES,
)
from db import init_db, insert_jobs_batch
from salary_parser import parse_salary
from location_parser import parse_location
from perks_detector import detect_perks


SERPAPI_URL = "https://serpapi.com/search.json"


def build_queries() -> list[dict]:
    """Build all SerpAPI queries from config."""
    return SERP_QUERIES


def search_serpapi(
    client: httpx.Client, query: str, freshness: str = "qdr:w", num: int = 40
) -> list[dict]:
    """
    Search Google via SerpAPI.
    freshness: qdr:d (day), qdr:w (week), qdr:m (month)
    """
    params = {
        "engine": "google",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": num,
        "tbs": freshness,
    }

    try:
        resp = client.get(SERPAPI_URL, params=params, timeout=20)
        if resp.status_code != 200:
            print(f"  [SERP] HTTP {resp.status_code} for: {query[:60]}", flush=True)
            return []

        data = resp.json()

        if "error" in data:
            print(f"  [SERP] API Error: {data['error']}", flush=True)
            return []

        results = data.get("organic_results", [])
        return results

    except Exception as e:
        print(f"  [SERP] Error: {e}", flush=True)
        return []


# ─── Auto-discovery: extract company slugs from URLs ──────────

def extract_slug_from_url(url: str) -> Optional[tuple[str, str]]:
    """
    Extract (platform, slug) from a job board URL.
    Returns ('greenhouse', 'company-slug') or ('lever', 'company-slug') or None.
    """
    gh_match = re.search(r"boards\.greenhouse\.io/([a-z0-9_-]+)", url, re.I)
    if gh_match:
        slug = gh_match.group(1).lower()
        # Skip generic pages
        if slug not in {"embed", "include", "api", "v1"}:
            return ("greenhouse", slug)

    lv_match = re.search(r"jobs\.lever\.co/([a-z0-9_-]+)", url, re.I)
    if lv_match:
        slug = lv_match.group(1).lower()
        if slug not in {"embed", "include", "api"}:
            return ("lever", slug)

    return None


def expand_companies_json(discovered: dict[str, set[str]]) -> int:
    """
    Add newly discovered company slugs to companies.json permanently.
    Returns number of new companies added.
    """
    try:
        with open(COMPANIES_FILE, "r") as f:
            companies = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        companies = {"greenhouse": [], "lever": []}

    added = 0
    for platform in ["greenhouse", "lever"]:
        existing = set(companies.get(platform, []))
        new_slugs = discovered.get(platform, set()) - existing
        if new_slugs:
            companies[platform] = sorted(existing | new_slugs)
            added += len(new_slugs)
            for slug in sorted(new_slugs):
                print(f"  [+] Discovered new {platform} company: {slug}", flush=True)

    if added > 0:
        with open(COMPANIES_FILE, "w") as f:
            json.dump(companies, f, indent=2)
        print(f"  [OK] Added {added} new companies to companies.json", flush=True)

    return added


def parse_result_date(date_str: str) -> Optional[datetime]:
    """
    Parse date from SerpAPI result. Handles:
    - ISO dates: '2026-02-15', '2026-02-15T10:00:00'
    - Relative dates: '3 days ago', '2 weeks ago', '1 month ago', '5 hours ago'
    - Text dates: 'Feb 15, 2026'
    Returns None if unparseable.
    """
    if not date_str:
        return None

    date_str = date_str.strip()

    # Handle relative dates ("X days/hours/weeks ago")
    rel_match = re.match(r"(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago", date_str, re.I)
    if rel_match:
        amount = int(rel_match.group(1))
        unit = rel_match.group(2).lower()
        delta_map = {
            "second": timedelta(seconds=amount),
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
            "month": timedelta(days=amount * 30),
            "year": timedelta(days=amount * 365),
        }
        delta = delta_map.get(unit)
        if delta:
            return datetime.now() - delta
        return None

    # Try common date formats
    for fmt in ["%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%b %d, %Y", "%B %d, %Y", "%d %b %Y", "%d %B %Y"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    return None


def extract_job_from_result(result: dict, query_meta: dict) -> Optional[dict]:
    """Extract a job record from a SerpAPI organic result."""
    title = result.get("title", "")
    link = result.get("link", "")
    snippet = result.get("snippet", "")
    displayed_link = result.get("displayed_link", "")

    # ── Date freshness check: skip anything older than MAX_AGE_DAYS ──
    raw_date = result.get("date", "")
    parsed_date = parse_result_date(raw_date)
    if parsed_date:
        age = (datetime.now() - parsed_date).days
        if age > MAX_AGE_DAYS:
            return None

    if not title or not link:
        return None

    # Skip non-job domains (aggregators, reviews, salary sites, forums)
    noise_domains = [
        "glassdoor.com", "payscale.com", "ambitionbox.com", "naukri.com",
        "quora.com", "reddit.com", "medium.com", "youtube.com",
        "linkedin.com/pulse", "linkedin.com/posts",
        "ziprecruiter.com", "salary.com", "comparably.com",
        "careerbliss.com", "kununu.com", "teamblind.com",
    ]
    link_lower = link.lower()
    for domain in noise_domains:
        if domain in link_lower:
            return None

    # Skip non-job pages based on title
    skip_patterns = [
        "blog", "about", "career page", "company culture", "press", "news",
        "top companies", "highest paying", "salary guide", "salary report",
        "interview questions", "how to", "career advice", "salary comparison",
        "best jobs", "review", "ratings", "salaries at", "salary for",
        "jobs in 2025", "jobs in 2026", "average salary", "pay scale",
        "career path", "job market", "hiring trends", "job outlook",
    ]
    title_lower = title.lower()
    for p in skip_patterns:
        if p in title_lower and "engineer" not in title_lower and "developer" not in title_lower:
            return None

    # Extra: skip listicle-style titles (e.g., "6331 react js developer jobs...")
    if re.match(r"^\d{2,}", title_lower.strip()):
        return None

    # Check exclusions
    for kw in EXCLUDE_KEYWORDS:
        if kw in title_lower:
            return None

    # Extract company from URL
    company = ""
    gh_match = re.search(r"boards\.greenhouse\.io/([^/]+)", link)
    if gh_match:
        company = gh_match.group(1).replace("-", " ").title()

    lv_match = re.search(r"jobs\.lever\.co/([^/]+)", link)
    if lv_match:
        company = lv_match.group(1).replace("-", " ").title()

    wb_match = re.search(r"apply\.workable\.com/([^/]+)", link)
    if wb_match:
        company = wb_match.group(1).replace("-", " ").title()

    # Try "Role at Company" pattern from title
    if not company:
        at_match = re.search(r"(?:at|@)\s+(.+?)(?:\s*[-|]|$)", title, re.I)
        if at_match:
            company = at_match.group(1).strip()

    if not company:
        company = displayed_link.split("/")[0] if displayed_link else "Unknown"

    # Clean title
    clean_title = re.sub(r"\s*[-|–]\s*.+$", "", title).strip()
    if not clean_title:
        clean_title = title

    # Extract location from snippet
    location = ""
    loc_match = re.search(r"(?:Location|Office|Based in)[:\s]+([^.;]+)", snippet, re.I)
    if loc_match:
        location = loc_match.group(1).strip()

    # Parse location + salary
    loc_data = parse_location(location or snippet[:100])
    sal_data = parse_salary(snippet)

    # Score
    score = calc_serp_score(clean_title, snippet, loc_data, sal_data, company)
    if score == 0:
        return None

    # Determine source
    source = "serp"
    if "greenhouse" in link:
        source = "serp_greenhouse"
    elif "lever" in link:
        source = "serp_lever"
    elif "workable" in link:
        source = "serp_workable"
    elif "indeed" in link:
        source = "serp_indeed"
    elif "adzuna" in link:
        source = "serp_adzuna"
    # Detect perks
    combined_text = f"{clean_title} {snippet}"
    perks = detect_perks(combined_text)

    return {
        "title": clean_title,
        "company": company,
        "location": loc_data.get("location_raw", location),
        "remote": loc_data.get("is_remote", False),
        "apply_url": link,
        "source": source,
        "posted_date": result.get("date", ""),
        "match_score": score,
        "country": loc_data.get("country", ""),
        "state": loc_data.get("state", ""),
        "city": loc_data.get("city", ""),
        "is_india": loc_data.get("is_india", False),
        "salary_min_lpa": sal_data.get("salary_min_lpa"),
        "salary_max_lpa": sal_data.get("salary_max_lpa"),
        "salary_currency": sal_data.get("salary_currency", ""),
        "source_type": "SERP",
        "visa_sponsored": perks["visa_sponsored"],
        "has_equity": perks["has_equity"],
    }


def calc_serp_score(
    title: str, snippet: str, loc: dict, sal: dict, company: str = ""
) -> int:
    """Calculate match score for a SerpAPI result."""
    title_lower = title.lower()
    combined = f"{title_lower} {snippet.lower()}"

    # Exclusion check
    for kw in EXCLUDE_KEYWORDS:
        if kw in combined:
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
        matched = any(kw in combined for kw in INCLUDE_KEYWORDS)
        if not matched:
            return 0
        score = 40

    # Bonuses
    if loc.get("is_remote"):
        score += SCORING["remote_bonus"]
    if sal.get("salary_min_lpa") and sal["salary_min_lpa"] >= 20:
        score += 5
    if loc.get("is_india"):
        score += 5
    # FAANG bonus
    company_lower = company.lower()
    if any(f in company_lower for f in FAANG_COMPANIES):
        score += SCORING.get("faang_bonus", 10)

    return min(score, 100)


def run_serp_scraper() -> None:
    """Run SerpAPI-based job discovery + auto-expand companies.json."""
    print(f"\n{'='*60}", flush=True)
    print(f"[SERP] SerpAPI Job Discovery - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    if not SERPAPI_KEY:
        print("  [!] SERPAPI_KEY not set. Skipping SerpAPI scraping.", flush=True)
        return

    init_db()
    all_jobs: list[dict] = []
    discovered_companies: dict[str, set[str]] = {"greenhouse": set(), "lever": set()}
    queries = build_queries()

    client = httpx.Client(
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    )

    print(f"  Running {len(queries)} search queries...\n", flush=True)

    for i, q in enumerate(queries, 1):
        query_str = q["query"]
        freshness = q.get("freshness", "qdr:w")
        label = q.get("label", query_str[:50])
        should_discover = q.get("discover", False)

        print(f"  [{i}/{len(queries)}] {label}...", end=" ", flush=True)

        results = search_serpapi(client, query_str, freshness=freshness)
        jobs_found = 0

        for r in results:
            job = extract_job_from_result(r, q)
            if job:
                all_jobs.append(job)
                jobs_found += 1

            # Auto-discover new company slugs
            if should_discover:
                link = r.get("link", "")
                slug_info = extract_slug_from_url(link)
                if slug_info:
                    platform, slug = slug_info
                    discovered_companies[platform].add(slug)

        print(f"-> {len(results)} results, {jobs_found} jobs", flush=True)

        # Polite delay between SerpAPI calls
        time.sleep(random.uniform(1.0, 2.0))

    client.close()

    # Auto-expand companies.json with discovered slugs
    if any(discovered_companies.values()):
        print(f"\n[DISCOVER] Checking for new company slugs...", flush=True)
        new_added = expand_companies_json(discovered_companies)
        if new_added == 0:
            print("  No new companies discovered (all already known).", flush=True)

    # Insert jobs
    new_count = insert_jobs_batch(all_jobs)

    print(f"\n{'='*60}", flush=True)
    print(f"[OK] SerpAPI Done!", flush=True)
    print(f"   Total extracted: {len(all_jobs)}", flush=True)
    print(f"   New jobs added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {len(all_jobs) - new_count}", flush=True)
    print(f"{'='*60}\n", flush=True)


if __name__ == "__main__":
    run_serp_scraper()
