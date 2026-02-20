"""Location parser — normalizes location strings into structured fields."""
import re

# Common India cities/states for detection
_INDIA_CITIES = {
    "bangalore", "bengaluru", "mumbai", "bombay", "delhi", "new delhi", "gurgaon", "gurugram",
    "noida", "hyderabad", "pune", "chennai", "kolkata", "calcutta", "ahmedabad", "jaipur",
    "kochi", "cochin", "thiruvananthapuram", "trivandrum", "lucknow", "chandigarh",
    "indore", "bhopal", "nagpur", "coimbatore", "vizag", "visakhapatnam", "mysore",
    "mangalore", "surat", "vadodara", "rajkot", "patna", "ranchi", "bhubaneswar",
    "goa", "panaji", "dehradun", "shimla", "agra", "kanpur", "varanasi",
}

_INDIA_STATES = {
    "karnataka", "maharashtra", "tamil nadu", "telangana", "andhra pradesh",
    "kerala", "west bengal", "rajasthan", "gujarat", "uttar pradesh",
    "madhya pradesh", "haryana", "punjab", "bihar", "odisha", "jharkhand",
    "goa", "uttarakhand", "himachal pradesh", "assam",
}

_US_STATES = {
    "california", "ca", "new york", "ny", "texas", "tx", "washington", "wa",
    "massachusetts", "ma", "illinois", "il", "colorado", "co", "georgia", "ga",
    "florida", "fl", "virginia", "va", "oregon", "or", "pennsylvania", "pa",
    "north carolina", "nc", "ohio", "oh", "michigan", "mi", "arizona", "az",
    "minnesota", "mn", "utah", "ut", "maryland", "md", "new jersey", "nj",
    "connecticut", "ct", "tennessee", "tn", "missouri", "mo", "indiana", "in",
    "wisconsin", "wi", "iowa", "ia", "nevada", "nv",
}

_US_CITIES = {
    "san francisco", "sf", "new york city", "nyc", "los angeles", "la",
    "seattle", "austin", "boston", "chicago", "denver", "atlanta",
    "portland", "san jose", "san diego", "dallas", "houston",
    "miami", "philadelphia", "phoenix", "minneapolis", "salt lake city",
    "raleigh", "charlotte", "nashville", "detroit", "pittsburgh",
    "washington dc", "dc", "palo alto", "mountain view", "sunnyvale",
    "cupertino", "menlo park", "redmond", "bellevue",
}

_REMOTE_TERMS = {"remote", "work from home", "wfh", "anywhere", "distributed", "fully remote", "remote-first"}

_COUNTRY_CITIES = {
    "NL": {"amsterdam", "rotterdam", "the hague", "eindhoven", "utrecht", "delft", "leiden"},
    "IE": {"dublin", "cork", "galway", "limerick", "waterford"},
    "FR": {"paris", "lyon", "marseille", "toulouse", "bordeaux", "nantes", "strasbourg", "nice"},
    "NZ": {"auckland", "wellington", "christchurch", "hamilton", "dunedin"},
    "MY": {"kuala lumpur", "penang", "johor bahru", "cyberjaya", "putrajaya", "petaling jaya"},
    "JP": {"tokyo", "osaka", "kyoto", "yokohama", "nagoya", "fukuoka", "sapporo", "kobe"},
    "GB": {"london", "manchester", "edinburgh", "birmingham", "bristol", "cambridge", "oxford", "leeds", "glasgow"},
    "CA": {"toronto", "vancouver", "montreal", "ottawa", "calgary", "edmonton", "waterloo"},
    "DE": {"berlin", "munich", "hamburg", "frankfurt", "cologne", "stuttgart"},
    "AU": {"sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra"},
    "SG": {"singapore"},
}

