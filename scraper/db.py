"""Database module — SQLite storage for jobs with location + salary + FAANG support."""
import sqlite3
import hashlib
from datetime import datetime
from typing import Any
from config import DB_PATH, DATA_DIR, FAANG_COMPANIES


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db() -> None:
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT DEFAULT '',
            remote INTEGER DEFAULT 0,
            apply_url TEXT NOT NULL,
            source TEXT NOT NULL,
            posted_date TEXT,
            match_score INTEGER DEFAULT 0,
            saved INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            country TEXT DEFAULT '',
            state TEXT DEFAULT '',
            city TEXT DEFAULT '',
            is_india INTEGER DEFAULT 0,
            is_faang INTEGER DEFAULT 0,
            salary_min_lpa REAL,
            salary_max_lpa REAL,
            salary_currency TEXT DEFAULT '',
            source_type TEXT DEFAULT 'ATS',
            visa_sponsored INTEGER DEFAULT 0,
            has_equity INTEGER DEFAULT 0
        )
    """)
    conn.commit()

    # Run migration FIRST (adds new columns to existing tables)
    _migrate(conn)

    # Then create indexes (including on new columns)
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score DESC)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_remote ON jobs(remote)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs(country)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_is_india ON jobs(is_india)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_is_faang ON jobs(is_faang)",
        "CREATE INDEX IF NOT EXISTS idx_jobs_salary ON jobs(salary_min_lpa)",
    ]:
        conn.execute(idx_sql)
    conn.commit()
    conn.close()


def _migrate(conn: sqlite3.Connection) -> None:
    """Add new columns if they don't exist (safe migration)."""
    cursor = conn.execute("PRAGMA table_info(jobs)")
    existing_cols: set[str] = set()
    for row in cursor.fetchall():
        existing_cols.add(str(row[1]))

    new_columns = {
        "country": "TEXT DEFAULT ''",
        "state": "TEXT DEFAULT ''",
        "city": "TEXT DEFAULT ''",
        "is_india": "INTEGER DEFAULT 0",
        "is_faang": "INTEGER DEFAULT 0",
        "salary_min_lpa": "REAL",
        "salary_max_lpa": "REAL",
        "salary_currency": "TEXT DEFAULT ''",
        "source_type": "TEXT DEFAULT 'ATS'",
        "visa_sponsored": "INTEGER DEFAULT 0",
        "has_equity": "INTEGER DEFAULT 0",
    }

    for col, col_type in new_columns.items():
        if col not in existing_cols:
            try:
                conn.execute(f"ALTER TABLE jobs ADD COLUMN {col} {col_type}")
                print(f"  [DB] Added column: {col}")
            except sqlite3.OperationalError:
                pass

    conn.commit()


def _check_faang(company: str) -> bool:
    """Check if a company name matches a known FAANG / Big Tech company."""
    company_lower = company.lower().strip()
    for faang in FAANG_COMPANIES:
        if faang in company_lower or company_lower in faang:
            return True
    return False


def make_job_id(title: str, company: str, location: str = "") -> str:
    """Deduplicate using title + company + location hash."""
    raw = f"{title.lower().strip()}|{company.lower().strip()}|{location.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def job_exists(conn: sqlite3.Connection, job_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM jobs WHERE id = ?", (job_id,)).fetchone()
    return row is not None


