# Surface Creek Transect — SNOTEL, gage, and diversion comparison

Compares Park Reservoir SNOTEL (snow water equivalent, precipitation) against the two USGS/DWR
stream gages on Surface Creek (SURCEDCO, SURACECO) and the 88 DWR-administered diversion
structures across the Surface Creek and Fruit Growers Reservoir HUC12s, Delta County, Colorado.

## Hydrologic year
Annual comparisons run November 1–October 31 rather than the calendar year. Diversion activity
in this basin is dormant roughly November–March and active April/May–October, so this window
keeps a winter's snow accumulation and the runoff season it feeds inside the same year. Peak SWE
turns out identical either way — the snowpack here always peaks February–April, safely inside
both framings — but the diversion and streamflow totals shift slightly under the correct window.

## Diverted volume
Figures come from DWR's own recorded annual diversion per structure. A reservoir's fill and a
downstream ditch's later re-diversion of that same released water are both recorded as separate
diversions, so total diverted volume runs several times higher than gaged streamflow — an
accounting characteristic of how Colorado records water use under prior appropriation, not an
error in this comparison. Treat diverted-volume totals as an index of diversion activity rather
than a physical water-balance quantity.

## Volume-equivalent SWE and runoff ratio
Peak SWE (inches) is a depth at one SNOTEL pillow; gaged/diverted volume (acre-feet) is summed
across the whole drainage area. Converting between them uses each gage's official USGS drainage
area (SURCEDCO 27.4 sq mi, SURACECO 38.5 sq mi). The resulting runoff ratio (gaged volume,
converted to inches over the drainage area, divided by total precipitation) runs 0.13–0.38 for
SURACECO alone — a plausible range for a semi-arid mountain watershed. Including diverted volume
in the numerator pushes the ratio above 1 in wetter years, consistent with the reuse pattern
described above.

## Basin routing
Each structure is tagged as upstream of both gages, between the two gages, downstream of both, or
in the separate Fruit Growers Reservoir–Gunnison River HUC12. This was traced through the USGS 3D
Hydrography Program flowline network, clipped to the two relevant HUC12 boundaries, rather than
from DWR's own recorded water source for each structure — that field reflects what stream a water
right is legally decreed against, which doesn't always match the creek a structure physically
sits on. Two structures administratively tied to Surface Creek (Dreyfus Reservoir, Carbonate Camp
Reservoir No. 3) turned out to sit on Milk Creek instead, found by locating Milk Creek's actual
confluence with Surface Creek along the flowline network — it falls between the two gages, not
upstream of either.

With that routing, the gaged + upstream-diverted runoff ratio comes out at 0.80–1.29 for SURCEDCO
and 0.71–1.23 for SURACECO (2016–2025), each summing only the structures actually upstream of
that gage (43 for SURCEDCO, 76 for SURACECO) rather than all 88.

## Water-rights priority and size effects
Structures were grouped by seniority (water-right admin number), decreed water-right size, and
actual average diverted volume, to see whether any of these explain why total diverted volume
tracks SWE more weakly (r = 0.81, 2016–2025, all 88 structures) than gaged flow does (r = 0.98).

This analysis uses a longer 1979–2025 window, bounded by the Park Reservoir SNOTEL station's own
period of record, and a 45-structure subset with a diverted-volume record in every one of those
47 years, so each tier sums a consistent set of structures rather than a shifting one year to
year. Diverted volume across structures is right-skewed, so results are reported as raw Pearson
r, log-transformed Pearson r, and Spearman rank correlation together.

In two of the three rankings, large/senior structures correlate with SWE more weakly than
small/junior ones — a large, senior reservoir tends to receive its decreed water close to every
year regardless of that year's snowpack, since storage and operational decisions drive its
year-to-year behavior more than water availability does; a small, junior ditch has no storage
buffer and no seniority protection, so it draws whatever's physically available that year, a more
direct response to actual conditions.

## Other data-quality notes
- DWR's raw daily gage feed uses -999 as a missing-value sentinel on occasion; converted to
  missing before aggregating rather than treated as a literal (and physically impossible)
  negative flow.
- SURCEDCO reports April–October only; that's how the gage is operated, not a data gap.
- Three structures have no diverted-volume data in the 2016–2025 window: one (HEYN PUMP) has no
  diversion record on file at all, two (Hidden Mesa P/A POD, Lowrance Pump) stop reporting in
  2015.
- A few Fruit Growers sub-basin structures draw from Cedar Run or Poison Gulch rather than
  Surface Creek itself, grouped with that HUC12 in the source documentation.
