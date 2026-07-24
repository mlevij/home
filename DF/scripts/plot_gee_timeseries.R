# ============================================================
# Discovery Farms — Sentinel-1 & GRACE-FO Time Series Charts
# Reads the CSV exports from gee/soil_moisture_acquisition.js
# and renders monthly anomaly charts matching the style of the
# existing PDSI chart (assets/pdsi_timeseries_swco.png).
# ============================================================

library(tidyverse)
library(lubridate)

assets_dir <- "C:/Users/mlevij/repos/DF/assets"

region_caption <- "*Region: Delta, Dolores, Gunnison, La Plata, Mesa, Montezuma, Montrose, Ouray, San Miguel Counties"

# NASA's GRACE mascon products fix anomalies to this 2004-2009 window rather
# than a rolling/30-yr normal -- it's the baseline period baked into the
# mascon solution itself, and it happens to predate the 2010s-2020s Colorado
# River Basin megadroughts, so deficits below are relative to a period that
# wasn't itself unusually wet or dry.
baseline_note <- "Anomalies relative to NASA's fixed 2004-2009 GRACE baseline period (built into the mascon data product, predates the 2010s-2020s Colorado River Basin megadroughts)."

dry_color <- "#d73027"
wet_color <- "#4575b4"
trend_color <- "black"

# ------------------------------------------------------------
# Sentinel-1 — VH/VV ratio monthly anomaly
# ------------------------------------------------------------
# VH/VV ratio is a vegetation-density proxy (not soil moisture
# directly) — see gee/soil_moisture_acquisition.js comments.
# Anomaly = monthly ratio minus its own 2018-2025 mean, so the
# chart tells its own story rather than being forced onto the
# GRACE/PDSI drought scale.

s1 <- read_csv(file.path(assets_dir, "sentinel1_swco_timeseries.csv"), show_col_types = FALSE) %>%
  mutate(date = as_date(date)) %>%
  arrange(date) %>%
  mutate(
    ratio_anomaly = VH_VV - mean(VH_VV, na.rm = TRUE),
    sign = if_else(ratio_anomaly >= 0, "Denser vegetation than average", "Sparser vegetation than average")
  )

s1_trend <- lm(ratio_anomaly ~ as.numeric(date), data = s1)

p_s1 <- ggplot(s1, aes(x = date, y = ratio_anomaly)) +
  geom_col(aes(fill = sign), width = 25, color = NA) +
  geom_smooth(aes(group = 1), method = "lm", se = FALSE, color = trend_color,
              linetype = "dashed", linewidth = 0.8) +
  scale_fill_manual(values = c(
    "Denser vegetation than average" = wet_color,
    "Sparser vegetation than average" = dry_color
  )) +
  labs(
    title = "Sentinel-1 VH/VV Ratio Anomaly — SW Colorado Region*",
    subtitle = "Monthly vegetation-density signal vs. 2018-2025 average (Sentinel-1 SAR)",
    x = "Date", y = "VH/VV Anomaly (dB)", fill = NULL,
    caption = region_caption
  ) +
  theme_minimal(base_size = 14) +
  theme(
    legend.position = "top",
    plot.title = element_text(hjust = 0.5, size = 16),
    plot.subtitle = element_text(hjust = 0.5, color = "grey40"),
    plot.caption = element_text(hjust = 0, color = "grey50", size = 9)
  )

ggsave(file.path(assets_dir, "sentinel1_vh_vv_anomaly_swco.png"), p_s1, width = 14, height = 5, dpi = 150)

# ------------------------------------------------------------
# GRACE-FO — TWS anomaly (already baseline-relative, cm LWE)
# ------------------------------------------------------------
# lwe_thickness is already an anomaly vs. the 2004-2009 GRACE
# baseline (computed in the GEE script), so no further
# reprocessing is applied here — this is the raw satellite
# signal, distinct from the modeled GRACE-DA percentile maps
# shown elsewhere on the site.

grace <- read_csv(file.path(assets_dir, "grace_fo_swco_timeseries.csv"), show_col_types = FALSE) %>%
  mutate(date = as_date(date)) %>%
  arrange(date) %>%
  mutate(sign = if_else(lwe_thickness >= 0, "Surplus vs. 2004-2009 baseline", "Deficit vs. 2004-2009 baseline"))

