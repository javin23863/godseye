import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIoda } from '../src/outages-core.mjs'

const entry = (code, name, overall, event_cnt = 1) => ({
  scores: { overall },
  event_cnt,
  entity: { code, name, subnames: [], type: 'country' },
})
const summary = (data) => ({ type: 'outages.summary', data })
const centroids = { IR: [32.4, 53.7], SY: [34.8, 39.0] }

test('joins entity code to centroid, sorted score desc', () => {
  const pins = normalizeIoda(
    summary([entry('SY', 'Syrian Arab Republic', 50), entry('IR', 'Iran', 200)]),
    centroids,
  )
  assert.deepEqual(pins, [
    { id: 'IR', name: 'Iran', score: 200, lat: 32.4, lon: 53.7 },
    { id: 'SY', name: 'Syrian Arab Republic', score: 50, lat: 34.8, lon: 39.0 },
  ])
})

test('skips countries missing from the centroid map', () => {
  const pins = normalizeIoda(
    summary([entry('IR', 'Iran', 200), entry('GU', 'Guam', 900)]), // GU not in fixture centroids
    centroids,
  )
  assert.equal(pins.length, 1)
  assert.equal(pins[0].id, 'IR')
})

test('skips malformed rows (missing code/score) and non-array data, never throws', () => {
  assert.deepEqual(normalizeIoda(null, centroids), [])
  assert.deepEqual(normalizeIoda({}, centroids), [])
  const pins = normalizeIoda(
    summary([
      { scores: {}, entity: { code: 'IR', name: 'Iran' } }, // no overall
      { scores: { overall: 10 }, entity: {} }, // no code
      { scores: { overall: NaN }, entity: { code: 'SY', name: 'Syria' } },
      entry('IR', 'Iran', 42),
    ]),
    centroids,
  )
  assert.deepEqual(pins, [{ id: 'IR', name: 'Iran', score: 42, lat: 32.4, lon: 53.7 }])
})

test('caps output at 60 pins even with more scored entries', () => {
  const wide = {}
  const rows = []
  // build 70 fake 2-letter codes all present in the centroid map passed in
  for (let i = 0; i < 70; i++) {
    const code = 'A' + String.fromCharCode(65 + (i % 26)) + i // unique-ish key
    wide[code] = [i, i]
    rows.push(entry(code, code, 1000 - i))
  }
  const pins = normalizeIoda(summary(rows), wide)
  assert.equal(pins.length, 60)
  assert.equal(pins[0].score, 1000) // still sorted desc
})

test('default centroid export covers real IODA codes (e.g. IR, UA, MM)', () => {
  const pins = normalizeIoda(summary([entry('IR', 'Iran', 5), entry('UA', 'Ukraine', 9), entry('MM', 'Myanmar', 3)]))
  assert.deepEqual(
    pins.map((p) => p.id),
    ['UA', 'IR', 'MM'],
  )
})
