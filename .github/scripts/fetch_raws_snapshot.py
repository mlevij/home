#!/usr/bin/env python3
"""Fetch latest live soil moisture + recent precip for RAWS stations that have a lab
soil sample, and write soil/raws-snapshot.json. Mirrors the resolve-by-name pattern
used client-side in soil/index.html's loadRAWS(), since NIFC's NESS IDs are not stable
enough to hardcode.

Stdlib only (urllib/json) so it runs in the GitHub Actions runner with no extra deps.
"""
import json
import urllib.request
from datetime import datetime, timedelta, timezone

STATBASELINE_URL = "https://weather.nifc.gov/ords/prd/wx/station/statbaseline/0"
DATA_RANGE_URL = "https://weather.nifc.gov/ords/prd/wx/station/dataNesdisidRange/{start}/{end}/{nessid}"
WINDOW_DAYS = 7  # matches CoAgMET's 7-day precip sum in fetch_coagmet_daily.py

# (NIFC station name, soil-sample key in RAWS_SOIL) — the 18 RAWS stations with a lab
# sample, cross-referenced from soil/index.html's RAWS_NETWORK `soilKey` entries. Names
# differ from the soil key in three cases (NIFC vs. soil CSV naming), same mismatches
# as RAWS_SOIL_KEY in soil/index.html.
NIFC_NAME_TO_SOIL_KEY = [
    ("BLACK MOUNTAIN", "BLACK MOUNTAIN"),
    ("BOSQUE", "BOSQUE"),
    ("BUCKLES", "BUCKLES"),
    ("CHEESMAN", "CHEESEMAN"),
    ("CORRAL CREEK", "CORRAL CREEK"),
    ("ESTES PARK", "ESTES PARK"),
    ("FT CARSON", "FT CARSON"),
    ("GRAND MESA", "GRAND MESA"),
    ("HARBISON MEADOW", "HARBISON"),
    ("LODGE POLE FLATS", "LODGEPOLE FLATS"),
    ("PINION CANYON", "PINION CANYON"),
    ("RED CREEK", "RED CREEK"),
    ("RED DEER", "RED DEER"),
    ("REDSTONE", "REDSTONE"),
    ("SANBORN PARK", "SANBORN PARK"),
    ("SILVER JACK", "SILVER JACK"),
    ("UTE CANYON", "UTE CANYON"),
    ("WILLIS CREEK", "WILLIS CREEK"),
]


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def fmt_nifc(dt):
    return dt.strftime("%Y%m%d%H%M%S")


def resolve_nessids():
    data = fetch_json(STATBASELINE_URL)
    stations = data.get("station_archive_baseline", [])
    by_name = {}
    for s in stations:
        if s.get("State") == "CO" and s.get("Status") == "A" and s.get("NESS ID"):
            by_name[s["Name"]] = s["NESS ID"]
    return by_name


def latest_value(records, abbr):
    for r in reversed(records):
        for obs in r.get("Observations", []):
            if obs.get("Abbr") == abbr and obs.get("Value") not in (None, ""):
                try:
                    return float(obs["Value"])
                except ValueError:
                    continue
    return None


def precip_delta(records):
    vals = []
    for r in records:
        for obs in r.get("Observations", []):
            if obs.get("Abbr") == "RNIN" and obs.get("Value") not in (None, ""):
                try:
                    vals.append(float(obs["Value"]))
                except ValueError:
                    continue
    if len(vals) < 2:
        return None
    return round(max(vals) - min(vals), 3)


def main():
    by_name = resolve_nessids()
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=WINDOW_DAYS)

    out = {"generated": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "stations": {}}
    for nifc_name, soil_key in NIFC_NAME_TO_SOIL_KEY:
        nessid = by_name.get(nifc_name)
        if not nessid:
            print(f"WARNING: no active NESS ID found for '{nifc_name}', skipping")
            continue
        url = DATA_RANGE_URL.format(start=fmt_nifc(start), end=fmt_nifc(now), nessid=nessid)
        try:
            data = fetch_json(url)
        except Exception as e:
            print(f"WARNING: fetch failed for '{nifc_name}' ({nessid}): {e}")
            continue
        records = data.get("Data", [])
        if not records:
            continue

        out["stations"][soil_key] = {
            "vwc2": latest_value(records, "SMF"),
            "vwc8": latest_value(records, "SMF2"),
            "vwc20": latest_value(records, "SMF3"),
            "precip_recent_in": precip_delta(records),
        }

    with open("soil/raws-snapshot.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote soil/raws-snapshot.json with {len(out['stations'])} stations")


if __name__ == "__main__":
    main()
