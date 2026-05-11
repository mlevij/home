# mlevij.com — GitHub Pages Repository

Personal research site for Levi Johnson, Graduate Researcher at Colorado State University.  
Live at **[mlevij.com](https://mlevij.com)** · Hosted on GitHub Pages.

---

## Repository Structure

| Path | Description |
|------|-------------|
| `index.html` | Landing page — links to all projects |
| `AES/` | AES Research Center Soil Map |
| `DF/` | Discovery Farms Drought Story Map |
| `soil/` | Colorado Soil Health Monitoring |

---

## Projects

### AES Research Center Soil Map (`/AES/`)
Interactive soil maps for Colorado State University Agricultural Experiment Station (AES) research centers, built with SSURGO data. Covers 10 research stations across Colorado. Includes a soil profile visualization tool (`aes-data.html`) with texture, pH, and water retention charts per station.

**Stack:** ArcGIS JS API 4.28 · Tailwind CSS · Chart.js

---

### Discovery Farms Drought Story Map (`/DF/`)
Visualizes drought conditions and vegetation change across SW Colorado Discovery Farms research sites from 1984 to present. Built as a scrolling story map with Leaflet.

**Stack:** Leaflet · Tailwind CSS

---

### Colorado Soil Health Monitoring (`/soil/`)
Summary of the 2025 soil sampling season across CoAgMET and RAWS network sites in Colorado. Displays soil texture, pH, EC, carbon, nitrogen, and Saxton-Rawls water properties by depth increment. Includes a live Leaflet map with toggleable network layers and a live soil moisture chart for stations with active sensors.

**Data sources:**
- CoAgMET network — 41 soil monitoring sites, static snapshot (~127 network stations)
- RAWS network — 18 soil monitoring sites, live from NIFC API

**Stack:** Leaflet 1.9.4 · Chart.js · Tailwind CSS
