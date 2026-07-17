#!/usr/bin/env python3
"""Fetch recent daily data (precip, etc.) for CoAgMET stations that have a lab soil
sample, and write soil/coagmet-daily.json. Validates each station ID against CoAgMET's
own metadata first and skips any that don't resolve, since a single unknown ID makes
the bulk endpoint reject the whole request (e.g. 'HYK01' from the soil spreadsheet no
longer matches any current CoAgMET station -- see 'hyk02' instead; flagged separately,
not silently substituted here).

Stdlib only (urllib/json) so it runs in the GitHub Actions runner with no extra deps.
"""
import json
import urllib.request

SPAN_DAYS = 90  # covers the site's 7/30/90-day selector; client slices the tail it needs
DAILY_URL = "https://coagmet.colostate.edu/data/daily.json?to=now&span={span}&stations={stations}"
METADATA_PATH = "soil/coagmet-metadata.json"

# CoAgMET station IDs (lowercase) for every station in soil/index.html's COAGMET_SOIL
# that has a lab soil sample. Kept as a literal list rather than parsed out of the HTML
# so this script doesn't depend on index.html's exact formatting.
# Note: the soil spreadsheet's "HYK01" was a typo for "hyk02" (Holyoke) -- corrected here
# and in index.html's COAGMET_SOIL key, not a station rename.
COAGMET_STATION_IDS = [
    "lam01", "ilf01", "hxt01", "wry02", "pai01", "wls01", "stg01", "yum02", "hyk02",
    "akr02", "eac01", "hly01", "krk01", "lsl01", "lcn01", "pkn01", "ksy01", "gby01",
    "bla01", "lam03", "brg01", "lms02", "brl02", "ctr01", "ctr02", "fwl01", "lbn01",
    "ign01", "hyd01", "hne01", "bnv01", "twc01", "sbt01", "san01", "wfd01", "nwd01",
    "yjk01", "dvc01", "ftc01", "ljr01", "oth01",
]


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    with open(METADATA_PATH, encoding="utf-8") as f:
        metadata = json.load(f)

    valid_ids = [sid for sid in COAGMET_STATION_IDS if sid in metadata]
    skipped = [sid for sid in COAGMET_STATION_IDS if sid not in metadata]
    if skipped:
        print(f"WARNING: skipping unknown CoAgMET station IDs (not in metadata): {skipped}")

    url = DAILY_URL.format(span=SPAN_DAYS, stations=",".join(valid_ids))
    data = fetch_json(url)

    with open("soil/coagmet-daily.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote soil/coagmet-daily.json for {len(valid_ids)} stations ({len(skipped)} skipped)")


if __name__ == "__main__":
    main()
