// Pure road-geometry helpers for the traffic particle system — plain .mjs for node --test.

/** Equirectangular length approximation, fine at city scale. */
function segLen(a, b) {
  const kx = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  const dx = (b.lon - a.lon) * kx
  const dy = (b.lat - a.lat) * 111_320
  return Math.hypot(dx, dy)
}

/**
 * @param {Array<{lat: number, lon: number}>} pts way geometry
 * @returns {{pts: typeof pts, cum: number[], length: number} | null} null when degenerate
 */
export function buildRoad(pts) {
  if (!pts || pts.length < 2) return null
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + segLen(pts[i - 1], pts[i]))
  const length = cum[cum.length - 1]
  return length > 1 ? { pts, cum, length } : null
}

/**
 * Position at distance d (meters) along the road, clamped to its ends.
 * @param {{pts: Array<{lat: number, lon: number}>, cum: number[], length: number}} road
 * @param {number} d
 * @returns {{lat: number, lon: number}}
 */
export function pointAt(road, d) {
  const { pts, cum, length } = road
  const x = Math.min(Math.max(d, 0), length)
  let i = cum.findIndex((c) => c >= x)
  if (i <= 0) return pts[0]
  const t = (x - cum[i - 1]) / (cum[i] - cum[i - 1])
  return {
    lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * t,
    lon: pts[i - 1].lon + (pts[i].lon - pts[i - 1].lon) * t,
  }
}
