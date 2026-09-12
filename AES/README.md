# AES Research Center Soil Map

Interactive soil map for Colorado State University Agricultural Experiment Station (AES) research centers, built with SSURGO data. Single-page site: full-page map with collapsible panels (basemap, research centers, map-unit legend, soil characteristics) and a bottom data panel with per-map-unit and research-center-level soil property charts.

## Overview
- 10 AES research stations across Colorado
- SSURGO soil data, exported once from ArcGIS Online Feature Server into local GeoJSON (`data/aes_soils.geojson`, `data/co_border.geojson`) — no live REST dependency at runtime
- Soil profile visualization powered by NRCS OSD Munsell color data (`all_stations_profiles.json`), with a hover glossary explaining each horizon designation (e.g. Bt, Ap, Btk)

## Files
- `index.html` — the version served live at mlevij.com/AES/, with the CSU/AES logo banner
- `index-it.html` — banner-less copy held for eventual hosting on CSU's own server (WordPress-embedded)

## Stack
- Leaflet
- Chart.js, Feather Icons
- Tailwind CSS (CDN)
- Hosted on GitHub / Cloudflare