_COUNTRY_MAP = {
    "india": "IN", "united states": "US", "usa": "US", "us": "US",
    "united kingdom": "GB", "uk": "GB", "canada": "CA",
    "germany": "DE", "france": "FR", "australia": "AU",
    "singapore": "SG", "japan": "JP", "ireland": "IE",
    "netherlands": "NL", "holland": "NL", "sweden": "SE", "brazil": "BR",
    "new zealand": "NZ", "nz": "NZ", "malaysia": "MY",
    "israel": "IL", "spain": "ES", "italy": "IT",
    "poland": "PL", "portugal": "PT", "switzerland": "CH",
    "mexico": "MX", "south korea": "KR", "china": "CN",
    "uae": "AE", "dubai": "AE", "abu dhabi": "AE",
}


def parse_location(location_str: str) -> dict:
    """
    Parse a location string into structured fields.
    Returns: {
        "country": str (ISO code) | "",
        "state": str | "",
        "city": str | "",
        "is_remote": bool,
        "is_india": bool,
        "location_raw": str
    }
    """
    if not location_str:
        return {"country": "", "state": "", "city": "", "is_remote": False, "is_india": False, "location_raw": ""}

    raw = location_str.strip()
    text = raw.lower().strip()
    result = {
        "country": "",
        "state": "",
        "city": "",
        "is_remote": False,
        "is_india": False,
        "location_raw": raw,
    }

    # Check remote
    for term in _REMOTE_TERMS:
        if term in text:
            result["is_remote"] = True
            break

    # Check country
    for name, code in _COUNTRY_MAP.items():
        if name in text:
            result["country"] = code
            break

    # Check India
    if result["country"] == "IN":
        result["is_india"] = True
    else:
        # Check via cities/states
        for city in _INDIA_CITIES:
            if city in text:
                result["is_india"] = True
                result["country"] = "IN"
                result["city"] = city.title()
                break

        if not result["is_india"]:
            for state in _INDIA_STATES:
                if state in text:
                    result["is_india"] = True
                    result["country"] = "IN"
                    result["state"] = state.title()
                    break

    # Check US cities/states
    if not result["country"]:
        for city in _US_CITIES:
            if city in text:
                result["country"] = "US"
                result["city"] = city.title()
                break

        if not result["country"]:
            for state in _US_STATES:
                if state in text:
                    result["country"] = "US"
                    result["state"] = state.title()
                    break

    # Check additional country cities (NL, IE, FR, NZ, MY, JP, GB, CA, DE, AU, SG)
    if not result["country"]:
        for ccode, cities in _COUNTRY_CITIES.items():
            for city in cities:
                if city in text:
                    result["country"] = ccode
                    result["city"] = city.title()
                    break
            if result["country"]:
                break

    # Try to extract city from comma-separated
    if not result["city"]:
        parts = [p.strip() for p in raw.split(",")]
        if len(parts) >= 1 and parts[0].lower() not in _REMOTE_TERMS:
            candidate = parts[0].strip()
            if len(candidate) > 1 and candidate.lower() not in {"remote", "hybrid", "on-site", "onsite"}:
                result["city"] = candidate

    # Try to extract state from parts
    if not result["state"] and len(raw.split(",")) >= 2:
        parts = [p.strip() for p in raw.split(",")]
        if len(parts) >= 2:
            result["state"] = parts[1].strip()

    return result


def is_india_job(title: str, location: str, company: str = "") -> bool:
    """Quick check if a job is India-based."""
    combined = f"{title} {location} {company}".lower()
    if any(c in combined for c in _INDIA_CITIES):
        return True
    if any(s in combined for s in _INDIA_STATES):
        return True
    if "india" in combined:
        return True
    return False


if __name__ == "__main__":
    tests = [
        "Bangalore, India",
        "San Francisco, CA",
        "Remote",
        "Mumbai, Maharashtra, India",
        "New York, NY, USA",
        "Gurugram, Haryana",
        "Remote - India",
        "London, UK",
        "Hyderabad",
        "",
    ]
    for t in tests:
        r = parse_location(t)
        print(f"  {t:35s} -> country={r['country']:3s} city={r['city']:20s} india={r['is_india']} remote={r['is_remote']}")
