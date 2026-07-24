// ============================================================
// Discovery Farms — Soil Moisture Monitoring
// Sentinel-1 SAR (VV, VH, VH/VV) + GRACE-FO TWS Anomalies
// SW Colorado (9-county region) | Google Earth Engine
// ============================================================

// --- Study Area (9 SW Colorado counties) ---
var swColorado = ee.Geometry.Rectangle([-109.0602, 36.9988, -106.2453, 39.3667]);

// Four Corners region (kept for reference)
var fourCorners = ee.Geometry.Rectangle([-115.0, 31.0, -101.5, 42.5]);

// CONUS extent for GRACE animation
var conus = ee.Geometry.Rectangle([-125.0, 24.5, -66.5, 49.5]);

// Colorado state boundary for PALSAR-2 exports
var colorado = ee.FeatureCollection('TIGER/2018/States')
  .filter(ee.Filter.eq('NAME', 'Colorado'))
  .geometry();

// --- Date range ---
// GRACE-FO launched June 2018; use 2018+ for combined analysis.
// For Sentinel-1 only, push startYear back to 2015.
var startYear = 2018;
var endYear   = 2025;
var startDate = ee.Date.fromYMD(startYear, 1, 1);
var endDate   = ee.Date.fromYMD(endYear, 12, 31);


// ============================================================
// PALSAR-2 ScanSAR (JAXA ALOS-2) — L-band SAR
// ============================================================
// L-band (1.27 GHz) penetrates vegetation canopy far better than
// Sentinel-1 C-band (5.4 GHz), making it more reliable for soil
// moisture under forests and dense crops (e.g. Grand Mesa spruce/fir).
//
// Collection is heterogeneous — filter to HH+HV dual-pol images only.
// DN → γ°(dB): 10 * log10(DN²) − 83  (PALSAR-2 calibration constant)
// HH: primary soil moisture signal (co-polarization)
// HV: volume scattering (vegetation); HH/HV ratio isolates soil signal

var palsarRaw = ee.ImageCollection('JAXA/ALOS/PALSAR-2/Level2_2/ScanSAR')
  .filterBounds(colorado)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.listContains('Polarizations', 'HH'))
  .filter(ee.Filter.listContains('Polarizations', 'HV'))
  .select(['HH', 'HV']);

print('✓ PALSAR-2 scenes over Colorado:', palsarRaw.size());

var palsarToDb = function(img) {
  return img.pow(2).log10().multiply(10).subtract(83)
    .copyProperties(img, ['system:time_start']);
};

var palsarTagged = palsarRaw.map(palsarToDb).map(function(img) {
  var d = ee.Date(img.get('system:time_start'));
  return img.set('year_month', d.format('YYYY-MM'));
});

var palsarYmList = palsarTagged.aggregate_array('year_month').distinct().sort();
print('✓ Distinct year-months with PALSAR-2 data:', palsarYmList.size());

// Monthly composites in linear space → back to dB
var palsarToLinear = function(img) {
  return ee.Image(10).pow(img.divide(10))
    .copyProperties(img, ['system:time_start', 'year_month']);
};

var monthlyPalsar = ee.ImageCollection(palsarYmList.map(function(ym) {
  var subset = palsarTagged.filter(ee.Filter.eq('year_month', ym));
  var d = ee.Date(subset.first().get('system:time_start')).update(null, null, 1);
  var linearMean = subset.map(palsarToLinear).mean();
  var dbMean = linearMean.log10().multiply(10);
  var ratioDb = linearMean.select('HH').divide(linearMean.select('HV'))
    .log10().multiply(10).rename('HH_HV');
  return dbMean.addBands(ratioDb)
    .clip(colorado)
    .set('year_month', ym)
    .set('system:time_start', d.millis());
}));

print('✓ Monthly PALSAR-2 composites:', monthlyPalsar.size());

