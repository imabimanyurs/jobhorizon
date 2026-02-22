"""Scraper configuration."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
# Railway volume or local data dir
DATA_DIR = Path(os.environ["RAILWAY_VOLUME_MOUNT_PATH"]) if os.environ.get("RAILWAY_VOLUME_MOUNT_PATH") else BASE_DIR / "data"
DB_PATH = DATA_DIR / "jobs.db"
COMPANIES_FILE = Path(__file__).resolve().parent / "companies.json"

# ─── SerpAPI ──────────────────────────────────────────────────
SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")

# ─── Adzuna API ───────────────────────────────────────────────
ADZUNA_APP_ID = os.environ.get("ADZUNA_APP_ID", "")
ADZUNA_APP_KEY = os.environ.get("ADZUNA_APP_KEY", "")

# ─── JSearch API (RapidAPI) ────────────────────────────────
JSEARCH_API_KEY = os.environ.get("JSEARCH_API_KEY", "")

# ─── Request settings ─────────────────────────────────────────
REQUEST_DELAY_MIN = 0.5
REQUEST_DELAY_MAX = 1.5
REQUEST_TIMEOUT = 15
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# ─── FAANG / Big Tech companies ───────────────────────────────
# Normalized lowercase for matching
FAANG_COMPANIES = {
    # FAANG
    "google", "alphabet", "meta", "facebook", "amazon", "apple", "netflix",
    # Big Tech
    "microsoft", "nvidia", "uber", "linkedin", "pinterest", "snap", "snapchat",
    "twitter", "x corp", "salesforce", "adobe", "oracle", "intuit", "vmware",
    "servicenow", "snowflake", "crowdstrike", "zscaler", "palantir",
    "databricks", "stripe", "spotify", "dropbox", "airbnb", "doordash",
    "coinbase", "cloudflare", "datadog", "atlassian", "shopify",
    "robinhood", "discord", "figma", "notion", "openai",
    "lyft", "twilio", "square", "block", "plaid", "rippling",
    # Hardware / Semiconductor
    "tesla", "amd", "qualcomm", "intel", "dell", "broadcom", "arm",
    # Enterprise / Finance Tech
    "ibm", "sap", "cisco", "visa", "mastercard", "paypal",
    "goldman sachs", "bloomberg", "morgan stanley", "jpmorgan",
    # Top Indian Tech
    "flipkart", "swiggy", "zomato", "meesho", "razorpay", "cred",
    "phonepe", "paytm", "ola", "zerodha", "groww", "dream11",
    "freshworks", "zoho", "browserstack", "postman", "thoughtspot",
    "myntra", "bigbasket", "nykaa", "lenskart", "sharechat", "instamojo",
    # AI / ML Leaders
    "anthropic", "deepmind", "cohere", "stability ai", "hugging face",
    "scale ai", "anyscale", "together ai", "mistral",
}

# ─── Keyword filters ─────────────────────────────────────────
INCLUDE_KEYWORDS = [
    "software engineer",
    "software developer",
    "sde",
    "frontend",
    "front end",
    "front-end",
    "backend",
    "back end",
    "back-end",
    "fullstack",
    "full stack",
    "full-stack",
    "react",
    "angular",
    "node",
    "python",
    "java",
    "typescript",
    "javascript",
    "web developer",
    "application developer",
    "platform engineer",
    "systems engineer",
    "devops",
    "site reliability",
    "sre",
    "cloud engineer",
    "data engineer",
    "ml engineer",
    "machine learning engineer",
    "applied scientist",
    "research engineer",
    "ios developer",
    "android developer",
    "mobile developer",
    "engineering manager",
    "tech lead",
    "staff engineer",
    "principal engineer",
    "solutions engineer",
    "infrastructure engineer",
    "security engineer",
    "production engineer",
    "reliability engineer",
    "developer advocate",
    "solutions architect",
]

EXCLUDE_KEYWORDS = [
    "unpaid",
    "training fee",
    "commission only",
    "commission-only",
    "crypto",
    "whatsapp",
    "telegram",
    "forex",
    "mlm",
    "multi-level",
    "pyramid",
    "pay to work",
    "no experience needed",
    "hiring immediately",
    "urgently hiring",
    "work from phone",
    "senior director",
    "vp of",
    "vice president",
    "chief",
    "head of",
    "staff scientist",
    "principal researcher",
]

# ─── Match scoring ────────────────────────────────────────────
SCORING = {
    "high_match": [
        "react", "angular", "fullstack", "full stack", "full-stack",
        "frontend", "front-end", "backend", "back-end",
        "software engineer", "sde", "sde-2", "sde-3", "sde2", "sde3",
    ],
    "medium_match": [
        "python", "typescript", "javascript", "node", "java",
        "web developer", "mobile developer", "ios developer", "android developer",
    ],
    "low_match": [
        "devops", "sre", "cloud engineer", "data engineer", "ml engineer",
        "platform engineer", "infrastructure engineer", "security engineer",
    ],
    "remote_bonus": 15,
    "faang_bonus": 10,
    "high_score": 90,
    "medium_score": 70,
    "low_score": 50,
}

# ─── SerpAPI Search Queries ───────────────────────────────────
# Rules for high-quality results:
#   1. Always use site: restriction for ATS boards (Greenhouse, Lever, Workable)
#   2. Use intitle: for non-site-restricted queries to target actual job posts
#   3. Use -site: to exclude noise domains (Glassdoor reviews, salary sites, listicles)
#   4. Use tighter freshness (qdr:d or qdr:w) to avoid stale listings
#   5. Exclude aggregator/listicle keywords with -"top" -"best" -"highest paying" etc.

# Common noise exclusion suffix for non-site-restricted queries
_NOISE_EXCLUDE = (
    ' -site:glassdoor.com -site:indeed.com -site:payscale.com -site:ambitionbox.com'
    ' -site:naukri.com -site:quora.com -site:reddit.com -site:medium.com'
    ' -site:youtube.com -site:linkedin.com'
    ' -"top companies" -"highest paying" -"salary guide" -"salary report"'
    ' -"interview questions" -"how to" -"career advice" -"salary comparison"'
    ' -"best jobs" -"jobs in 2025" -"jobs in 2026" -"review"'
)

SERP_QUERIES = [
    # ── Greenhouse: site-restricted (high quality, actual job pages) ──
    {
        "query": 'site:boards.greenhouse.io intitle:"software engineer"',
        "freshness": "qdr:w",
        "label": "GH: Software Engineer",
        "discover": True,
    },
    {
        "query": 'site:boards.greenhouse.io intitle:"react" OR intitle:"frontend" OR intitle:"front-end"',
        "freshness": "qdr:w",
        "label": "GH: React/Frontend",
        "discover": True,
    },
    {
        "query": 'site:boards.greenhouse.io intitle:"backend" OR intitle:"back-end" OR intitle:"fullstack" OR intitle:"full stack"',
        "freshness": "qdr:w",
        "label": "GH: Backend/Fullstack",
        "discover": True,
    },
    {
        "query": 'site:boards.greenhouse.io intitle:"software engineer" ("india" OR "bangalore" OR "bengaluru" OR "hyderabad" OR "mumbai" OR "pune")',
        "freshness": "qdr:w",
        "label": "GH: SWE India",
        "discover": True,
    },
    {
        "query": 'site:boards.greenhouse.io intitle:"software engineer" "remote"',
        "freshness": "qdr:w",
        "label": "GH: SWE Remote",
        "discover": True,
    },
    {
        "query": 'site:boards.greenhouse.io intitle:"sde" OR intitle:"sde-2" OR intitle:"sde-3" OR intitle:"sde ii"',
        "freshness": "qdr:w",
        "label": "GH: SDE Roles",
        "discover": True,
    },

    # ── Lever: site-restricted ──
    {
        "query": 'site:jobs.lever.co intitle:"software engineer"',
        "freshness": "qdr:w",
        "label": "LV: Software Engineer",
        "discover": True,
    },
    {
        "query": 'site:jobs.lever.co intitle:"full stack" OR intitle:"frontend" OR intitle:"backend"',
        "freshness": "qdr:w",
        "label": "LV: Fullstack/FE/BE",
        "discover": True,
    },
    {
        "query": 'site:jobs.lever.co intitle:"software engineer" ("india" OR "remote")',
        "freshness": "qdr:w",
        "label": "LV: SWE India/Remote",
        "discover": True,
    },

    # ── Workable: site-restricted ──
    {
        "query": 'site:apply.workable.com intitle:"software engineer" OR intitle:"frontend developer" OR intitle:"backend developer"',
        "freshness": "qdr:w",
        "label": "WK: SWE/FE/BE",
    },
    {
        "query": 'site:apply.workable.com intitle:"react" OR intitle:"angular" OR intitle:"node"',
        "freshness": "qdr:w",
        "label": "WK: React/Angular/Node",
    },

    # ── India: targeted with exclusions (use intitle + noise filter) ──
    {
        "query": f'intitle:"software engineer" intitle:"hiring" ("bangalore" OR "hyderabad" OR "mumbai" OR "pune" OR "delhi" OR "gurgaon" OR "noida"){_NOISE_EXCLUDE}',
        "freshness": "qdr:d",
        "label": "India: SWE Hiring Cities",
    },
    {
        "query": f'intitle:"frontend developer" OR intitle:"react developer" ("india" OR "bangalore" OR "remote"){_NOISE_EXCLUDE}',
        "freshness": "qdr:w",
        "label": "India: Frontend/React",
    },
    {
        "query": f'intitle:"backend developer" OR intitle:"backend engineer" ("india" OR "bangalore" OR "hyderabad"){_NOISE_EXCLUDE}',
        "freshness": "qdr:w",
        "label": "India: Backend",
    },
    {
        "query": 'site:boards.greenhouse.io OR site:jobs.lever.co intitle:"fullstack" OR intitle:"full stack" ("india" OR "bangalore" OR "remote")',
        "freshness": "qdr:w",
        "label": "India: Fullstack ATS",
    },

    # ── FAANG: site-restricted to their career pages ──
    {
        "query": f'intitle:"software development engineer" ("google" OR "amazon" OR "meta" OR "microsoft" OR "apple"){_NOISE_EXCLUDE}',
        "freshness": "qdr:w",
        "label": "FAANG: SDE",
    },

    # ── Remote-first ──
    {
        "query": 'site:boards.greenhouse.io OR site:jobs.lever.co intitle:"software engineer" "remote" "anywhere"',
        "freshness": "qdr:w",
        "label": "Remote Anywhere ATS",
        "discover": True,
    },

    # ── YC Startups ──
    {
        "query": 'site:boards.greenhouse.io intitle:"software engineer" "YC" OR "Y Combinator"',
        "freshness": "qdr:m",
        "label": "GH: YC Startups",
        "discover": True,
    },
]

# ─── Adzuna search queries ────────────────────────────────────
ADZUNA_QUERIES = [
    # India
    {"what": "software engineer", "where": "india", "country": "in"},
    {"what": "react developer", "where": "india", "country": "in"},
    {"what": "frontend developer", "where": "india", "country": "in"},
    {"what": "backend developer", "where": "india", "country": "in"},
    {"what": "fullstack developer", "where": "india", "country": "in"},
    {"what": "python developer", "where": "india", "country": "in"},
    {"what": "java developer", "where": "bangalore", "country": "in"},
    {"what": "node developer", "where": "india", "country": "in"},
    # US
    {"what": "software engineer", "where": "remote", "country": "us"},
    {"what": "react developer", "where": "", "country": "us"},
    {"what": "frontend developer", "where": "", "country": "us"},
    {"what": "backend developer", "where": "", "country": "us"},
    # UK
    {"what": "software engineer", "where": "london", "country": "gb"},
    # Netherlands
    {"what": "software engineer", "where": "amsterdam", "country": "nl"},
    {"what": "frontend developer", "where": "netherlands", "country": "nl"},
    # Ireland
    {"what": "software engineer", "where": "dublin", "country": "ie"},
    {"what": "react developer", "where": "ireland", "country": "ie"},
    # France
    {"what": "software engineer", "where": "paris", "country": "fr"},
    {"what": "frontend developer", "where": "france", "country": "fr"},
    # New Zealand
    {"what": "software engineer", "where": "auckland", "country": "nz"},
    {"what": "web developer", "where": "new zealand", "country": "nz"},
]

# ─── JSearch search queries ───────────────────────────────────
JSEARCH_QUERIES = [
    # India
    {"query": "software engineer in india", "country": "in", "label": "IN: SWE", "date_posted": "week"},
    {"query": "react developer india", "country": "in", "label": "IN: React", "date_posted": "week"},
    {"query": "frontend developer bangalore", "country": "in", "label": "IN: FE Bangalore", "date_posted": "week"},
    {"query": "backend developer hyderabad OR pune", "country": "in", "label": "IN: BE Cities", "date_posted": "week"},
    {"query": "fullstack developer india remote", "country": "in", "label": "IN: Fullstack Remote", "date_posted": "week"},
    # US
    {"query": "software engineer", "country": "us", "label": "US: SWE", "date_posted": "week"},
    {"query": "react developer remote", "country": "us", "label": "US: React Remote", "date_posted": "week", "remote_only": True},
    {"query": "frontend developer", "country": "us", "label": "US: Frontend", "date_posted": "week"},
    {"query": "backend engineer python OR java", "country": "us", "label": "US: Backend Py/Java", "date_posted": "week"},
    {"query": "fullstack engineer", "country": "us", "label": "US: Fullstack", "date_posted": "week"},
    # UK
    {"query": "software engineer london", "country": "gb", "label": "UK: SWE London", "date_posted": "month"},
    {"query": "react developer uk", "country": "gb", "label": "UK: React", "date_posted": "month"},
    # Remote-first
    {"query": "remote software engineer", "country": "us", "label": "Remote: SWE", "date_posted": "week", "remote_only": True},
    # FAANG-targeted
    {"query": "software engineer google OR amazon OR meta OR microsoft OR apple", "country": "us", "label": "FAANG: SWE US", "date_posted": "month"},
    {"query": "software development engineer flipkart OR swiggy OR razorpay OR meesho", "country": "in", "label": "Indian Tech: SDE", "date_posted": "month"},
]

# ─── Ashby companies (board slugs for api.ashbyhq.com) ────────
ASHBY_COMPANIES = [
    # Fintech / Finance
    "ramp",
    "brex",
    "mercury",
    "deel",
    "carta",
    "plaid",
    "column",
    "pipe",
    # Developer Tools / Infra
    "notion",
    "figma",
    "linear",
    "vercel",
    "supabase",
    "railway",
    "planetscale",
    "neon",
    "resend",
    "dbt-labs",
    "grafana",
    "snyk",
    # AI / ML
    "anthropic",
    "cohere",
    "together-ai",
    "anyscale",
    "perplexity",
    "stability-ai",
    "adept",
    "character-ai",
    "midjourney",
    "writesonic",
    # SaaS / Products
    "loom",
    "calendly",
    "airtable",
    "retool",
    "miro",
    "webflow",
    "drata",
    "postman",
    "jasper-ai",
    # Security / Enterprise
    "wiz",
    "lacework",
    "onepassword",
    "tailscale",
    "teleport",
    # Other notable companies
    "gusto",
    "rippling",
    "lattice",
    "ashbyhq",
]

# ─── Exchange rates ───────────────────────────────────────────
USD_TO_INR = 83.5
