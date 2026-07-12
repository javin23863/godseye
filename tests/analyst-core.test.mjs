import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankAttention, applyGeoFilter } from '../src/analyst-core.mjs'

test('rankAttention orders by score descending', () => {
  const out = rankAttention([
    { kind: 'a', lat: 0, lon: 0, score: 1, text: 'low' },
    { kind: 'b', lat: 0, lon: 0, score: 9, text: 'high' },
    { kind: 'c', lat: 0, lon: 0, score: 5, text: 'mid' },
  ])
  assert.deepEqual(out.map((c) => c.text), ['high', 'mid', 'low'])
})

test('rankAttention is stable on ties (input order preserved)', () => {
  const out = rankAttention([
    { kind: 'a', lat: 0, lon: 0, score: 5, text: 'first' },
    { kind: 'b', lat: 0, lon: 0, score: 5, text: 'second' },
    { kind: 'c', lat: 0, lon: 0, score: 5, text: 'third' },
  ])
  assert.deepEqual(out.map((c) => c.text), ['first', 'second', 'third'])
})

test('applyGeoFilter includes/excludes by radius', () => {
  const items = [
    { lat: 26.5, lon: 56.3, id: 'near' }, // ~0km from center
    { lat: 27.5, lon: 56.3, id: 'far' }, // ~111km north
  ]
  const out = applyGeoFilter(items, { center: { lat: 26.5, lon: 56.3 }, radiusKm: 50 })
  assert.deepEqual(out.map((i) => i.id), ['near'])
})

test('applyGeoFilter drops items below the value threshold', () => {
  const items = [
    { lat: 0, lon: 0, mag: 5.2 },
    { lat: 0, lon: 0, mag: 2.1 },
    { lat: 0, lon: 0 }, // missing valueKey -> treated as -Infinity -> dropped
  ]
  const out = applyGeoFilter(items, { minValue: 4, valueKey: 'mag' })
  assert.equal(out.length, 1)
  assert.equal(out[0].mag, 5.2)
})

test('empty filter passes everything through', () => {
  const items = [{ lat: 0, lon: 0 }, { lat: 99, lon: 99 }, {}]
  assert.deepEqual(applyGeoFilter(items, {}), items)
  assert.deepEqual(applyGeoFilter(items, undefined), items)
})

test('geo + value filters compose', () => {
  const items = [
    { lat: 26.5, lon: 56.3, mag: 6 }, // near + strong -> keep
    { lat: 26.5, lon: 56.3, mag: 1 }, // near but weak -> drop
    { lat: 40, lon: 56.3, mag: 6 }, // strong but far -> drop
  ]
  const out = applyGeoFilter(items, {
    center: { lat: 26.5, lon: 56.3 },
    radiusKm: 50,
    minValue: 4,
    valueKey: 'mag',
  })
  assert.equal(out.length, 1)
  assert.equal(out[0].mag, 6)
})
