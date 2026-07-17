#!/usr/bin/env python3
"""Fetch CoAgMET hourly soil moisture data and aggregate it to daily means, writing
soil/soilmoisture.json. CoAgMET's own daily-aggregated soil moisture product is empty
(-999 sentinel) for nearly every station -- confirmed by direct testing, only 'oth01'
had real data there -- but the raw hourly readings are populated for 37 of our 41
lab-sampled CoAgMET stations. Aggregating ourselves keeps the file at daily cadence
(matching every other network) while actually having real data.

Output schema matches the file's previous shape exactly (top-level which/frequency/
timestep/.../stations/time, then one key per station with vwc4/ec4/st4/vwc24/ec24/st24
arrays) so no client-side changes are needed -- index.html reads this file unchanged.

Stdlib only (urllib/json) so it runs in the GitHub Actions runner with no extra deps.
"""
import json
import urllib.request
from collections import defaultdict

SPAN_DAYS = 90
HOURLY_URL = "https://coagmet.colostate.edu/data/hourly/soilmoisture.json?to=now&span={span}"
FIELDS = ["vwc4", "ec4", "st4", "vwc24", "ec24", "st24"]


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def daily_mean(times, values):
    """Group hourly (timestamp, value) pairs by date, mean the valid (non-null,
    non-sentinel) readings per day. Returns (dates_sorted, means_aligned)."""
    by_date = defaultdict(list)
    for t, v in zip(times, values):
        if v is None or v <= -900:
            continue
        date = t[:10]
        by_date[date].append(v)
    dates = sorted(by_date.keys())
    means = [round(sum(by_date[d]) / len(by_date[d]), 4) if by_date[d] else None for d in dates]
    return dates, means


def main():
    data = fetch_json(HOURLY_URL.format(span=SPAN_DAYS))
    hourly_times = data.get("time", [])
    stations = data.get("stations", [])

    # Daily date axis: derive from the hourly timestamps themselves so it's never out
    # of sync with what was actually aggregated (rather than assuming exactly SPAN_DAYS
    # distinct calendar days).
    all_dates = sorted({t[:10] for t in hourly_times})

    out = {
        "which": data.get("which", "qc"),
        "frequency": "daily",
        "timestep": 86400,
        "timezone": data.get("timezone"),
        "tzOffset": data.get("tzOffset"),
        "units": data.get("units"),
        "today": data.get("today"),
        "stations": stations,
        "time": all_dates,
    }

    for sid in stations:
        st = data.get(sid, {})
        station_out = {}
        for field in FIELDS:
            vals = st.get(field, [])
            dates, means = daily_mean(hourly_times, vals)
            by_date = dict(zip(dates, means))
            station_out[field] = [by_date.get(d) for d in all_dates]
        out[sid] = station_out

    with open("soil/soilmoisture.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print(f"Wrote soil/soilmoisture.json: {len(stations)} stations, {len(all_dates)} days")


if __name__ == "__main__":
    main()
