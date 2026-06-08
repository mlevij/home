// ============================================================
// Discovery Farms — Soil Moisture Monitoring
// Sentinel-1 SAR (VV, VH, VH/VV) + GRACE-FO TWS Anomalies
// SW Colorado (9-county region) | Google Earth Engine
// ============================================================

// --- Study Area (9 SW Colorado counties) ---
var swColorado = ee.Geometry.Rectangle([-109.0602, 36.9988, -106.2453, 39.3667]);

// --- Date range ---
// GRACE-FO launched June 2018; use 2018+ for combined analysis.
// For Sentinel-1 only, push startYear back to 2015.
var startYear = 2018;
var endYear   = 2025;
var startDate = ee.Date.fromYMD(startYear, 1, 1);
var endDate   = ee.Date.fromYMD(endYear, 12, 31);


// ============================================================
// SENTINEL-1 SAR
// ============================================================
// VV: sensitive to surface dielectric (soil moisture signal)
// VH: sensitive to volume scattering (vegetation structure)
// VH/VV ratio: partially cancels vegetation effects, isolates soil signal
//
// Ascending pass only for geometric consistency across dates.
// Process: dB → linear for averaging → back to dB per monthly composite.

var s1Raw = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(swColorado)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'))
  .select(['VV', 'VH']);

var toLinear = function(img) {
  return ee.Image(10).pow(img.divide(10))
    .set('system:time_start', img.get('system:time_start'));
};

var toDb = function(img) {
  return img.log10().multiply(10)
    .set('system:time_start', img.get('system:time_start'));
};

// Add VH/VV ratio band (in linear space, then convert to dB)
var addRatio = function(img) {
  var linear = toLinear(img);
  var ratio  = linear.select('VH').divide(linear.select('VV')).rename('VH_VV');
  var ratioDb = ratio.log10().multiply(10);
  return img.addBands(ratioDb)
    .copyProperties(img, ['system:time_start']);
};

var s1WithRatio = s1Raw.map(addRatio);
print('✓ S1 raw collection filtered:', s1Raw.size(), 'scenes');

// Speckle reduction via focal mean (100m window)
var applyFocalMean = function(img) {
  return img.focal_mean(100, 'circle', 'meters')
    .copyProperties(img, img.propertyNames());
};

// Monthly composites (mean in linear space → back to dB)
// Tag each scene with YYYY-MM so we only process months that have data.
var s1Tagged = s1WithRatio.map(function(img) {
  var d = ee.Date(img.get('system:time_start'));
  return img.set('year_month', d.format('YYYY-MM'));
});

var ymList = s1Tagged.aggregate_array('year_month').distinct().sort();
print('✓ Distinct year-months with S1 data:', ymList.size());

var monthlyS1 = ee.ImageCollection(ymList.map(function(ym) {
  var subset = s1Tagged.filter(ee.Filter.eq('year_month', ym));
  var d = ee.Date(subset.first().get('system:time_start')).update(null, null, 1);

  // Average VV and VH in linear space
  var linearMean = subset.map(toLinear).mean();
  var dbMean     = linearMean.log10().multiply(10);

  // Ratio from averaged linear values to cancel vegetation effects
  var linForRatio = subset.map(function(img) {
    return toLinear(img).select(['VH', 'VV']);
  }).mean();
  var ratioDb = linForRatio.select('VH').divide(linForRatio.select('VV'))
    .log10().multiply(10).rename('VH_VV');

  return dbMean.select(['VV', 'VH']).addBands(ratioDb)
    .clip(swColorado)
    .set('year_month', ym)
    .set('system:time_start', d.millis());
}));

var monthlyS1Smooth = monthlyS1.map(applyFocalMean);
print('✓ Monthly S1 composites built (one per month above)');

// Visualization params (used by export tasks below)
// VV/VH: red = dry (low backscatter) → blue = wet (high backscatter)
var vvVizParams = {
  bands: ['VV'], min: -25, max: -5,
  palette: ['#d73027','#fc8d59','#fee090','#e0f3f8','#74add1','#4575b4']
};
var vhVizParams = {
  bands: ['VH'], min: -30, max: -10,
  palette: ['#d73027','#fc8d59','#fee090','#e0f3f8','#74add1','#4575b4']
};
// VH/VV ratio: lower ratio = more soil-dominated signal
var ratioVizParams = {
  bands: ['VH_VV'], min: -15, max: -5,
  palette: ['#f7f7f7','#d9f0d3','#7fbf7b','#1b7837']
};

Map.centerObject(swColorado, 8);


// ============================================================
// GRACE-FO — Terrestrial Water Storage Anomalies
// ============================================================
// Mascon CRI solution: best spatial accuracy for regional analysis.
// lwe_thickness = liquid water equivalent (cm), monthly cadence.
// Anomalies relative to the standard 2004–2009 GRACE baseline.
//
// NOTE: ~12-month data gap between GRACE (ended ~Jun 2017) and
// GRACE-FO (started Jun 2018). Missing months appear as gaps in charts.

var graceFull = ee.ImageCollection('NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI')
  .select('lwe_thickness');

var graceBaseline = graceFull
  .filterDate('2004-01-01', '2009-12-31')
  .mean();

var grace = graceFull
  .filterDate(startDate, endDate)
  .filterBounds(swColorado);