p_grace <- ggplot(grace, aes(x = date, y = lwe_thickness)) +
  geom_col(aes(fill = sign), width = 25, color = NA) +
  geom_smooth(aes(group = 1), method = "lm", se = FALSE, color = trend_color,
              linetype = "dashed", linewidth = 0.8) +
  scale_fill_manual(values = c(
    "Surplus vs. 2004-2009 baseline" = wet_color,
    "Deficit vs. 2004-2009 baseline" = dry_color
  )) +
  labs(
    title = "GRACE-FO Water Storage Anomaly — SW Colorado Region*",
    subtitle = "Monthly total water storage (soil moisture + groundwater), raw mascon solution, 2018-2025",
    x = "Date", y = "TWS Anomaly (cm LWE)", fill = NULL,
    caption = paste0(region_caption, "\n", baseline_note,
                      "\n~25 km native resolution; gaps reflect months without a GRACE-FO solution.")
  ) +
  theme_minimal(base_size = 14) +
  theme(
    legend.position = "top",
    plot.title = element_text(hjust = 0.5, size = 16),
    plot.subtitle = element_text(hjust = 0.5, color = "grey40"),
    plot.caption = element_text(hjust = 0, color = "grey50", size = 9)
  )

ggsave(file.path(assets_dir, "grace_fo_tws_anomaly_swco.png"), p_grace, width = 14, height = 5, dpi = 150)

# ------------------------------------------------------------
# Surface / root zone / groundwater — water profile by depth
# ------------------------------------------------------------
# All three are raw anomalies (cm LWE) vs. the same 2004-2009 baseline as
# the TWS chart above, so they share one axis. Surface + root zone are pure
# GLDAS NOAH model output (no satellite gravity involved); groundwater is
# GRACE TWS minus the GLDAS-modeled correction (Rodell/Famiglietti method) --
# distinct from the GRACE-DA gws_inst percentile used on the live maps.
# Line chart (not bars) since the point here is the relative response speed
# across depths, not a wet/dry classification per month.

surface <- read_csv(file.path(assets_dir, "gldas_surface_swco_timeseries.csv"), show_col_types = FALSE) %>%
  transmute(date = as_date(date), anomaly = gldas_surface, layer = "Surface (0-10cm, GLDAS model)")

rootzone <- read_csv(file.path(assets_dir, "gldas_rootzone_swco_timeseries.csv"), show_col_types = FALSE) %>%
  transmute(date = as_date(date), anomaly = gldas_rootzone, layer = "Root Zone (0-100cm, GLDAS model)")

gws <- read_csv(file.path(assets_dir, "grace_gws_swco_timeseries.csv"), show_col_types = FALSE) %>%
  transmute(date = as_date(date), anomaly = lwe_thickness, layer = "Groundwater (GRACE minus GLDAS)")

profile <- bind_rows(surface, rootzone, gws) %>%
  mutate(layer = factor(layer, levels = c(
    "Surface (0-10cm, GLDAS model)",
    "Root Zone (0-100cm, GLDAS model)",
    "Groundwater (GRACE minus GLDAS)"
  ))) %>%
  arrange(date)

p_profile <- ggplot(profile, aes(x = date, y = anomaly, color = layer)) +
  geom_hline(yintercept = 0, color = "grey60", linewidth = 0.4) +
  geom_line(linewidth = 0.9) +
  scale_color_manual(values = c(
    "Surface (0-10cm, GLDAS model)" = "#9ecae1",
    "Root Zone (0-100cm, GLDAS model)" = "#4292c6",
    "Groundwater (GRACE minus GLDAS)" = "#08306b"
  )) +
  labs(
    title = "Water Storage Anomaly by Depth — SW Colorado Region*",
    subtitle = "Monthly surface, root-zone, and groundwater anomalies vs. 2004-2009 baseline, 2018-2025",
    x = "Date", y = "Anomaly (cm LWE)", color = NULL,
    caption = paste0(region_caption, "\n", baseline_note,
                      "\nSurface/root-zone are GLDAS model estimates, not direct satellite retrievals.")
  ) +
  theme_minimal(base_size = 14) +
  theme(
    legend.position = "top",
    plot.title = element_text(hjust = 0.5, size = 16),
    plot.subtitle = element_text(hjust = 0.5, color = "grey40"),
    plot.caption = element_text(hjust = 0, color = "grey50", size = 9)
  )

ggsave(file.path(assets_dir, "soil_water_profile_anomaly_swco.png"), p_profile, width = 14, height = 5, dpi = 150)

cat("Saved sentinel1_vh_vv_anomaly_swco.png, grace_fo_tws_anomaly_swco.png, and soil_water_profile_anomaly_swco.png to", assets_dir, "\n")