// HH: red (dry) → green (wet), same convention as S1 VV
var palsarHHVizParams = {
  bands: ['HH'], min: -25, max: -5,
  palette: ['#d73027','#fc8d59','#fee090','#d9f0a3','#78c679','#1a9641']
};
// HH/HV ratio: lower = more soil-dominated signal
var palsarRatioVizParams = {
  bands: ['HH_HV'], min: -10, max: 5,
  palette: ['#f7f7f7','#d9f0d3','#7fbf7b','#1b7837']
};


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
  palette: ['#d73027','#fc8d59','#fee090','#e0f3f8','#74add1','#4575b4']  // was red->green; fixed to match comment (red=dry, blue=wet)
};
var vhVizParams = {
  bands: ['VH'], min: -30, max: -10,
  palette: ['#d73027','#fc8d59','#fee090','#e0f3f8','#74add1','#4575b4']
};
// VH/VV ratio is fundamentally a vegetation-density proxy (cross-pol scattering
// increases with canopy volume), not a direct soil-moisture measurement — so this
// uses a vegetation-style ramp instead of the GRACE wet/dry convention.
// Red (low ratio, sparse/bare-soil-dominated) -> yellow -> green (high ratio, denser vegetation).
var ratioVizParams = {
  bands: ['VH_VV'], min: -15, max: -5,
  palette: ['#d73027','#fc8d59','#fee090','#d9f0a3','#78c679','#1a9641']
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
  .filterBounds(conus);

var graceAnomalies = grace.map(function(img) {
  return img.subtract(graceBaseline)
    .clip(conus)
    .copyProperties(img, ['system:time_start'])
    .set('year_month', ee.Date(img.get('system:time_start')).format('YYYY-MM'));
});
print('✓ GRACE-FO anomaly images:', graceAnomalies.size());

// Brown = deficit → teal = surplus
var graceVizParams = {
  min: -25, max: 25,
  palette: ['#8c510a','#d8b365','#f6e8c3','#f5f5f5','#c7eae5','#5ab4ac','#01665e']
};


// ============================================================
// GLDAS NOAH — Groundwater Storage Isolation
// ============================================================
// Subtract GLDAS-modeled SM + SWE + canopy from GRACE TWS anomaly to
// isolate groundwater storage (GWS) — Rodell/Famiglietti method.
// GLDAS bands in kg/m²; divide by 10 to convert to cm LWE (GRACE units).

// Also break out surface (0-10cm) and root zone (0-100cm) soil moisture as
// their own raw anomaly bands — same baseline/units as the TWS anomaly so
// all three (surface, root zone, groundwater) sit on one shared cm-LWE axis.
var gldasTWS = ee.ImageCollection('NASA/GLDAS/V021/NOAH/G025/T3H')
  .filterBounds(conus)
  .select(['SoilMoi0_10cm_inst','SoilMoi10_40cm_inst',
           'SoilMoi40_100cm_inst','SoilMoi100_200cm_inst',
           'SWE_inst','CanopInt_inst'])
  .map(function(img) {
    var surface = img.select('SoilMoi0_10cm_inst').divide(10).rename('gldas_surface');
    var rootZone = img.select('SoilMoi0_10cm_inst')
      .add(img.select('SoilMoi10_40cm_inst'))
      .add(img.select('SoilMoi40_100cm_inst'))
      .divide(10).rename('gldas_rootzone');
    var total = img.select('SoilMoi0_10cm_inst')
      .add(img.select('SoilMoi10_40cm_inst'))
      .add(img.select('SoilMoi40_100cm_inst'))
      .add(img.select('SoilMoi100_200cm_inst'))
      .add(img.select('SWE_inst'))
      .add(img.select('CanopInt_inst'))
      .divide(10).rename('gldas_tws');
    return surface.addBands(rootZone).addBands(total)
      .copyProperties(img, ['system:time_start'])
      .set('year_month', ee.Date(img.get('system:time_start')).format('YYYY-MM'));
  });

// 2004–2009 baseline (matches GRACE baseline)
var gldasForBaseline = gldasTWS.filterDate('2004-01-01', '2009-12-31');
var gldasBaseline = gldasForBaseline.mean();

// Monthly means for analysis period, anomaly relative to baseline
var gldasForAnalysis = gldasTWS.filterDate(startDate, endDate);
var gldasYmList = gldasForAnalysis.aggregate_array('year_month').distinct().sort();

// filterDate (not a year_month string-equality filter) so EE can use its
// built-in time index instead of scanning the whole 3-hourly collection
// for every one of the ~96 months.
var monthlyGldas = ee.ImageCollection(gldasYmList.map(function(ym) {
  var monthStart = ee.Date.parse('YYYY-MM', ym);
  var monthEnd = monthStart.advance(1, 'month');
  var subset = gldasForAnalysis.filterDate(monthStart, monthEnd);
  return subset.mean()
    .subtract(gldasBaseline)
    .set('year_month', ym)
    .set('system:time_start', monthStart.millis());
}));

// GWS anomaly = GRACE TWS anomaly − GLDAS modeled water anomaly
// Use a proper join (year_month match) instead of filtering monthlyGldas
// from scratch inside .map() for every GRACE image — the per-image filter
// approach forces EE to re-evaluate the entire monthlyGldas chain on every
// call, which is what was making this export so slow.
var gwsJoinFilter = ee.Filter.equals({leftField: 'year_month', rightField: 'year_month'});
var gwsJoined = ee.Join.saveFirst('gldas_match').apply(graceAnomalies, monthlyGldas, gwsJoinFilter);

var graceGWS = ee.ImageCollection(gwsJoined).map(function(img) {
  var gldas = ee.Image(img.get('gldas_match')).select('gldas_tws');
  return ee.Image(img).subtract(gldas)
    .clip(conus)
    .copyProperties(img, ['system:time_start', 'year_month']);
});
print('✓ GRACE groundwater storage anomaly images:', graceGWS.size());

// GWS typically has smaller amplitude than raw TWS — tighter min/max
var graceGWSVizParams = {
  min: -15, max: 15,
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

// GLDAS-derived surface (0-10cm) and root zone (0-100cm) soil moisture
// anomalies (cm LWE, same 2004-2009 baseline as GRACE) — raw, not percentile.
var surfaceTimeSeries = ee.FeatureCollection(
  monthlyGldas.map(function(img) {
    var stats = img.select('gldas_surface').reduceRegion({
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
  collection:     surfaceTimeSeries,
  description:    'gldas_surface_timeseries_swco',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'gldas_surface_swco_timeseries',
  fileFormat:     'CSV'
});

var rootZoneTimeSeries = ee.FeatureCollection(
  monthlyGldas.map(function(img) {
    var stats = img.select('gldas_rootzone').reduceRegion({
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
  collection:     rootZoneTimeSeries,
  description:    'gldas_rootzone_timeseries_swco',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'gldas_rootzone_swco_timeseries',
  fileFormat:     'CSV'
});

// GRACE TWS minus GLDAS-modeled water = groundwater storage anomaly (raw,
// not percentile) — distinct from the GRACE-DA gws_inst percentile product
// used on the live grace-monitor.html / grace-basin-monitor.html maps.
var gwsTimeSeries = ee.FeatureCollection(
  graceGWS.map(function(img) {
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
  collection:     gwsTimeSeries,
  description:    'grace_gws_timeseries_swco',
  folder:         'DiscoveryFarms_GEE',
  fileNamePrefix: 'grace_gws_swco_timeseries',
  fileFormat:     'CSV'
});

print('✓ CSV export tasks queued (Sentinel-1 + GRACE-FO TWS + GLDAS surface/root-zone + GRACE GWS time series)');


// ============================================================
// EXPORT — Monthly Animations to Google Drive
// ============================================================

// Colorado county and state boundaries for spatial context
var coCounties = ee.FeatureCollection('TIGER/2018/Counties')
  .filter(ee.Filter.eq('STATEFP', '08'));
var countyMask = ee.Image().byte()
  .paint({featureCollection: coCounties, color: 1, width: 1});
var coStateMask = ee.Image().byte()
  .paint({featureCollection: ee.FeatureCollection('TIGER/2018/States')
    .filter(ee.Filter.eq('NAME', 'Colorado')), color: 1, width: 2});

var s1VVFrames = monthlyS1Smooth.sort('system:time_start').map(function(img) {
  var viz = img.visualize(vvVizParams);
  return viz.where(countyMask, ee.Image.constant([255, 255, 255]).byte());
});

// PALSAR-2 individual images — one export per monthly composite, year_month in filename
palsarYmList.evaluate(function(ymList) {
  ymList.forEach(function(ym) {
    var img = monthlyPalsar.filter(ee.Filter.eq('year_month', ym)).first();
    var viz = img.visualize(palsarHHVizParams)
      .where(countyMask, ee.Image.constant([255, 255, 255]).byte())
      .where(coStateMask, ee.Image.constant([255, 255, 255]).byte());
    Export.image.toDrive({
      image:           viz,
      description:     'palsar2_hh_' + ym,
      folder:          'DiscoveryFarms_GEE',
      fileNamePrefix:  'palsar2_co_hh_' + ym,
      region:          colorado,
      scale:           25,
      crs:             'EPSG:4326',
      maxPixels:       1e9
    });
  });
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
  var viz = img.visualize(ratioVizParams);
  return viz.where(countyMask, ee.Image.constant([255, 255, 255]).byte());
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

// ============================================================
// VH/VV ratio — discrete MONTHLY images (one per year_month, not a video)
// Mirrors the USDM drought-monitor's yearly PNGs but at monthly granularity:
// each month gets its own exported image (reusing the already speckle-reduced
// monthlyS1Smooth composites), so the slider shows a guaranteed, exact month
// rather than a frame pulled from a continuous video or a noisier per-scene image.
// ============================================================
ymList.evaluate(function(months) {
  months.forEach(function(ym) {
    var img = monthlyS1Smooth.filter(ee.Filter.eq('year_month', ym)).first();
    // No baked-in county/state lines here — boundaries are added later as a
    // separate vector overlay in the slider page, so these exports stay raw.
    var viz = ee.Image(img).visualize(ratioVizParams);
    Export.image.toDrive({
      image:          viz,
      description:    'sentinel1_ratio_monthly_' + ym,
      folder:         'DiscoveryFarms_GEE',
      fileNamePrefix: 'sentinel1_ratio_swco_' + ym,
      region:         swColorado,
      scale:          250,
      crs:            'EPSG:4326',
      maxPixels:      1e9
    });
  });
});

// State lines (width 2) + CO county lines (width 1) baked into each GRACE frame
var stateBoundaries = ee.FeatureCollection('TIGER/2018/States');
var stateMask = ee.Image().byte()
  .paint({featureCollection: stateBoundaries, color: 1, width: 2});
var graceCountyMask = ee.Image().byte()
  .paint({featureCollection: coCounties, color: 1, width: 1});

var graceFrames = graceAnomalies.sort('system:time_start').map(function(img) {
  var graceViz = img
    .resample('bicubic')
    .reproject({crs: 'EPSG:4326', scale: 5000})
    .visualize(graceVizParams);
  return graceViz.where(stateMask, ee.Image.constant([255, 255, 255]).byte());
});

Export.video.toDrive({
  collection:      graceFrames,
  description:     'grace_fo_tws_conus_animation',
  folder:          'DiscoveryFarms_GEE',
  fileNamePrefix:  'grace_fo_conus_tws_monthly',
  framesPerSecond: 2,
  region:          conus,
  crs:             'EPSG:4326',
  scale:           5000,
  maxFrames:       300
});

// GWS (groundwater storage) animation — GRACE TWS minus GLDAS modeled components
var graceGWSFrames = graceGWS.sort('system:time_start').map(function(img) {
  var viz = img.resample('bicubic').reproject({crs: 'EPSG:4326', scale: 5000}).visualize(graceGWSVizParams);
  return viz.where(stateMask, ee.Image.constant([255, 255, 255]).byte());
});

Export.video.toDrive({
  collection:      graceGWSFrames,
  description:     'grace_fo_gws_conus_animation',
  folder:          'DiscoveryFarms_GEE',
  fileNamePrefix:  'grace_fo_conus_gws_monthly',
  framesPerSecond: 2,
  region:          conus,
  crs:             'EPSG:4326',
  scale:           5000,
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
