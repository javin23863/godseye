import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTracks, trackStats } from '../src/track-build.mjs'

// three polls, two aircraft (A moves north, B stationary), one bad row that must be skipped
const T0 = 1_700_000_000_000
const MIN = 60_000
const snapshots = [
  { at: T0, items: [{ id: 'A', lat: 26.0, lon: 56.0, altM: 900 }, { id: 'B', lat: 25.0, lon: 55.0 }] },
  { at: T0 + 10 * MIN, items: [{ id: 'A', lat: 26.5, lon: 56.0 }, { id: 'B', lat: 25.0, lon: 55.0 }, { id: 'X', lat: NaN, lon: 5 }] },
  { at: T0 + 20 * MIN, items: [{ id: 'A', lat: 27.0, lon: 56.0 }, { id: 'B', lat: 25.0, lon: 55.0 }] },
]

test('groups by id, sorts by at, counts fixes', () => {
  const tracks = buildTracks(snapshots)
  const byId = Object.fromEntries(tracks.map((t) => [t.id, t]))
  assert.deepEqual(Object.keys(byId).sort(), ['A', 'B']) // NaN-only entity X dropped entirely
  assert.equal(byId.A.count, 3)
  assert.equal(byId.A.first, T0)
  assert.equal(byId.A.last, T0 + 20 * MIN)
  assert.deepEqual(byId.A.fixes.map((f) => f.at), [T0, T0 + 10 * MIN, T0 + 20 * MIN])
  assert.equal(byId.A.fixes[0].altM, 900) // rest of item is carried onto the fix
})

test('dedupes fixes with identical at', () => {
  const dup = [
    { at: T0, items: [{ id: 'A', lat: 1, lon: 1 }] },
    { at: T0, items: [{ id: 'A', lat: 1, lon: 1 }] },
    { at: T0 + MIN, items: [{ id: 'A', lat: 2, lon: 2 }] },
  ]
  const [track] = buildTracks(dup)
  assert.equal(track.count, 2)
})

test('honors a custom idKey', () => {
  const snaps = [{ at: T0, items: [{ mmsi: 123, lat: 1, lon: 1 }] }]
  const [track] = buildTracks(snaps, 'mmsi')
  assert.equal(track.id, '123')
})

test('empty / bad input yields no tracks', () => {
  assert.deepEqual(buildTracks([]), [])
  assert.deepEqual(buildTracks(null), [])
  assert.deepEqual(buildTracks([{ at: NaN, items: [{ id: 'A', lat: 1, lon: 1 }] }]), [])
})

test('trackStats: distance, bbox, duration, speed on a known path', () => {
  // A: three points 0.5deg of latitude apart along the 56E meridian == ~55.6km each leg
  const [a] = buildTracks(snapshots).filter((t) => t.id === 'A')
  const stats = trackStats(a)
  assert.deepEqual(stats.bbox, { minLat: 26.0, minLon: 56.0, maxLat: 27.0, maxLon: 56.0 })
  assert.ok(Math.abs(stats.distanceKm - 111.19) < 0.5, `distanceKm=${stats.distanceKm}`) // 1deg lat total
  assert.equal(stats.durationMin, 20)
  assert.ok(Math.abs(stats.avgSpeedKmh - 333.6) < 2, `avgSpeedKmh=${stats.avgSpeedKmh}`)
})

test('trackStats: single-fix track has zero distance/duration/speed', () => {
  const [b] = buildTracks([{ at: T0, items: [{ id: 'B', lat: 25, lon: 55 }] }])
  const stats = trackStats(b)
  assert.equal(stats.distanceKm, 0)
  assert.equal(stats.durationMin, 0)
  assert.equal(stats.avgSpeedKmh, 0)
  assert.deepEqual(stats.bbox, { minLat: 25, minLon: 55, maxLat: 25, maxLon: 55 })
})