var graceAnomalies = grace.map(function(img) {
  return img.subtract(graceBaseline)
    .clip(swColorado)
    .copyProperties(img, ['system:time_start']);
});
print('✓ GRACE-FO anomaly images:', graceAnomalies.size());

// Brown = deficit → teal = surplus
var graceVizParams = {
  min: -25, max: 25,
  palette: ['#8c510a','#d8b365','#f6e8c3','#f5f5f5','#c7eae5','#5ab4ac','#01665e']
};


// ============================================================
// EXPORT — Time Series CSVs for R Analysis
// ============================================================
// Each row = one monthly composite, reduced to regional mean.
// Import into R for trendlines, correlation plots, etc.

// Sentinel-1: VV, VH, and VH/VV ratio at 1km resolution
var s1TimeSeries = ee.FeatureCollection(
  monthlyS1Smooth.map(function(img) {
    var stats = img.select(['VV', 'VH', 'VH_VV']).reduceRegion({
      reducer:  ee.Reducer.mean(),
      geometry: swColorado,
      scale:    1000,
      maxPixels: 1e9
    });
    return ee.Feature(null, stats)
      .set('date',       ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'))
      .set('year_month', img.get('year_month'));
  })
);

Export.table.toDrive({
  collection:     s1TimeSeries,
  description:    'sentinel1_timeseries_swco',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'sentinel1_swco_timeseries',
  fileFormat:     'CSV'
});

// GRACE-FO: TWS anomaly (cm LWE) at native ~25km resolution
var graceTimeSeries = ee.FeatureCollection(
  graceAnomalies.map(function(img) {
    var stats = img.reduceRegion({
      reducer:  ee.Reducer.mean(),
      geometry: swColorado,
      scale:    25000,
      maxPixels: 1e9
    });
    return ee.Feature(null, stats)
      .set('date', ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'));
  })
);

Export.table.toDrive({
  collection:     graceTimeSeries,
  description:    'grace_fo_timeseries_swco',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'grace_fo_swco_timeseries',
  fileFormat:     'CSV'
});

print('✓ CSV export tasks queued (Sentinel-1 + GRACE-FO time series)');


// ============================================================
// EXPORT — Monthly Animations to Google Drive
// ============================================================

var s1VVFrames = monthlyS1Smooth.sort('system:time_start').map(function(img) {
  return img.visualize(vvVizParams);
});

print('✓ Export tasks queued — check the Tasks tab to run them');

Export.video.toDrive({
  collection:     s1VVFrames,
  description:    'sentinel1_vv_swco_animation',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'sentinel1_swco_vv_monthly',
  framesPerSecond: 2,
  region:         swColorado,
  scale:          250,
  maxFrames:      300
});

var s1RatioFrames = monthlyS1Smooth.sort('system:time_start').map(function(img) {
  return img.visualize(ratioVizParams);
});

Export.video.toDrive({
  collection:     s1RatioFrames,
  description:    'sentinel1_ratio_swco_animation',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'sentinel1_swco_ratio_monthly',
  framesPerSecond: 2,
  region:         swColorado,
  scale:          250,
  maxFrames:      300
});

var graceFrames = graceAnomalies.sort('system:time_start').map(function(img) {
  return img.visualize(graceVizParams);
});

// GRACE native res is ~55km — use dimensions rather than scale
// to force a viewable frame size. Output will be interpolated
// (appropriate for coarse gravity-based data).
Export.video.toDrive({
  collection:      graceFrames,
  description:     'grace_fo_tws_swco_animation',
  folder:          'DiscoveryFarms_GEE',
  fileNamePrefix:  'grace_fo_swco_tws_monthly',
  framesPerSecond: 2,
  region:          swColorado,
  dimensions:      800,
  maxFrames:       300
});




// ============================================================
// LEGEND PANELS
// ============================================================

function makeLegend(title, palette, minLabel, maxLabel) {
  var panel = ui.Panel({style: {position: 'bottom-left', padding: '8px 15px'}});
  panel.add(ui.Label(title, {fontWeight: 'bold', fontSize: '12px', margin: '0 0 4px 0'}));

  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0)
      .unitScale(0, 360)
      .multiply(palette.length - 1)
      .int(),
    params: {
      bbox: [0, 0, 1, 0.1], dimensions: '180x15',
      format: 'png', min: 0, max: palette.length - 1, palette: palette
    },
    style: {stretch: 'horizontal', margin: '0 8px'}
  });
  panel.add(colorBar);

  panel.add(ui.Panel({
    widgets: [
      ui.Label(minLabel, {fontSize: '10px', margin: '2px 0 0 8px'}),
      ui.Label(maxLabel, {fontSize: '10px', margin: '2px 8px 0 0', textAlign: 'right'})
    ],
    layout: ui.Panel.Layout.flow('horizontal')
  }));

  return panel;
}

Map.add(makeLegend(
  'Sentinel-1 VV (dB)',
  ['#d73027','#fc8d59','#fee090','#e0f3f8','#74add1','#4575b4'],
  'Dry  −25', 'Wet  −5'
));

Map.add(makeLegend(
  'GRACE-FO TWS Anomaly (cm LWE)',
  ['#8c510a','#d8b365','#f6e8c3','#f5f5f5','#c7eae5','#5ab4ac','#01665e'],
  'Deficit  −25', 'Surplus  +25'
));
