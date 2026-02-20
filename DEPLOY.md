# 🚀 JobHorizon — Railway Deployment Guide

## Architecture
```
┌─────────────────────────────────────────────────┐
│  Railway Service (Single Container)              │
│                                                  │
│  ┌──────────────┐    ┌───────────────────┐       │
│  │  Next.js App │    │  Python Scrapers  │       │
│  │  (port 3000) │    │  (via /api/cron)  │       │
│  │              │    │                   │       │
│  │  GET /       │    │  scraper.py       │       │
│  │  GET /api/*  │    │  adzuna_scraper   │       │
│  │              │    │  jsearch_scraper  │       │
│  │              │    │  serp_scraper     │       │
│  └──────┬───────┘    └─────────┬─────────┘       │
│         │                      │                 │
│         └──────┐   ┌───────────┘                 │
│                ▼   ▼                             │
│          ┌─────────────┐                         │
│          │  SQLite DB  │ ← Railway Volume        │
│          │  /data/     │   (persistent storage)  │
│          └─────────────┘                         │
└─────────────────────────────────────────────────┘
```

## Step-by-Step Deployment

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "JobHorizon: full stack job aggregator"
git remote add origin https://github.com/YOUR_USER/job-horizon.git
git push -u origin main
```

### 2. Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repo

### 3. Add a Volume (CRITICAL for SQLite persistence)
1. In your Railway service, click **"+ New"** → **"Volume"**
2. Set **mount path** to: `/app/data`
3. This ensures the SQLite database survives redeploys

### 4. Set Environment Variables
In Railway service settings → **Variables**:

| Variable | Value | Description |
|----------|-------|-------------|
| `CRON_SECRET` | `your-secret-key-here` | Protects the cron endpoint |
| `SERPAPI_KEY` | `your-serpapi-key` | SerpAPI access |
| `ADZUNA_APP_ID` | `your-adzuna-id` | Adzuna API |
| `ADZUNA_APP_KEY` | `your-adzuna-key` | Adzuna API |
| `JSEARCH_API_KEY` | `your-jsearch-key` | JSearch RapidAPI |
| `RAILWAY_VOLUME_MOUNT_PATH` | `/app/data` | Auto-set by Railway |

### 5. Set Up Daily Cron (6:00 AM IST = 12:30 AM UTC)

**Option A: cron-job.org (Free, Recommended)**
1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL**: `https://YOUR-APP.up.railway.app/api/cron?key=your-secret-key-here`
   - **Schedule**: `30 0 * * *` (12:30 AM UTC = 6:00 AM IST)
   - **Method**: GET
3. Save

**Option B: Railway Cron Service**
1. In Railway, create a **second service** from the same repo
2. Set it as a **Cron Job** with schedule: `30 0 * * *`
3. Override the start command: `curl "http://YOUR-INTERNAL:3000/api/cron?key=your-secret"`

### 6. First Run
Trigger the scraper manually (once after deploy):
```
https://YOUR-APP.up.railway.app/api/cron?key=your-secret-key-here
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard UI |
| `GET /api/jobs` | Job listings with filters |
| `GET /api/jobs?action=stats` | Dashboard statistics |
| `GET /api/rates` | Exchange rates (cached 1hr) |
| `GET /api/cron?key=SECRET` | Trigger daily scrape |
| `GET /api/cron?key=SECRET&mode=--cleanup` | Only cleanup old jobs |
| `GET /api/cron?key=SECRET&mode=--scrape` | Only run scrapers |

## Daily Automation Flow
```
6:00 AM IST → cron-job.org hits /api/cron?key=SECRET
  ├── Step 1: DELETE jobs WHERE created_at < 30 days ago AND saved = 0
  ├── Step 2: Run Greenhouse + Lever scraper
  ├── Step 3: Run SerpAPI scraper
  ├── Step 4: Run Adzuna scraper
  ├── Step 5: Run JSearch scraper
  └── Step 6: Log summary (new jobs, total, sources)
```

## Saves are Local
- Job saves use **browser localStorage** — no database writes
- Each user has their own saved jobs list
- Persists as long as same browser + no cache clear
- No login required

## Local Development
```bash
# Start Next.js dev server
cd web && npm run dev

# Run scrapers manually
cd scraper && python daily_run.py

# Run only cleanup
cd scraper && python daily_run.py --cleanup
```
