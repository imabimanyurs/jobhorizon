"""Salary text parser — extracts and normalizes salary to LPA (Lakhs Per Annum)."""
import re

# Configurable exchange rate
USD_TO_INR = 83.5
EUR_TO_INR = 91.0
GBP_TO_INR = 106.0

# Patterns
_CURRENCY_MAP = {
    "$": "USD", "usd": "USD", "us$": "USD",
    "₹": "INR", "inr": "INR", "rs": "INR", "rs.": "INR", "rupee": "INR",
    "€": "EUR", "eur": "EUR",
    "£": "GBP", "gbp": "GBP",
}

_RATE_MAP = {
    "USD": USD_TO_INR,
    "EUR": EUR_TO_INR,
    "GBP": GBP_TO_INR,
    "INR": 1.0,
}

_NUM_RE = re.compile(r"[\d,]+\.?\d*")
_LPA_RE = re.compile(r"(\d[\d.]*?)\s*(?:to|-|–)\s*(\d[\d.]*?)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|l\.?p\.?a)", re.I)
_LPA_SINGLE_RE = re.compile(r"(\d[\d.]*?)\s*(?:lpa|lakhs?\s*(?:per\s*annum)?|l\.?p\.?a)", re.I)
_DOLLAR_RANGE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*[kK]?\s*(?:to|-|–)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*[kK]?", re.I)
_DOLLAR_SINGLE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d+)?)\s*[kK]?", re.I)
_INR_RANGE_RE = re.compile(r"(?:₹|inr|rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(?:to|-|–)\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d+)?)", re.I)
_INR_SINGLE_RE = re.compile(r"(?:₹|inr|rs\.?)\s*([\d,]+(?:\.\d+)?)", re.I)
_PER_MONTH_RE = re.compile(r"per\s*month|monthly|/\s*month|p\.?m\.?", re.I)
_PER_HOUR_RE = re.compile(r"per\s*hour|hourly|/\s*hr|/\s*hour", re.I)


def _clean_num(s: str) -> float:
    cleaned = s.replace(",", "").strip()
    if not cleaned:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _to_k(val: float, text: str) -> float:
    """If the value looks like it uses 'K' suffix, multiply by 1000."""
    # Check if original text near this number has K
    if val < 1000:
        return val * 1000
    return val


def parse_salary(text: str) -> dict:
    """
    Parse salary from text and return normalized LPA values.
    Returns: {
        "salary_min_lpa": float | None,
        "salary_max_lpa": float | None,
        "salary_currency": str | None,
        "salary_raw": str
    }
    """
    if not text:
        return {"salary_min_lpa": None, "salary_max_lpa": None, "salary_currency": None, "salary_raw": ""}

    result = {
        "salary_min_lpa": None,
        "salary_max_lpa": None,
        "salary_currency": None,
        "salary_raw": text.strip()[:200],
    }

    try:
        return _parse_salary_inner(text, result)
    except (ValueError, TypeError, AttributeError):
        return result


def _parse_salary_inner(text: str, result: dict) -> dict:

    is_monthly = bool(_PER_MONTH_RE.search(text))
    is_hourly = bool(_PER_HOUR_RE.search(text))

    # 1. Direct LPA format (Indian)
    m = _LPA_RE.search(text)
    if m:
        result["salary_min_lpa"] = round(float(m.group(1)), 2)
        result["salary_max_lpa"] = round(float(m.group(2)), 2)
        result["salary_currency"] = "INR"
        return result

    m = _LPA_SINGLE_RE.search(text)
    if m:
        val = round(float(m.group(1)), 2)
        result["salary_min_lpa"] = val
        result["salary_max_lpa"] = val
        result["salary_currency"] = "INR"
        return result

    # 2. USD range ($120K - $180K or $120,000 - $180,000)
    m = _DOLLAR_RANGE_RE.search(text)
    if m:
        low = _clean_num(m.group(1))
        high = _clean_num(m.group(2))
        # Handle K suffix
        if "k" in text[m.start():m.end()].lower():
            if low < 1000:
                low *= 1000
            if high < 1000:
                high *= 1000
        yearly_low = low * (12 if is_monthly else (2080 if is_hourly else 1))
        yearly_high = high * (12 if is_monthly else (2080 if is_hourly else 1))
        result["salary_min_lpa"] = round(yearly_low * USD_TO_INR / 100000, 2)
        result["salary_max_lpa"] = round(yearly_high * USD_TO_INR / 100000, 2)
        result["salary_currency"] = "USD"
        return result

    m = _DOLLAR_SINGLE_RE.search(text)
    if m:
        val = _clean_num(m.group(1))
        if "k" in text[m.start():m.end()].lower():
            if val < 1000:
                val *= 1000
        yearly = val * (12 if is_monthly else (2080 if is_hourly else 1))
        lpa = round(yearly * USD_TO_INR / 100000, 2)
        result["salary_min_lpa"] = lpa
        result["salary_max_lpa"] = lpa
        result["salary_currency"] = "USD"
        return result

    # 3. INR range (₹15,00,000 - ₹25,00,000)
    m = _INR_RANGE_RE.search(text)
    if m:
        low = _clean_num(m.group(1))
        high = _clean_num(m.group(2))
        yearly_low = low * (12 if is_monthly else 1)
        yearly_high = high * (12 if is_monthly else 1)
        result["salary_min_lpa"] = round(yearly_low / 100000, 2)
        result["salary_max_lpa"] = round(yearly_high / 100000, 2)
        result["salary_currency"] = "INR"
        return result

    m = _INR_SINGLE_RE.search(text)
    if m:
        val = _clean_num(m.group(1))
        yearly = val * (12 if is_monthly else 1)
        lpa = round(yearly / 100000, 2)
        result["salary_min_lpa"] = lpa
        result["salary_max_lpa"] = lpa
        result["salary_currency"] = "INR"
        return result

    return result


if __name__ == "__main__":
    # Quick test
    tests = [
        "15 to 25 LPA",
        "$120K - $180K per year",
        "$150,000 annually",
        "₹12,00,000 - ₹18,00,000",
        "Rs. 80000 per month",
        "20 lakhs per annum",
        "$45/hour",
        "Competitive salary",
        "INR 30,00,000",
    ]
    for t in tests:
        r = parse_salary(t)
        print(f"  {t:40s} -> min={r['salary_min_lpa']}, max={r['salary_max_lpa']}, cur={r['salary_currency']}")
