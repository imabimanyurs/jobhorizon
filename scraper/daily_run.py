"""
Daily Job Scraper Runner
========================
Runs all scrapers, cleans up stale jobs (>30 days), and logs results.
Schedule this with Windows Task Scheduler or cron.

Usage:
  python daily_run.py              # Run everything
  python daily_run.py --cleanup    # Only cleanup old jobs
  python daily_run.py --scrape     # Only run scrapers
"""

import sys
import os
import json
import time
from datetime import datetime, timedelta

# Ensure we're in the scraper directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)

from db import get_connection, init_db
from config import DATA_DIR


def save_last_run(new_jobs: int = 0, total: int = 0, elapsed: float = 0.0) -> None:
    """Write last run timestamp to data/last_run.json for the frontend."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    info = {
        "last_run": datetime.utcnow().isoformat() + "Z",
        "new_jobs": new_jobs,
        "total": total,
        "elapsed_seconds": round(elapsed, 1),
    }
    with open(str(DATA_DIR / "last_run.json"), "w") as f:
        json.dump(info, f, indent=2)
    print(f"[INFO] Saved last_run.json: {info['last_run']}", flush=True)


def cleanup_old_jobs(max_age_days: int = 30) -> int:
    """Delete jobs older than max_age_days based on created_at. Returns count deleted."""
    conn = get_connection()
    cutoff = (datetime.utcnow() - timedelta(days=max_age_days)).isoformat()

    # Count before
    before = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]

    # Delete old jobs (but never delete saved ones)
    conn.execute(
        "DELETE FROM jobs WHERE created_at < ? AND saved = 0",
        (cutoff,)
    )
    conn.commit()

    # Count after
    after = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    deleted = before - after
    conn.close()
    return deleted


def get_db_stats() -> dict:
    """Get current DB statistics."""
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    today = datetime.utcnow().strftime("%Y-%m-%d")
    today_count = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE created_at LIKE ?",
        (f"{today}%",)
    ).fetchone()[0]

    sources = conn.execute(
        "SELECT source, COUNT(*) as cnt FROM jobs GROUP BY source ORDER BY cnt DESC"
    ).fetchall()

    duplicates = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT title, company, COUNT(*) as cnt
            FROM jobs GROUP BY LOWER(title), LOWER(company)
            HAVING cnt > 1
        )
    """).fetchone()[0]

    conn.close()
    return {
        "total": total,
        "today": today_count,
        "sources": {row[0]: row[1] for row in sources},
        "potential_dupes": duplicates,
    }


def run_all_scrapers():
    """Run all scrapers in sequence."""
    print(f"\n{'='*60}", flush=True)
    print(f"  DAILY JOB SCRAPE — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", flush=True)
    print(f"{'='*60}\n", flush=True)

    # Initialize DB
    init_db()

    stats_before = get_db_stats()
    print(f"[DB] Before: {stats_before['total']} total jobs", flush=True)

    # 1. ATS Scraper (Greenhouse + Lever)
    print(f"\n{'─'*40}", flush=True)
    print("[1/4] Running ATS Scraper (Greenhouse + Lever)...", flush=True)
    try:
        from scraper import run_scraper
        # run_scraper already calls SerpAPI, Adzuna, JSearch internally
        run_scraper()
    except Exception as e:
        print(f"[ERROR] ATS Scraper failed: {e}", flush=True)

    stats_after = get_db_stats()
    new_jobs = stats_after["total"] - stats_before["total"]
    print(f"\n[DB] After scraping: {stats_after['total']} total jobs (+{new_jobs} new)", flush=True)

    return stats_before, stats_after


def main():
    start_time = time.time()
    mode = sys.argv[1] if len(sys.argv) > 1 else "--all"

    init_db()

    if mode == "--cleanup":
        print("[CLEANUP] Removing jobs older than 30 days...", flush=True)
        deleted = cleanup_old_jobs(30)
        print(f"[CLEANUP] Deleted {deleted} old jobs", flush=True)
        s = get_db_stats()
        save_last_run(new_jobs=0, total=s["total"], elapsed=time.time() - start_time)

    elif mode == "--scrape":
        stats_before, stats_after = run_all_scrapers()
        new_jobs = stats_after["total"] - stats_before["total"]
        save_last_run(new_jobs=new_jobs, total=stats_after["total"], elapsed=time.time() - start_time)

    else:  # --all (default)
        # Step 1: Cleanup old jobs first
        print("[STEP 1] Cleaning up jobs older than 30 days...", flush=True)
        deleted = cleanup_old_jobs(30)
        print(f"[CLEANUP] Deleted {deleted} old jobs", flush=True)

        # Step 2: Run all scrapers
        print(f"\n[STEP 2] Running all scrapers...", flush=True)
        stats_before, stats_after = run_all_scrapers()

        # Step 3: Summary
        elapsed = time.time() - start_time
        new_jobs = stats_after['total'] - stats_before['total'] + deleted
        print(f"\n{'='*60}", flush=True)
        print(f"  DAILY RUN COMPLETE", flush=True)
        print(f"{'─'*60}", flush=True)
        print(f"  Old jobs removed:  {deleted}", flush=True)
        print(f"  New jobs added:    {new_jobs}", flush=True)
        print(f"  Total in DB:       {stats_after['total']}", flush=True)
        print(f"  Today's jobs:      {stats_after['today']}", flush=True)
        print(f"  Time taken:        {elapsed:.1f}s", flush=True)
        print(f"  Sources:", flush=True)
        for src, cnt in stats_after["sources"].items():
            print(f"    {src:20s} {cnt:>6}", flush=True)
        print(f"{'='*60}\n", flush=True)

        # Step 4: Save last run timestamp for frontend
        save_last_run(new_jobs=new_jobs, total=stats_after["total"], elapsed=elapsed)


if __name__ == "__main__":
    main()
