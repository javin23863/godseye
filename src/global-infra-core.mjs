// Pure core for the global critical-infra module: flatten TeleGeography's submarine
// cable GeoJSON (submarinecablemap.com /api/v3/cable/cable-geo.json — every feature is
// a MultiLineString) into flat renderable segments. DOM/Cesium stays in global-infra.ts.

/**
 * @typedef {{ id: string, name: string, color: string, path: [number, number][] }} CableSegment
 */

/**
 * Flatten a submarine-cable FeatureCollection into one segment per MultiLineString sub-line.
 * Skips malformed features/segments instead of throwing — a live feed with one bad record
 * should still draw the other cables. TeleGeography pre-splits each cable at the antimeridian,
 * so each sub-line stays contiguous and needs no further splitting.
 * @param {any} fc parsed GeoJSON FeatureCollection
 * @returns {CableSegment[]}
 */
export function cableSegments(fc) {
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return []
  const out = []
  for (const f of fc.features) {
    if (!f || !f.geometry || f.geometry.type !== 'MultiLineString') continue
    const p = f.properties || {}
    const lines = f.geometry.coordinates
    if (!Array.isArray(lines)) continue
    lines.forEach((line, i) => {
      if (!Array.isArray(line)) return
      const path = line.filter(
        (c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]),
      )
      if (path.length < 2) return
      out.push({
        id: `${p.feature_id || p.id || 'cable'}-${i}`,
        name: typeof p.name === 'string' ? p.name : 'Unknown cable',
        color: typeof p.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : '#4fc3f7',
        path,
      })
    })
  }
  return out
}
