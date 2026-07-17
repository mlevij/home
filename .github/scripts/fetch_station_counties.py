#!/usr/bin/env python3
"""One-time/occasional lookup: reverse-geocode CoAgMET and Zentra station coordinates
to their county via the FCC Area API (free, no key). Writes soil/station-counties.json.

NOT part of the daily update-soil-moisture.yml workflow -- station coordinates are
static, so re-running this on every scheduled run would just hammer a free public API
for data that essentially never changes. Re-run manually only when new stations are
added to COAGMET_NETWORK or ZENTRA_SITES in soil/index.html.

RAWS and SNOTEL already get county natively from their own APIs (NIFC statbaseline's
'County' field, AWDB's 'countyName') -- this script only covers the two networks whose
APIs don't provide it at all.

Stdlib only (urllib/json/re/time) so it can run anywhere, no extra deps.
"""
import json
import re
import time
import urllib.request

FCC_URL = "https://geo.fcc.gov/api/census/area?lat={lat}&lon={lon}&format=json"
INDEX_HTML = "soil/index.html"
OUT_PATH = "soil/station-counties.json"


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def county_for(lat, lon):
    data = fetch_json(FCC_URL.format(lat=lat, lon=lon))
    results = data.get("results") or []
    if not results:
        return None
    return results[0].get("county_name")  # e.g. "Weld County" -- already includes "County"


def extract_coagmet_stations(html):
    start = html.index("const COAGMET_NETWORK = [")
    end = html.index("];", start)
    block = html[start:end]
    return re.findall(r'\{id:"([^"]+)",name:"[^"]+",lat:([\-\d.]+),lon:([\-\d.]+)\}', block)


def extract_zentra_sites(html):
    start = html.index("const ZENTRA_SITES = [")
    end = html.index("];", start)
    block = html[start:end]
    return re.findall(r"key:\s*'([^']+)'.*?lat:\s*([\-\d.]+),\s*lon:\s*([\-\d.]+)", block)


def main():
    html = open(INDEX_HTML, encoding="utf-8").read()
    coagmet = extract_coagmet_stations(html)
    zentra = extract_zentra_sites(html)
    print(f"Found {len(coagmet)} CoAgMET stations, {len(zentra)} Zentra sites")

    out = {"coagmet": {}, "zentra": {}}
    for sid, lat, lon in coagmet:
        try:
            out["coagmet"][sid] = county_for(float(lat), float(lon))
        except Exception as e:
            print(f"WARNING: county lookup failed for CoAgMET {sid}: {e}")
            out["coagmet"][sid] = None
        time.sleep(0.2)  # polite pacing, free public API

    for key, lat, lon in zentra:
        try:
            out["zentra"][key] = county_for(float(lat), float(lon))
        except Exception as e:
            print(f"WARNING: county lookup failed for Zentra {key}: {e}")
            out["zentra"][key] = None
        time.sleep(0.2)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
