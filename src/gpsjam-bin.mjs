// Pure binning core for the GPS-jamming layer (CAP-21): grid ADS-B nav-integrity
// reports into cells and flag cells with a heavy concentration of low-integrity
// aircraft as a probable jamming cell. gpsjam.org method, lat/lon grid stand-in
// (ponytail: square cells, not H3 hexes — see gpsjam.ts ceiling note).

/**
 * @param {{lat:number, lon:number, nic?:number, nac_p?:number}[]} reports
 * @param {number} cellDeg grid cell size in degrees
 * @param {{minAircraft?:number, minFrac?:number}} [opts]
 * @returns {{lat:number, lon:number, total:number, low:number, frac:number}[]}
 *   lat/lon = cell SW corner.
 */
export function binIntegrity(reports, cellDeg, opts = {}) {
  const minAircraft = opts.minAircraft ?? 3
  const minFrac = opts.minFrac ?? 0.5
  const cells = new Map()

  for (const r of reports) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue
    const cx = Math.floor(r.lat / cellDeg) * cellDeg
    const cy = Math.floor(r.lon / cellDeg) * cellDeg
    const key = `${cx},${cy}`
    let c = cells.get(key)
    if (!c) {
      c = { lat: cx, lon: cy, total: 0, low: 0 }
      cells.set(key, c)
    }
    c.total++
    // unknown (undefined) integrity is NOT treated as low
    const low = (r.nic !== undefined && r.nic < 7) || (r.nac_p !== undefined && r.nac_p < 8)
    if (low) c.low++
  }

  const out = []
  for (const c of cells.values()) {
    const frac = c.low / c.total
    if (c.total >= minAircraft && frac >= minFrac) out.push({ ...c, frac })
  }
  return out
}
