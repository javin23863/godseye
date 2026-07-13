import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNws, severityRank } from '../src/alerts-core.mjs'

const fc = (features) => ({ type: 'FeatureCollection', features })
const poly = (id, severity, ring, extra = {}) => ({
  id,
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [ring] },
  properties: { event: 'Test Event', severity, headline: `${severity} headline`, areaDesc: 'Test County', ...extra },
})

test('computes centroid from outer ring and severity order', () => {
  const data = fc([
    poly('a', 'Minor', [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]),
    poly('b', 'Extreme', [
      [10, 10],
      [12, 10],
      [12, 12],
      [10, 12],
    ]),
    poly('c', 'Severe', [
      [4, 4],
      [6, 4],
      [6, 6],
      [4, 6],
    ]),
    poly('d', 'Moderate', [
      [8, 8],
      [9, 8],
      [9, 9],
      [8, 9],
    ]),
  ])
  const pins = normalizeNws(data)
  assert.equal(pins.length, 4)
  // sorted Extreme -> Minor
  assert.deepEqual(pins.map((p) => p.severity), ['Extreme', 'Severe', 'Moderate', 'Minor'])
  assert.equal(pins[0].lon, 11)
  assert.equal(pins[0].lat, 11)
})

test('severityRank orders Extreme highest, Unknown lowest', () => {
  assert.ok(severityRank('Extreme') > severityRank('Severe'))
  assert.ok(severityRank('Severe') > severityRank('Moderate'))
  assert.ok(severityRank('Moderate') > severityRank('Minor'))
  assert.ok(severityRank('Minor') > severityRank('Unknown'))
  assert.equal(severityRank('bogus'), severityRank('Unknown'))
})

test('drops null-geometry features and non-Polygon geometry, keeps valid ones', () => {
  const data = fc([
    { id: 'null-geom', type: 'Feature', geometry: null, properties: { event: 'Zone Alert', severity: 'Severe' } },
    { id: 'point-geom', type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { event: 'X', severity: 'Minor' } },
    poly('ok', 'Unknown', [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]),
  ])
  const pins = normalizeNws(data)
  assert.equal(pins.length, 1)
  assert.equal(pins[0].id, 'ok')
  assert.equal(pins[0].severity, 'Unknown')
})

test('caps at 300 and includes ring for downstream polygon draw', () => {
  const many = Array.from({ length: 320 }, (_, i) =>
    poly(`f${i}`, 'Minor', [
      [i, i],
      [i + 1, i],
      [i + 1, i + 1],
      [i, i + 1],
    ]),
  )
  const pins = normalizeNws(fc(many))
  assert.equal(pins.length, 300)
  assert.equal(pins[0].ring.length, 4)
})
