import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectDarkEvents } from '../src/darkvessel-detect.mjs'

const T = 1_700_000_000_000
const MIN = 60_000
const at = (m) => T + m * MIN
// ship(mmsi, sog) with a default Hormuz-ish position unless overridden
const ship = (mmsi, sog, lat = 26.5, lon = 56.2, name = `V${mmsi}`) => ({ mmsi, name, lat, lon, sog })
const snap = (m, items) => ({ at: at(m), items })
const decoy = ship(999, 8) // keeps snapshots non-empty and defines window bounds

test('closed gap: underway vessel vanishes then reappears -> flagged', () => {
  // 111 present@0 and @25, absent (decoy only) 5/10/15/20 -> 25min gap
  const snaps = [
    snap(0, [ship(111, 10), decoy]),
    snap(5, [decoy]),
    snap(10, [decoy]),
    snap(15, [decoy]),
    snap(20, [decoy]),
    snap(25, [ship(111, 10), decoy]),
  ]
  const [e] = detectDarkEvents(snaps, 20).filter((x) => x.mmsi === 111)
  assert.ok(e, 'expected a dark event for 111')
  assert.equal(e.gapMin, 25)
  assert.equal(e.lastSeen.at, at(0))
  assert.equal(e.seenAgain.at, at(25))
})

test('still dark: established track goes silent past 2x threshold -> flagged, seenAgain null', () => {
  // 222 seen @0 and @5 (a real track), then gone through window end @50; openGap 45 >= 40
  const snaps = [snap(0, [ship(222, 9), decoy]), snap(5, [ship(222, 9), decoy])]
  for (const m of [10, 20, 30, 40, 50]) snaps.push(snap(m, [decoy]))
  const [e] = detectDarkEvents(snaps, 20).filter((x) => x.mmsi === 222)
  assert.ok(e, 'expected a still-dark event for 222')
  assert.equal(e.seenAgain, null)
  assert.equal(e.gapMin, 45)
  assert.equal(e.lastSeen.at, at(5))
})

test('brief legitimate gap under threshold -> NOT flagged', () => {
  // 333 gone only 15min (< 20) then back
  const snaps = [
    snap(0, [ship(333, 10), decoy]),
    snap(5, [decoy]),
    snap(10, [decoy]),
    snap(15, [ship(333, 10), decoy]),
  ]
  assert.equal(detectDarkEvents(snaps, 20).filter((x) => x.mmsi === 333).length, 0)
})

test('reappearance far away: both endpoints captured regardless of distance', () => {
  // 444 lost at Hormuz, reappears 100+km away — detection does not gate on distance
  const snaps = [
    snap(0, [ship(444, 12, 26.5, 56.2), decoy]),
    snap(10, [decoy]),
    snap(20, [decoy]),
    snap(30, [ship(444, 12, 25.0, 57.5), decoy]),
  ]
  const [e] = detectDarkEvents(snaps, 20).filter((x) => x.mmsi === 444)
  assert.ok(e)
  assert.deepEqual(e.lastSeen, { lat: 26.5, lon: 56.2, at: at(0) })
  assert.deepEqual(e.seenAgain, { lat: 25.0, lon: 57.5, at: at(30) })
})

test('MMSI seen once -> ignored even with 2x trailing absence', () => {
  // 555 appears once @0, underway, then never again through @50 (openGap 50 >= 40) — but a
  // single crowd-sourced blip is not a track, so it must NOT be flagged.
  const snaps = [snap(0, [ship(555, 11), decoy])]
  for (const m of [10, 20, 30, 40, 50]) snaps.push(snap(m, [decoy]))
  assert.equal(detectDarkEvents(snaps, 20).filter((x) => x.mmsi === 555).length, 0)
})

test('anchored vessel (sog<=0.5) that vanishes -> NOT flagged', () => {
  const snaps = [
    snap(0, [ship(666, 0.2), decoy]),
    snap(10, [decoy]),
    snap(20, [decoy]),
    snap(30, [ship(666, 0.2), decoy]),
  ]
  assert.equal(detectDarkEvents(snaps, 20).filter((x) => x.mmsi === 666).length, 0)
})

test('recorder downtime (no intervening snapshot) is a data gap, not a dark event', () => {
  // only two snapshots exist, 25min apart, with NOTHING recorded between them
  const snaps = [snap(0, [ship(777, 10)]), snap(25, [ship(777, 10)])]
  assert.equal(detectDarkEvents(snaps, 20).length, 0)
})
