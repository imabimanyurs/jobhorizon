"""
Job Scraper — Greenhouse + Lever boards + SerpAPI + Adzuna.
Runs once daily. Scrapes curated company list + Google dork queries + Adzuna API.
"""
import json
import time
import random
import httpx
from datetime import datetime

from config import (
    COMPANIES_FILE,
    INCLUDE_KEYWORDS,
    EXCLUDE_KEYWORDS,
    SCORING,
    REQUEST_DELAY_MIN,
    REQUEST_DELAY_MAX,
    REQUEST_TIMEOUT,
    USER_AGENT,
    FAANG_COMPANIES,
)
from db import init_db, insert_jobs_batch
from salary_parser import parse_salary
from location_parser import parse_location
from perks_detector import detect_perks


def load_companies() -> dict:
    with open(COMPANIES_FILE, "r") as f:
        return json.load(f)


def calc_match_score(title: str, location: str = "", company: str = "") -> int:
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

    remote_terms = ["remote", "work from home", "wfh", "anywhere"]
    if any(t in combined for t in remote_terms):
        score += SCORING["remote_bonus"]

    # FAANG bonus
    company_lower = company.lower()
    if any(f in company_lower for f in FAANG_COMPANIES):
        score += SCORING.get("faang_bonus", 10)

    return min(score, 100)


def is_remote(title: str, location: str = "") -> bool:
    combined = f"{title} {location}".lower()
    return any(t in combined for t in ["remote", "work from home", "wfh", "anywhere", "distributed"])


def polite_delay() -> None:
    time.sleep(random.uniform(REQUEST_DELAY_MIN, REQUEST_DELAY_MAX))


def enrich_job(job: dict) -> dict:
    """Add location + salary + perks parsing to a job dict."""
    loc = parse_location(job.get("location", ""))
    job["country"] = loc.get("country", "")
    job["state"] = loc.get("state", "")
    job["city"] = loc.get("city", "")
    job["is_india"] = loc.get("is_india", False)
    if loc.get("is_remote"):
        job["remote"] = True

    # Salary from title + location (usually not present in ATS listings)
    sal = parse_salary(job.get("location", "") + " " + job.get("title", ""))
    job["salary_min_lpa"] = sal.get("salary_min_lpa")
    job["salary_max_lpa"] = sal.get("salary_max_lpa")
    job["salary_currency"] = sal.get("salary_currency", "")
    job["source_type"] = job.get("source_type", "ATS")

    # Perks detection from title + location
    perks_text = f"{job.get('title', '')} {job.get('location', '')}"
    perks = detect_perks(perks_text)
    job["visa_sponsored"] = perks["visa_sponsored"]
    job["has_equity"] = perks["has_equity"]
    return job


def scrape_greenhouse(client: httpx.Client, company: str) -> list[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{company}/jobs"
    jobs: list[dict] = []
    try:
        resp = client.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return jobs

        data = resp.json()
        for item in data.get("jobs", []):
            title = item.get("title", "")
            location = ""
            loc_field = item.get("location")
            if isinstance(loc_field, dict):
                location = loc_field.get("name", "")

            company_name = company.replace("-", " ").title()
            score = calc_match_score(title, location, company_name)
            if score == 0:
                continue

            job = {
                "title": title,
                "company": company_name,
                "location": location,
                "remote": is_remote(title, location),
                "apply_url": item.get("absolute_url", f"https://boards.greenhouse.io/{company}/jobs/{item.get('id', '')}"),
                "source": "greenhouse",
                "posted_date": item.get("updated_at", "")[:10] if item.get("updated_at") else "",
                "match_score": score,
            }
            jobs.append(enrich_job(job))
    except Exception as e:
        print(f"  [GH] {company}: Error - {e}", flush=True)

    return jobs


def scrape_lever(client: httpx.Client, company: str) -> list[dict]:
    url = f"https://api.lever.co/v0/postings/{company}"
    jobs: list[dict] = []
    try:
        resp = client.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return jobs

        data = resp.json()
        if not isinstance(data, list):
            return jobs

        for item in data:
            title = item.get("text", "")
            location = ""
            cats = item.get("categories")
            if isinstance(cats, dict):
                location = cats.get("location", "")

            company_name = company.replace("-", " ").title()
            score = calc_match_score(title, location, company_name)
            if score == 0:
                continue

            job = {
                "title": title,
                "company": company_name,
                "location": location,
                "remote": is_remote(title, location),
                "apply_url": item.get("hostedUrl", f"https://jobs.lever.co/{company}/{item.get('id', '')}"),
                "source": "lever",
                "posted_date": "",
                "match_score": score,
            }
            jobs.append(enrich_job(job))
    except Exception as e:
        print(f"  [LV] {company}: Error - {e}", flush=True)

    return jobs


def run_scraper() -> None:
    print(f"\n{'='*60}", flush=True)
    print(f"[*] Job Scraper - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    init_db()
    companies = load_companies()
    all_jobs: list[dict] = []

    headers = {"User-Agent": USER_AGENT}
    client = httpx.Client(headers=headers, follow_redirects=True)

    # Greenhouse
    gh_companies = companies.get("greenhouse", [])
    print(f"[GH] Scraping {len(gh_companies)} Greenhouse boards...\n", flush=True)
    for i, company in enumerate(gh_companies, 1):
        print(f"  [{i}/{len(gh_companies)}] {company}...", end=" ", flush=True)
        jobs = scrape_greenhouse(client, company)
        print(f"-> {len(jobs)} matches", flush=True)
        all_jobs.extend(jobs)
        polite_delay()

    # Lever
    lv_companies = companies.get("lever", [])
    print(f"\n[LV] Scraping {len(lv_companies)} Lever boards...\n", flush=True)
    for i, company in enumerate(lv_companies, 1):
        print(f"  [{i}/{len(lv_companies)}] {company}...", end=" ", flush=True)
        jobs = scrape_lever(client, company)
        print(f"-> {len(jobs)} matches", flush=True)
        all_jobs.extend(jobs)
        polite_delay()

    client.close()

    # Insert into DB
    new_count = insert_jobs_batch(all_jobs)

    print(f"\n{'='*60}", flush=True)
    print(f"[OK] ATS Scraper Done!", flush=True)
    print(f"   Total matched: {len(all_jobs)}", flush=True)
    print(f"   New jobs added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {len(all_jobs) - new_count}", flush=True)
    print(f"{'='*60}\n", flush=True)

    # SerpAPI
    try:
        from serp_scraper import run_serp_scraper
        run_serp_scraper()
    except Exception as e:
        print(f"[SERP] SerpAPI scraper error: {e}", flush=True)

    # Adzuna
    try:
        from adzuna_scraper import run_adzuna_scraper
        run_adzuna_scraper()
    except Exception as e:
        print(f"[ADZUNA] Adzuna scraper error: {e}", flush=True)

    # JSearch (RapidAPI)
    try:
        from jsearch_scraper import run_jsearch_scraper
        run_jsearch_scraper()
    except Exception as e:
        print(f"[JSEARCH] JSearch scraper error: {e}", flush=True)

    # Remote OK (free, no API key)
    try:
        from remoteok_scraper import run_remoteok_scraper
        run_remoteok_scraper()
    except Exception as e:
        print(f"[REMOTEOK] Remote OK scraper error: {e}", flush=True)

    # Ashby (free, no API key)
    try:
        from ashby_scraper import run_ashby_scraper
        run_ashby_scraper()
    except Exception as e:
        print(f"[ASHBY] Ashby scraper error: {e}", flush=True)


if __name__ == "__main__":
    run_scraper()

