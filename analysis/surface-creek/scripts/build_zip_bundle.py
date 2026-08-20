"""
Bundle the user-facing data files in data/ into data/surface_creek_data_files.zip --
run this as the last step whenever any of the individual export files change, so the
bundle stays in sync with them.

Only includes the files listed individually in the page's Downloads menu (CSV + XLSX).
The chart PNGs aren't included here since they're rendered client-side at download time
(see the "All" download handler in index.html, which merges this zip with freshly-rendered
chart images) -- and the .json files are the page's own internal data contract, not a
portable export layer.
"""
import os
import zipfile

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUT_ZIP = os.path.join(DATA_DIR, "surface_creek_data_files.zip")
INCLUDE = {
    "surface_creek_gage_relative_water_balance_1979-2025.csv",
    "surface_creek_priority_ranking_correlations_extended.csv",
    "surface_creek_structures.csv",
    "surface_creek_monthly_2016-2025.csv",
    "surface_creek_monthly_1979-2025.csv",
    "surface_creek_snowmelt_streamflow_lag.csv",
    "surface_creek_soil_moisture_swe_lag.csv",
    "Surface_Creek_Data_2016-2025.xlsx",
}


def build():
    files = [f for f in INCLUDE if os.path.isfile(os.path.join(DATA_DIR, f))]
    missing = INCLUDE - set(files)
    if missing:
        print(f"WARNING: expected but not found, skipping: {sorted(missing)}")
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(os.path.join(DATA_DIR, f), arcname=f)
    print(f"Bundled {len(files)} files into {OUT_ZIP}:")
    for f in sorted(files):
        print(f"  {f}")


if __name__ == "__main__":
    build()
