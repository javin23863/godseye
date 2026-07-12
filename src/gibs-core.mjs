// NASA GIBS WMTS tile URL construction + UTC date helpers (pure, Cesium-free).
// Verified keyless + CORS `*` against gibs.earthdata.nasa.gov (EPSG:3857 "best").

export const GIBS_ENDPOINT = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'

/** @typedef {{id:string,label:string,matrixSet:string,format:string,ext:string}} GibsDef */

/**
 * Three recent-imagery overlays, all global + daily + date-driven raster in
 * GoogleMapsCompatible (web-mercator). Each tile verified 200 image/* over land.
 * @type {GibsDef[]}
 */
export const GIBS_LAYERS = [
  // recent daily optical true color
  { id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', label: 'GIBS TRUECOLOR', matrixSet: 'GoogleMapsCompatible_Level9', format: 'image/jpeg', ext: 'jpg' },
  // thermal band I5 — active fires / hotspots read as anomalously bright (the VIIRS
  // Thermal_Anomalies product is vector-tile-only now, so this is the raster stand-in)
  { id: 'VIIRS_NOAA20_Brightness_Temp_BandI5_Day', label: 'GIBS THERMAL/FIRES', matrixSet: 'GoogleMapsCompatible_Level9', format: 'image/png', ext: 'png' },
  // light weather overlay: MODIS daily cloud fraction
  { id: 'MODIS_Terra_Cloud_Fraction_Day', label: 'GIBS CLOUD', matrixSet: 'GoogleMapsCompatible_Level6', format: 'image/png', ext: 'png' },
]

/** Max TileMatrix index for a GoogleMapsCompatible_LevelN set (N levels => 0..N-1). */
export function maxLevel(matrixSet) {
  const m = /_Level(\d+)$/.exec(matrixSet)
  return m ? Number(m[1]) - 1 : 0
}

/** REST WMTS template for Cesium (placeholders {Time}/{TileMatrix}/{TileRow}/{TileCol}). */
export function gibsTemplate(def) {
  return `${GIBS_ENDPOINT}/${def.id}/default/{Time}/${def.matrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${def.ext}`
}

/** Concrete tile URL (verification / tests). */
export function gibsTileUrl(def, date, z, row, col) {
  return `${GIBS_ENDPOINT}/${def.id}/default/${date}/${def.matrixSet}/${z}/${row}/${col}.${def.ext}`
}

/** YYYY-MM-DD in UTC, offset by whole days from `now` (default = now). */
export function utcDay(offsetDays = 0, now = Date.now()) {
  return new Date(now + offsetDays * 86400000).toISOString().slice(0, 10)
}
