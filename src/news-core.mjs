// PURE core for the GDELT news layer (news.ts): turn a GDELT GeoJSON
// FeatureCollection into aggregated map pins [{lat,lon,name,count}].
//
// Source is GDELT's keyless v1 GKG GeoJSON feed (last ~15min global, one Point
// per geocoded article mention). We aggregate mentions at the same coordinate
// into a single pin whose `count` is the mention volume — that's the "hotspot"
// signal. Server-side keyword filtering is unreliable on this feed, so the
// optional `query` filter runs here, client-side, over each feature's
// name + mentionedthemes + url text (OR match on space-split terms).

/**
 * @typedef {Object} GdeltFeature
 * @property {{type:string, coordinates:[number,number]}} geometry  // [lon,lat]
 * @property {{name?:string, mentionedthemes?:string, url?:string, urltone?:number}} [properties]
 */
/**
 * @typedef {Object} NewsPin
 * @property {number} lat
 * @property {number} lon
 * @property {string} name
 * @property {number} count   // number of article mentions at this location
 */

/**
 * Aggregate a GDELT GeoJSON FeatureCollection into per-location pins.
 * Malformed input (no features array, non-Point geometry, non-finite coords)
 * is skipped, never thrown — the feed occasionally emits partial records.
 *
 * @param {{features?: GdeltFeature[]}} geojson
 * @param {string} [query]  space-split OR terms; empty/absent = keep all
 * @returns {NewsPin[]} pins sorted by count desc
 */
export function normalizeGeo(geojson, query = '') {
  const feats = geojson && Array.isArray(geojson.features) ? geojson.features : []
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean)
  /** @type {Map<string, NewsPin>} */
  const byLoc = new Map()

  for (const f of feats) {
    const g = f && f.geometry
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) continue
    const [lon, lat] = g.coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue

    const p = f.properties || {}
    if (terms.length) {
      const hay = `${p.name || ''} ${p.mentionedthemes || ''} ${p.url || ''}`.toLowerCase()
      if (!terms.some((t) => hay.includes(t))) continue
    }

    // exact coord as key — GDELT emits the same lon/lat per geocoded place, so
    // identical coords are genuine repeats of one location, not near-neighbours.
    const key = `${lon},${lat}`
    const hit = byLoc.get(key)
    if (hit) hit.count++
    else byLoc.set(key, { lat, lon, name: p.name || 'Unknown', count: 1 })
  }

  return [...byLoc.values()].sort((a, b) => b.count - a.count)
}
