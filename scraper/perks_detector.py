"""
Perks Detector — shared module for detecting visa sponsorship and equity/stock perks.
Used by all scrapers (ATS, Adzuna, JSearch, SERP) for consistent detection.
"""

VISA_TERMS = [
    "visa sponsor", "h1b", "h-1b", "h1-b", "work permit",
    "sponsorship available", "immigration support", "relocation support",
    "work visa", "tier 2", "skilled worker visa", "visa sponsorship",
    "sponsor visa", "work authorization", "employment visa",
    "relocation assistance", "relocation package",
]

EQUITY_TERMS = [
    "equity", "stock option", "stock grant", "rsu", "esop", "espp",
    "shares", "vesting", "stock plan", "ownership stake",
    "stock compensation", "equity compensation", "equity package",
    "restricted stock", "phantom stock",
]


def detect_visa(text: str) -> bool:
    """Detect if text mentions visa sponsorship."""
    if not text:
        return False
    lower = text.lower()
    return any(term in lower for term in VISA_TERMS)


def detect_equity(text: str) -> bool:
    """Detect if text mentions equity/stock perks."""
    if not text:
        return False
    lower = text.lower()
    return any(term in lower for term in EQUITY_TERMS)


def detect_perks(text: str) -> dict:
    """Detect all perks from text. Returns dict with boolean flags."""
    return {
        "visa_sponsored": detect_visa(text),
        "has_equity": detect_equity(text),
    }
