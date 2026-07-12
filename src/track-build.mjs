// Entity TRACKS from recorded snapshots (CAP-24) — pure logic, plain .mjs so `node --test`
// runs it directly. Every layer records per-poll dots; buildTracks stitches those dots into
// persistent moving objects (one track per entity id) so pattern-of-life, NL-queries and
// entity tripwires have a history to reason over instead of a single frame.
//
// Design choices (documented per spec):
//  - Grouping key defaults to `id` (aircraft) but is caller-supplied — ships key on `mmsi`.
//  - A fix needs finite lat/lon/at or it's skipped (bad rows never poison distance/bbox).
//  - Fixes are sorted ascending by time and deduped on identical `at` (a re-recorded poll,
//    or two snapshots that landed on the same ms, would otherwise double-count).

/**
 * @typedef {{ at:number, items:object[] }} Snapshot
 * @typedef {{ lat:number, lon:number, at:number } & Record<string, unknown>} Fix
 * @typedef {{ id:string, fixes:Fix[], first:number, last:number, count:number }} Track
 */

const R_KM = 6371 // mean Earth radius

/** @param {number} deg */
const rad = (deg) => (deg * Math.PI) / 180

/** Great-circle distance between two lat/lon points, km. */
function haversineKm(aLat, aLon, bLat, bLon) {
  const dLat = rad(bLat - aLat)
  const dLon = rad(bLon - aLon)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Stitch per-poll snapshots into one track per entity.
 * @param {Snapshot[]} snapshots  recorded snapshots (any order); each item carries lat/lon
 * @param {string} [idKey]        item field to group on (default "id"; ships use "mmsi")
 * @returns {Track[]}             tracks with fixes sorted ascending by `at`, deduped on `at`
 */
export function buildTracks(snapshots, idKey = 'id') {
  /** @type {Map<string, Fix[]>} */
  const byId = new Map()

  for (const snap of snapshots ?? []) {
    if (!snap || !Number.isFinite(snap.at) || !Array.isArray(snap.items)) continue
    for (const item of snap.items) {
      if (!item) continue
      const id = item[idKey]
      if (id === undefined || id === null) continue
      // sighting time = the snapshot's `at`; item.at (if any) is a per-record stamp we ignore
      // for ordering so every track shares one clock (the recorder's).
      const { lat, lon } = item
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const key = String(id)
      let fixes = byId.get(key)
      if (!fixes) byId.set(key, (fixes = []))
      fixes.push({ ...item, lat, lon, at: snap.at })
    }
  }

  /** @type {Track[]} */
  const tracks = []
  for (const [id, fixes] of byId) {
    fixes.sort((a, b) => a.at - b.at)
    /** @type {Fix[]} */
    const deduped = []
    for (const f of fixes) if (!deduped.length || deduped[deduped.length - 1].at !== f.at) deduped.push(f)
    tracks.push({
      id,
      fixes: deduped,
      first: deduped[0].at,
      last: deduped[deduped.length - 1].at,
      count: deduped.length,
    })
  }
  return tracks
}

/**
 * Summary metrics for one track (haversine over consecutive fixes).
 * @param {Track} track
 * @returns {{ distanceKm:number, durationMin:number, bbox:{minLat:number,minLon:number,maxLat:number,maxLon:number}, avgSpeedKmh:number }}
 */
export function trackStats(track) {
  const fixes = track.fixes
  const bbox = { minLat: Infinity, minLon: Infinity, maxLat: -Infinity, maxLon: -Infinity }
  let distanceKm = 0
  for (let i = 0; i < fixes.length; i++) {
    const f = fixes[i]
    if (f.lat < bbox.minLat) bbox.minLat = f.lat
    if (f.lat > bbox.maxLat) bbox.maxLat = f.lat
    if (f.lon < bbox.minLon) bbox.minLon = f.lon
    if (f.lon > bbox.maxLon) bbox.maxLon = f.lon
    if (i > 0) distanceKm += haversineKm(fixes[i - 1].lat, fixes[i - 1].lon, f.lat, f.lon)
  }
  const durationMin = fixes.length ? (track.last - track.first) / 60_000 : 0
  const avgSpeedKmh = durationMin > 0 ? distanceKm / (durationMin / 60) : 0
  return { distanceKm, durationMin, bbox, avgSpeedKmh }
}