def _normalize_date(date_str: str) -> str:
    """Normalize a date string to ISO format (YYYY-MM-DD). Fallback to today."""
    if not date_str or not date_str.strip():
        return datetime.utcnow().date().isoformat()
    # Already ISO format
    clean = date_str.strip()[:10]
    try:
        datetime.strptime(clean, "%Y-%m-%d")
        return clean
    except ValueError:
        pass
    # Try other formats
    for fmt in ["%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y", "%b %d, %Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(date_str.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return datetime.utcnow().date().isoformat()


def insert_job(conn: sqlite3.Connection, job: dict) -> bool:
    location = job.get("location", "")
    job_id = make_job_id(job["title"], job["company"], location)
    if job_exists(conn, job_id):
        return False

    # Auto-tag FAANG
    is_faang = 1 if job.get("is_faang") or _check_faang(job.get("company", "")) else 0

    # Normalize posted_date (#8)
    posted_date = _normalize_date(job.get("posted_date", ""))
    now = datetime.utcnow().isoformat()

    conn.execute(
        """INSERT INTO jobs (
            id, title, company, location, remote, apply_url, source,
            posted_date, match_score, created_at,
            country, state, city, is_india, is_faang,
            salary_min_lpa, salary_max_lpa, salary_currency, source_type,
            visa_sponsored, has_equity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            job_id,
            job["title"],
            job["company"],
            location,
            1 if job.get("remote", False) else 0,
            job["apply_url"],
            job["source"],
            posted_date,
            job.get("match_score", 0),
            now,
            job.get("country", ""),
            job.get("state", ""),
            job.get("city", ""),
            1 if job.get("is_india", False) else 0,
            is_faang,
            job.get("salary_min_lpa"),
            job.get("salary_max_lpa"),
            job.get("salary_currency", ""),
            job.get("source_type", "ATS"),
            1 if job.get("visa_sponsored", False) else 0,
            1 if job.get("has_equity", False) else 0,
        ),
    )
    return True


def insert_jobs_batch(jobs: list[dict]) -> int:
    conn = get_connection()
    count: int = 0
    for job in jobs:
        if insert_job(conn, job):
            count += 1
    conn.commit()
    conn.close()
    return count


def get_jobs(
    limit: int = 50,
    offset: int = 0,
    remote_only: bool = False,
    keyword: str | None = None,
    min_score: int = 0,
    country: str | None = None,
    india_only: bool = False,
    faang_only: bool = False,
    min_salary: float | None = None,
    max_salary: float | None = None,
    source: str | None = None,
) -> tuple[list[dict], int]:
    conn = get_connection()
    query = "SELECT * FROM jobs WHERE match_score >= ?"
    params: list[Any] = [min_score]

    if remote_only:
        query += " AND remote = 1"

    if keyword:
        query += " AND (LOWER(title) LIKE ? OR LOWER(company) LIKE ?)"
        kw = f"%{keyword.lower()}%"
        params.extend([kw, kw])

    if country:
        query += " AND country = ?"
        params.append(country.upper())

    if india_only:
        query += " AND is_india = 1"

    if faang_only:
        query += " AND is_faang = 1"

    if min_salary is not None:
        query += " AND salary_min_lpa >= ?"
        params.append(min_salary)

    if max_salary is not None:
        query += " AND salary_max_lpa <= ?"
        params.append(max_salary)

    if source:
        query += " AND source LIKE ?"
        params.append(f"%{source}%")

    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    total = conn.execute(count_query, params).fetchone()[0]

    query += " ORDER BY created_at DESC, match_score DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows], total


def get_stats() -> dict:
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    today = datetime.utcnow().date().isoformat()
    today_count = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE created_at LIKE ?", (f"{today}%",)
    ).fetchone()[0]
    sources = conn.execute(
        "SELECT source, COUNT(*) as cnt FROM jobs GROUP BY source"
    ).fetchall()

    india_count = 0
    remote_count = 0
    with_salary = 0
    faang_count = 0
    try:
        india_count = conn.execute("SELECT COUNT(*) FROM jobs WHERE is_india = 1").fetchone()[0]
        remote_count = conn.execute("SELECT COUNT(*) FROM jobs WHERE remote = 1").fetchone()[0]
        with_salary = conn.execute("SELECT COUNT(*) FROM jobs WHERE salary_min_lpa IS NOT NULL AND salary_min_lpa > 0").fetchone()[0]
        faang_count = conn.execute("SELECT COUNT(*) FROM jobs WHERE is_faang = 1").fetchone()[0]
    except sqlite3.OperationalError:
        pass

    conn.close()
    return {
        "total": total,
        "today": today_count,
        "by_source": {str(r["source"]): int(r["cnt"]) for r in sources},
        "india": india_count,
        "remote": remote_count,
        "with_salary": with_salary,
        "faang": faang_count,
    }
