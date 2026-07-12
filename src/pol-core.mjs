// Pattern-of-life (CAP-26): turn one entity/corridor Track into a behavior profile — pure
// logic, plain .mjs so `node --test` runs it directly. Given a Track {id, fixes:[{lat,lon,at}]}
// it answers "when/where is this thing normally active?" (hour histogram + dwell zones) and,
// against a reference histogram, "how unusual is its most recent activity hour?" (deviation).
// Cesium/DOM rendering lives in pol.ts; this file owns none of it.
import { haversineKm } from './rules-eval.mjs'

/**
 * @typedef {{ lat:number, lon:number, at:number } & Record<string, unknown>} Fix
 * @typedef {{ id:string, fixes:Fix[], first?:number, last?:number, count?:number }} Track
 * @typedef {{ lat:number, lon:number, count:number }} DwellZone
 * @typedef {{ hourHistogramUTC:number[], activeHoursUTC:number[], medianSpeedKmh:number,
 *            dwellZones:DwellZone[], span:{first:number|null,last:number|null} }} Profile
 */

const DWELL_GRID_DEG = 0.05 // ~5.5km cells — a vessel/aircraft lingering in one cell = a dwell
const DWELL_MIN_FIXES = 2 // one sighting isn't a dwell; two+ in a cell is

/** Median of a numeric array (0 for empty). @param {number[]} xs */
function median(xs) {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Behavior profile for one track.
 * @param {Track} track
 * @returns {Profile}
 */
export function patternOfLife(track) {
  // guard bad rows so a single NaN can't poison the histogram/speed math
  const fixes = (track?.fixes ?? []).filter(
    (f) => Number.isFinite(f.lat) && Number.isFinite(f.lon) && Number.isFinite(f.at),
  )

  // hour-of-day activity (UTC): which hours this entity is normally seen moving
  const hourHistogramUTC = new Array(24).fill(0)
  for (const f of fixes) hourHistogramUTC[new Date(f.at).getUTCHours()]++
  // "active" = busier than a flat-across-24h baseline, so an all-day entity reports the peak hours
  const mean = fixes.length / 24
  const activeHoursUTC = []
  for (let h = 0; h < 24; h++) if (hourHistogramUTC[h] > mean) activeHoursUTC.push(h)

  // median leg speed from consecutive-fix haversine / dt (skips zero/negative dt)
  const speeds = []
  for (let i = 1; i < fixes.length; i++) {
    const dtH = (fixes[i].at - fixes[i - 1].at) / 3_600_000
    if (dtH <= 0) continue
    speeds.push(haversineKm(fixes[i - 1].lat, fixes[i - 1].lon, fixes[i].lat, fixes[i].lon) / dtH)
  }
  const medianSpeedKmh = median(speeds)

  // dwell zones: snap each fix to a grid cell, keep cells revisited DWELL_MIN_FIXES+ times
  const cells = new Map()
  for (const f of fixes) {
    const lat = Math.round(f.lat / DWELL_GRID_DEG) * DWELL_GRID_DEG
    const lon = Math.round(f.lon / DWELL_GRID_DEG) * DWELL_GRID_DEG
    const key = `${lat.toFixed(3)}|${lon.toFixed(3)}`
    const cell = cells.get(key) ?? { lat, lon, count: 0 }
    cell.count++
    cells.set(key, cell)
  }
  const dwellZones = [...cells.values()]
    .filter((c) => c.count >= DWELL_MIN_FIXES)
    .sort((a, b) => b.count - a.count)

  const span = {
    first: fixes.length ? fixes[0].at : null,
    last: fixes.length ? fixes[fixes.length - 1].at : null,
  }
  return { hourHistogramUTC, activeHoursUTC, medianSpeedKmh, dwellZones, span }
}

/**
 * How unusual is the track's MOST RECENT activity hour versus a reference histogram?
 * 0 = the recent hour is the reference's busiest hour (totally normal); 1 = the reference
 * has never seen activity in that hour (fully anomalous). Empty/degenerate input -> 0.
 * @param {Track} track
 * @param {number[]} referenceHistogram  24-bucket UTC histogram (e.g. a corridor's baseline)
 * @returns {number} 0..1
 */
export function deviationScore(track, referenceHistogram) {
  const fixes = track?.fixes ?? []
  if (!fixes.length || !Array.isArray(referenceHistogram) || !referenceHistogram.length) return 0
  const hour = new Date(fixes[fixes.length - 1].at).getUTCHours()
  const max = Math.max(...referenceHistogram)
  if (max <= 0) return 0
  const freq = (referenceHistogram[hour] ?? 0) / max
  return Math.max(0, Math.min(1, 1 - freq))
}
