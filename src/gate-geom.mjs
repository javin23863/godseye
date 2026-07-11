// Chokepoint gate crossing geometry (CAP-15) — pure logic, plain .mjs so `node --test`
// runs it headless (no Cesium/DOM). Treats lon as x, lat as y: an equirectangular
// planar approximation, fine at a single strait's scale.
// ponytail: planar lon/lat; a proper great-circle test isn't worth it across ~40km.

/** @typedef {{ lon: number, lat: number, at?: number }} Pt */
/** @typedef {{ a: Pt, b: Pt }} Gate */
/** @typedef {{ mmsi: number, at: number, dir: 'IN' | 'OUT' }} Crossing */

/**
 * Signed area of the triangle p,q,r (twice it): the 2D cross product (q-p) × (r-p).
 * >0 when r is left of the directed line p→q, <0 when right, 0 when collinear.
 * @param {Pt} p @param {Pt} q @param {Pt} r
 */
function orient(p, q, r) {
  return (q.lon - p.lon) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lon - p.lon)
}

/**
 * Do segments AB and CD PROPERLY cross? Strict opposite-sides test on both segments,
 * so it is false for parallel/collinear segments and for a mere touch at an endpoint
 * (an orientation of exactly 0 kills the product). That is the behaviour a gate wants:
 * a vessel grazing the line is not a transit.
 * @param {Pt} a @param {Pt} b @param {Pt} c @param {Pt} d
 * @returns {boolean}
 */
export function segmentsCross(a, b, c, d) {
  const d1 = orient(c, d, a)
  const d2 = orient(c, d, b)
  const d3 = orient(a, b, c)
  const d4 = orient(a, b, d)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/**
 * Which side of the gate (directed A→B) point p lies on. >0 = left, <0 = right, 0 = on it.
 * @param {Pt} gateA @param {Pt} gateB @param {Pt} p
 * @returns {number}
 */
export function crossingSide(gateA, gateB, p) {
  return orient(gateA, gateB, p)
}

/**
 * Detect every gate transit across per-vessel ordered tracks.
 * Direction is the sign of (gate vector) × (vessel motion): consistent, and for the
 * preset Hormuz gate (A=NW end → B=SE end) IN = motion toward the Persian Gulf side.
 * Handles multiple crossings by one vessel (each consecutive-pair transit is its own row).
 * @param {Gate} gate
 * @param {Map<number, Pt[]>} tracksByMmsi  mmsi → chronological positions
 * @returns {Crossing[]}
 */
export function detectCrossings(gate, tracksByMmsi) {
  /** @type {Crossing[]} */
  const out = []
  const { a: ga, b: gb } = gate
  const gx = gb.lon - ga.lon
  const gy = gb.lat - ga.lat
  for (const [mmsi, pts] of tracksByMmsi) {
    if (!pts || pts.length < 2) continue
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]
      const p1 = pts[i]
      if (!segmentsCross(p0, p1, ga, gb)) continue
      // gate × motion; nonzero whenever a proper crossing exists (motion can't be parallel to the gate)
      const cross = gx * (p1.lat - p0.lat) - gy * (p1.lon - p0.lon)
      out.push({ mmsi, at: p1.at ?? 0, dir: cross > 0 ? 'IN' : 'OUT' })
    }
  }
  return out
}
