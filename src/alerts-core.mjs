// Pure normalize for api.weather.gov /alerts/active GeoJSON (US-only NWS feed).
// Only features WITH a Polygon geometry are kept — geometry-less alerts (the
// API emits null geometry for some zone-based warnings) have no point to pin,
// and there's no cheap zone->centroid lookup here, so they're dropped.

/**
 * @typedef {Object} NwsFeature
 * @property {string} [id]
 * @property {{type?: string, coordinates?: number[][][]}} [geometry]
 * @property {{event?: string, severity?: string, headline?: string, areaDesc?: string}} [properties]
 */
/**
 * @typedef {Object} AlertPin
 * @property {string} id
 * @property {string} event
 * @property {'Extreme'|'Severe'|'Moderate'|'Minor'|'Unknown'} severity
 * @property {string} headline
 * @property {string} area
 * @property {number} lat
 * @property {number} lon
 * @property {[number,number][]} [ring]  // outer ring [lon,lat] pairs, Polygon only
 */

const SEVERITIES = ['Extreme', 'Severe', 'Moderate', 'Minor']
const MAX_ALERTS = 300 // NWS can carry 1000+ active zone alerts nationwide

/** @param {string} severity @returns {number} higher = more severe, 0 for Unknown */
export function severityRank(severity) {
  const i = SEVERITIES.indexOf(severity)
  return i < 0 ? 0 : SEVERITIES.length - i
}

/**
 * @param {{features?: NwsFeature[]}} geojson
 * @returns {AlertPin[]} sorted Extreme -> Minor, capped at MAX_ALERTS
 */
export function normalizeNws(geojson) {
  const feats = geojson && Array.isArray(geojson.features) ? geojson.features : []
  /** @type {AlertPin[]} */
  const out = []

  for (const f of feats) {
    const g = f && f.geometry
    if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates) || !g.coordinates.length) continue
    const outer = g.coordinates[0]
    if (!Array.isArray(outer) || !outer.length) continue

    let sumLon = 0
    let sumLat = 0
    let n = 0
    /** @type {[number,number][]} */
    const ring = []
    for (const pt of outer) {
      if (!Array.isArray(pt) || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue
      ring.push([pt[0], pt[1]])
      sumLon += pt[0]
      sumLat += pt[1]
      n++
    }
    if (!n) continue

    const p = f.properties || {}
    const severity = SEVERITIES.includes(p.severity) ? p.severity : 'Unknown'
    out.push({
      id: f.id || `${sumLon / n},${sumLat / n}`,
      event: p.event || 'Alert',
      severity,
      headline: p.headline || '',
      area: p.areaDesc || '',
      lon: sumLon / n, // ponytail: ring-vertex average, not true polygon-area centroid
      lat: sumLat / n,
      ring,
    })
  }

  out.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  return out.slice(0, MAX_ALERTS)
}
