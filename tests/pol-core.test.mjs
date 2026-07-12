import { test } from 'node:test'
import assert from 'node:assert/strict'
import { patternOfLife, deviationScore } from '../src/pol-core.mjs'

const HOUR = 3_600_000
// a UTC day base at exactly 00:00Z so getUTCHours() lines up with the offset we add
const DAY0 = Date.UTC(2024, 0, 1, 0, 0, 0)

/** one fix at hour h (UTC) at a given point */
const fixAt = (h, lat, lon) => ({ at: DAY0 + h * HOUR, lat, lon })

test('hour histogram buckets fixes by UTC hour', () => {
  const track = { id: 'A', fixes: [fixAt(6, 1, 1), fixAt(6, 1, 1), fixAt(9, 1, 1), fixAt(23, 1, 1)] }
  const { hourHistogramUTC } = patternOfLife(track)
  assert.equal(hourHistogramUTC.length, 24)
  assert.equal(hourHistogramUTC[6], 2)
  assert.equal(hourHistogramUTC[9], 1)
  assert.equal(hourHistogramUTC[23], 1)
  assert.equal(hourHistogramUTC[0], 0)
})

test('active hours are the buckets busier than a flat baseline', () => {
  // 5 fixes packed into hours 6-8, nothing else -> those three read as active
  const track = { id: 'A', fixes: [fixAt(6, 1, 1), fixAt(7, 1, 1), fixAt(7, 1, 1), fixAt(8, 1, 1), fixAt(8, 1, 1)] }
  const { activeHoursUTC } = patternOfLife(track)
  assert.deepEqual(activeHoursUTC, [6, 7, 8])
})

test('median speed on a known 1deg-lat-per-hour path (~111 km/h)', () => {
  // three points one degree of latitude apart, one hour between each -> ~111.19 km/h per leg
  const track = { id: 'A', fixes: [fixAt(0, 25, 55), fixAt(1, 26, 55), fixAt(2, 27, 55)] }
  const { medianSpeedKmh } = patternOfLife(track)
  assert.ok(Math.abs(medianSpeedKmh - 111.19) < 0.5, `medianSpeedKmh=${medianSpeedKmh}`)
})

test('dwell detection: only revisited grid cells survive', () => {
  // A lingers at ~(25,55) three times; a one-off pass at (40,10) is not a dwell
  const track = {
    id: 'A',
    fixes: [fixAt(0, 25.0, 55.0), fixAt(1, 25.01, 55.01), fixAt(2, 25.0, 55.0), fixAt(3, 40, 10)],
  }
  const { dwellZones } = patternOfLife(track)
  assert.equal(dwellZones.length, 1)
  assert.equal(dwellZones[0].count, 3)
  assert.ok(Math.abs(dwellZones[0].lat - 25) < 0.05 && Math.abs(dwellZones[0].lon - 55) < 0.05)
})

test('empty / bad track degrades to a zeroed profile', () => {
  const p = patternOfLife({ id: 'A', fixes: [{ lat: NaN, lon: 1, at: DAY0 }] })
  assert.deepEqual(p.hourHistogramUTC, new Array(24).fill(0))
  assert.deepEqual(p.activeHoursUTC, [])
  assert.equal(p.medianSpeedKmh, 0)
  assert.deepEqual(p.dwellZones, [])
  assert.deepEqual(p.span, { first: null, last: null })
  assert.deepEqual(patternOfLife(null).activeHoursUTC, [])
})

test('deviation extremes: busiest ref hour -> 0, unseen ref hour -> 1', () => {
  const ref = new Array(24).fill(0)
  ref[8] = 10 // reference peak at 08Z
  ref[9] = 5
  // recent fix at 08Z == the peak -> fully normal
  assert.equal(deviationScore({ id: 'A', fixes: [fixAt(8, 1, 1)] }, ref), 0)
  // recent fix at 03Z, which the reference has never seen -> fully anomalous
  assert.equal(deviationScore({ id: 'A', fixes: [fixAt(3, 1, 1)] }, ref), 1)
  // recent fix at 09Z (half the peak) -> 0.5
  assert.equal(deviationScore({ id: 'A', fixes: [fixAt(9, 1, 1)] }, ref), 0.5)
})

test('deviation guards: empty track or empty/flat-zero reference -> 0', () => {
  assert.equal(deviationScore({ id: 'A', fixes: [] }, [1, 2, 3]), 0)
  assert.equal(deviationScore({ id: 'A', fixes: [fixAt(8, 1, 1)] }, []), 0)
  assert.equal(deviationScore({ id: 'A', fixes: [fixAt(8, 1, 1)] }, new Array(24).fill(0)), 0)
})
