import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTour, tourLabel } from '../src/kiosk-core.mjs'

const cities = [
  { name: 'A', pois: [{ name: 'a1', lon: 1, lat: 2, range: 100 }, { name: 'a2', lon: 3, lat: 4, range: 200 }] },
  { name: 'B', pois: [{ name: 'b1', lon: 5, lat: 6, range: 300 }] },
]

test('buildTour flattens all pois in order, tagged with city', () => {
  const t = buildTour(cities)
  assert.equal(t.length, 3)
  assert.deepEqual(t.map((s) => s.city), ['A', 'A', 'B'])
  assert.deepEqual(t.map((s) => s.name), ['a1', 'a2', 'b1'])
  assert.equal(t[2].range, 300)
})

test('tourLabel wraps and handles negatives + empty', () => {
  const t = buildTour(cities)
  assert.match(tourLabel(t, 0), /A · a1   \[1\/3\]/)
  assert.match(tourLabel(t, 3), /A · a1   \[1\/3\]/) // wraps back to start
  assert.match(tourLabel(t, 5), /B · b1   \[3\/3\]/)
  assert.match(tourLabel(t, -1), /B · b1   \[3\/3\]/)
  assert.equal(tourLabel([], 0), 'OPS-WALL')
})
