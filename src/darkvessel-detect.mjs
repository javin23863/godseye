// Dark-vessel detection (CAP-14) — pure logic, plain .mjs so `node --test` runs it directly.
// "Ships turn off AIS to run the Strait of Hormuz": reconstruct each MMSI's sighting
// timeline from recorded ship snapshots and flag vessels that were UNDERWAY, then vanished.
//
// Design choices (documented per spec):
//  - A gap only counts when at least one snapshot that DID happen is missing the vessel.
//    If the recorder itself was down (no snapshots between two sightings) that's a DATA gap,
//    not a dark event — we don't flag it.
//  - Closed gap (reappears): flag when gap >= gapMin and the vessel was underway at last sight.
//  - Still-open gap (never reappears): a vessel leaving the bbox is indistinguishable from one
//    running dark, so we only flag an open gap once trailing absence reaches 2x the threshold,
//    AND only for an ESTABLISHED track (seen in >= 2 snapshots). This is also how we honour
//    "MMSI seen once -> ignore": a single crowd-sourced blip is never a track.

/**
 * @typedef {{ mmsi:number, name?:string, lat:number, lon:number, sog?:number, at:number }} Ship
 * @typedef {{ at:number, items:Ship[] }} ShipSnapshot
 * @typedef {{ lat:number, lon:number, at:number }} Fix
 * @typedef {{ mmsi:number, name:string, lastSeen:Fix, seenAgain:(Fix|null), gapMin:number }} DarkEvent
 */

const UNDERWAY_KN = 0.5

/** @param {number} ms */
const toMin = (ms) => Math.round((ms / 60_000) * 10) / 10

/**
 * @param {ShipSnapshot[]} snapshots  chronological-ish ship snapshots over the window
 * @param {number} [gapMin]           minutes of absence that make a gap "dark" (default 20)
 * @returns {DarkEvent[]}             most-suspicious (largest gap) first
 */
export function detectDarkEvents(snapshots, gapMin = 20) {
  const gapMs = gapMin * 60_000
  const snaps = (snapshots ?? [])
    .filter((s) => s && Number.isFinite(s.at) && Array.isArray(s.items))
    .sort((a, b) => a.at - b.at)
  if (snaps.length < 2) return [] // need a window to see a gap

  const snapTimes = snaps.map((s) => s.at)
  const windowEnd = snapTimes[snapTimes.length - 1]
  // a snapshot that DID happen strictly inside (a, b) is proof the vessel was absent then
  const hasSnapshotBetween = (a, b) => snapTimes.some((t) => t > a && t < b)

  /** @type {Map<number, Array<Fix & {sog:number, name:string}>>} */
  const timelines = new Map()
  for (const s of snaps) {
    for (const ship of s.items) {
      if (!ship || !Number.isFinite(ship.mmsi)) continue
      let track = timelines.get(ship.mmsi)
      if (!track) timelines.set(ship.mmsi, (track = []))
      track.push({
        at: s.at, // sighting time = when the snapshot recorded the vessel present
        lat: ship.lat,
        lon: ship.lon,
        sog: ship.sog ?? 0,
        name: (ship.name ?? '').trim() || `MMSI ${ship.mmsi}`,
      })
    }
  }

  /** @type {DarkEvent[]} */
  const events = []
  for (const [mmsi, sights] of timelines) {
    // closed gaps: an underway sighting followed later by a reappearance
    for (let i = 0; i < sights.length - 1; i++) {
      const a = sights[i]
      const b = sights[i + 1]
      const gap = b.at - a.at
      if (gap >= gapMs && a.sog > UNDERWAY_KN && hasSnapshotBetween(a.at, b.at)) {
        events.push({
          mmsi,
          name: a.name,
          lastSeen: { lat: a.lat, lon: a.lon, at: a.at },
          seenAgain: { lat: b.lat, lon: b.lon, at: b.at },
          gapMin: toMin(gap),
        })
      }
    }
    // still-open gap: established track (>=2 sights) whose last underway sighting is followed
    // by absence through window end of at least 2x the threshold. Seen-once tracks are ignored.
    const last = sights[sights.length - 1]
    const openGap = windowEnd - last.at
    if (sights.length >= 2 && last.sog > UNDERWAY_KN && openGap >= 2 * gapMs) {
      events.push({
        mmsi,
        name: last.name,
        lastSeen: { lat: last.lat, lon: last.lon, at: last.at },
        seenAgain: null,
        gapMin: toMin(openGap),
      })
    }
  }

  events.sort((x, y) => y.gapMin - x.gapMin || x.mmsi - y.mmsi)
  return events
}
