// Pure AOI imaging-pass finder (CAP-12/CAP-29): given a caller-supplied ECEF-km propagator,
// scan forward and return the first instant the satellite clears the elevation mask over the AOI.
// Reuses the topocentric elevation math in aoi-geom.mjs (same math the SAT AOI LINES layer uses).
import { elevationAngle } from './aoi-geom.mjs'

/**
 * First epoch-ms at which `aoi` sees the propagated satellite above `maskDeg` elevation.
 * @param {(ms:number)=>({x:number,y:number,z:number}|null)} propagateEcefKmAt propagator: epoch ms -> satellite ECEF position in km (null when the SGP4 model has no solution at that time)
 * @param {{lat:number,lon:number}} aoi ground target (degrees)
 * @param {{fromMs:number,horizonMin:number,stepSec:number,maskDeg:number}} opts scan window + granularity + mask
 * @returns {number|null} epoch ms of the first above-mask sample, or null if none within the horizon
 */
export function nextPass(propagateEcefKmAt, aoi, { fromMs, horizonMin, stepSec, maskDeg }) {
  const endMs = fromMs + horizonMin * 60_000
  const stepMs = stepSec * 1000
  // ponytail: coarse fixed-step scan — resolution is `stepSec` (30s = a few km of ground track),
  // fine enough for a "next pass in HHhMMm" schedule; add bisection refinement only if you need
  // pass timing to the second.
  for (let ms = fromMs; ms <= endMs; ms += stepMs) {
    const p = propagateEcefKmAt(ms)
    if (!p) continue // no SGP4 solution at this instant — skip, don't treat as a pass
    if (elevationAngle([p.x, p.y, p.z], aoi.lat, aoi.lon) > maskDeg) return ms
  }
  return null
}
