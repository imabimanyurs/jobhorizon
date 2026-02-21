import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Railway volume or local data dir
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
  : path.resolve(process.cwd(), "..", "data");
const DB_PATH = path.join(DATA_DIR, "jobs.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    fs.mkdirSync(DATA_DIR, { recursive: true });

    // If DB doesn't exist yet, create it with the jobs table
    if (!fs.existsSync(DB_PATH)) {
      const initDb = new Database(DB_PATH);
      initDb.exec(`CREATE TABLE IF NOT EXISTS jobs (
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
      )`);
      initDb.close();
    }

    db = new Database(DB_PATH, { readonly: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: number;
  apply_url: string;
  source: string;
  posted_date: string;
  match_score: number;
  saved: number;
  created_at: string;
  country: string;
  state: string;
  city: string;
  is_india: number;
  is_faang: number;
  salary_min_lpa: number | null;
  salary_max_lpa: number | null;
  salary_currency: string;
  source_type: string;
  visa_sponsored: number;
  has_equity: number;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  per_page: number;
}

export interface StatsResponse {
  total: number;
  today: number;
  by_source: Record<string, number>;
  india: number;
  remote: number;
  faang: number;
  with_salary: number;
}

export function getJobs(params: {
  page?: number;
  per_page?: number;
  remote_only?: boolean;
  keyword?: string;
  min_score?: number;
  source?: string;
  country?: string;
  india_only?: boolean;
  faang_only?: boolean;
  today_only?: boolean;
  max_days_ago?: number;
  sort_by?: string;
  smart_view?: boolean;
  company?: string;
  min_salary?: number;
  max_salary?: number;
  visa_only?: boolean;
  equity_only?: boolean;
}): JobsResponse {
  const db = getDb();
  const page = params.page || 1;
  const perPage = params.per_page || 30;
  const offset = (page - 1) * perPage;
  const minScore = params.min_score || 0;

  let where = "WHERE match_score >= ?";
  const queryParams: (string | number)[] = [minScore];

  if (params.remote_only) {
    where += " AND remote = 1";
  }

  if (params.keyword) {
    where += " AND (LOWER(title) LIKE ? OR LOWER(company) LIKE ?)";
    const kw = `%${params.keyword.toLowerCase()}%`;
    queryParams.push(kw, kw);
  }

  if (params.source) {
    where += " AND source LIKE ?";
    queryParams.push(`%${params.source}%`);
  }

  if (params.country) {
    where += " AND country = ?";
    queryParams.push(params.country.toUpperCase());
  }

  if (params.india_only) {
    where += " AND is_india = 1";
  }

  if (params.faang_only) {
    where += " AND is_faang = 1";
  }

  if (params.min_salary !== undefined && params.min_salary > 0) {
    where += " AND salary_min_lpa >= ?";
    queryParams.push(params.min_salary);
  }

  if (params.max_salary !== undefined && params.max_salary > 0) {
    where += " AND salary_max_lpa <= ?";
    queryParams.push(params.max_salary);
  }

  if (params.today_only) {
    const todayStr = new Date().toISOString().split("T")[0];
    where += " AND posted_date = ?";
    queryParams.push(todayStr);
  }

  if (params.max_days_ago !== undefined && params.max_days_ago > 0) {
    const since = new Date();
    since.setDate(since.getDate() - params.max_days_ago);
    const sinceStr = since.toISOString().split("T")[0];
    where += " AND posted_date >= ?";
    queryParams.push(sinceStr);
  }

  if (params.company) {
    where += " AND LOWER(company) LIKE ?";
    queryParams.push(`%${params.company.toLowerCase()}%`);
  }

  if (params.visa_only) {
    where += " AND visa_sponsored = 1";
  }

  if (params.equity_only) {
    where += " AND has_equity = 1";
  }

  // Smart View: high score + fresh + has signal
  if (params.smart_view) {
    where += " AND match_score >= 70";
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    where += " AND (posted_date >= ? OR created_at >= ?)";
    const weekStr = weekAgo.toISOString().split("T")[0];
    queryParams.push(weekStr, weekStr);
    where += " AND (salary_min_lpa > 0 OR remote = 1 OR is_india = 1 OR is_faang = 1)";
  }

  // Determine sort order
  let orderBy = "ORDER BY created_at DESC, match_score DESC";
  if (params.sort_by === "smart" || params.smart_view) {
    // Weighted composite: match(50%) + freshness(30%) + salary_signal(20%)
    orderBy = `ORDER BY (
      (match_score * 0.5) +
      (CASE
        WHEN julianday('now') - julianday(COALESCE(posted_date, created_at)) <= 0 THEN 100
        WHEN julianday('now') - julianday(COALESCE(posted_date, created_at)) <= 1 THEN 80
        WHEN julianday('now') - julianday(COALESCE(posted_date, created_at)) <= 3 THEN 50
        WHEN julianday('now') - julianday(COALESCE(posted_date, created_at)) <= 7 THEN 20
        ELSE 5
      END * 0.3) +
      (CASE WHEN COALESCE(salary_min_lpa, 0) > 0 THEN MIN(COALESCE(salary_min_lpa, 0), 100) ELSE 0 END * 0.2)
    ) DESC`;
  } else if (params.sort_by === "score") {
    orderBy = "ORDER BY match_score DESC, created_at DESC";
  } else if (params.sort_by === "salary") {
    orderBy = "ORDER BY COALESCE(salary_min_lpa, 0) DESC, match_score DESC";
  } else if (params.sort_by === "date") {
    orderBy = "ORDER BY posted_date DESC, created_at DESC";
  }

  const total = db
    .prepare(`SELECT COUNT(*) as cnt FROM jobs ${where}`)
    .get(...queryParams) as { cnt: number };

  const jobs = db
    .prepare(
      `SELECT * FROM jobs ${where} ${orderBy} LIMIT ? OFFSET ?`
    )
    .all(...queryParams, perPage, offset) as Job[];

  return {
    jobs,
    total: total.cnt,
    page,
    per_page: perPage,
  };
}

export function getStats(): StatsResponse {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as cnt FROM jobs").get() as { cnt: number }).cnt;
  const today = new Date().toISOString().split("T")[0];
  const todayCount = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM jobs WHERE created_at LIKE ?")
      .get(`${today}%`) as { cnt: number }
  ).cnt;

  const sources = db
    .prepare("SELECT source, COUNT(*) as cnt FROM jobs GROUP BY source")
    .all() as { source: string; cnt: number }[];

  let india = 0;
  let remote = 0;
  let faang = 0;
  let withSalary = 0;
  try {
    india = (db.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE is_india = 1").get() as { cnt: number }).cnt;
    remote = (db.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE remote = 1").get() as { cnt: number }).cnt;
    faang = (db.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE is_faang = 1").get() as { cnt: number }).cnt;
    withSalary = (db.prepare("SELECT COUNT(*) as cnt FROM jobs WHERE salary_min_lpa IS NOT NULL AND salary_min_lpa > 0").get() as { cnt: number }).cnt;
  } catch { }

  return {
    total,
    today: todayCount,
    by_source: Object.fromEntries(sources.map((s) => [s.source, s.cnt])),
    india,
    remote,
    faang,
    with_salary: withSalary,
  };
}
