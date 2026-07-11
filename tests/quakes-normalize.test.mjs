import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuakes } from '../src/quakes-normalize.mjs'

test('normalizes valid features, drops broken ones, defaults missing fields', () => {
  const out = normalizeQuakes({
    features: [
      { id: 'a', geometry: { coordinates: [10, 20, 5.5] }, properties: { mag: 4.2, place: 'X', time: 123 } },
      { id: 'broken', geometry: { coordinates: [NaN, 20] }, properties: {} },
      { id: 'no-geom', properties: { mag: 1 } },
      { id: 'sparse', geometry: { coordinates: [1, 2] }, properties: { mag: null } },
    ],
  })
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { id: 'a', lon: 10, lat: 20, depthKm: 5.5, mag: 4.2, place: 'X', time: 123 })
  assert.deepEqual(out[1], { id: 'sparse', lon: 1, lat: 2, depthKm: 0, mag: 0, place: 'unknown', time: 0 })
})

test('empty / missing features -> empty array', () => {
  assert.deepEqual(normalizeQuakes({}), [])
  assert.deepEqual(normalizeQuakes({ features: [] }), [])
})
