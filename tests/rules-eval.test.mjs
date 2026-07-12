import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm, evaluateCondition, fireEdges } from '../src/rules-eval.mjs'

test('haversineKm: zero distance and a known span', () => {
  assert.equal(haversineKm(26.5, 56.3, 26.5, 56.3), 0)
  // ~1 degree of latitude ≈ 111 km
  const km = haversineKm(0, 0, 1, 0)
  assert.ok(Math.abs(km - 111.2) < 1, `got ${km}`)
})

test('count op compares ctx.counts[layer]', () => {
  const ctx = { counts: { aircraft: 5 }, items: {} }
  assert.equal(evaluateCondition({ type: 'count', layer: 'aircraft', op: '>', value: 3 }, ctx).matched, true)
  assert.equal(evaluateCondition({ type: 'count', layer: 'aircraft', op: '>', value: 5 }, ctx).matched, false)
  assert.equal(evaluateCondition({ type: 'count', layer: 'aircraft', op: '>=', value: 5 }, ctx).matched, true)
  assert.equal(evaluateCondition({ type: 'count', layer: 'aircraft', op: '<=', value: 5 }, ctx).matched, true)
  assert.equal(evaluateCondition({ type: 'count', layer: 'aircraft', op: '<', value: 5 }, ctx).matched, false)
  // missing layer counts as 0
  assert.equal(evaluateCondition({ type: 'count', layer: 'ships', op: '>', value: 0 }, ctx).matched, false)
})

test('inAoi returns only items within radiusKm', () => {
  const ctx = {
    counts: {},
    items: {
      ships: [
        { mmsi: 1, lat: 26.5, lon: 56.3 }, // at center
        { mmsi: 2, lat: 26.55, lon: 56.3 }, // ~5.5 km away
        { mmsi: 3, lat: 30.0, lon: 56.3 }, // ~390 km away
      ],
    },
  }
  const res = evaluateCondition({ type: 'inAoi', layer: 'ships', lat: 26.5, lon: 56.3, radiusKm: 10 }, ctx)
  assert.equal(res.matched, true)
  assert.deepEqual(res.hits.map((h) => h.mmsi), [1, 2])

  const none = evaluateCondition({ type: 'inAoi', layer: 'ships', lat: 26.5, lon: 56.3, radiusKm: 0.1 }, ctx)
  assert.equal(none.matched, true) // the exact-center item is at distance 0
  assert.deepEqual(none.hits.map((h) => h.mmsi), [1])

  const emptyLayer = evaluateCondition({ type: 'inAoi', layer: 'planes', lat: 26.5, lon: 56.3, radiusKm: 10 }, ctx)
  assert.deepEqual(emptyLayer, { matched: false, hits: [] })
})

test('near with minValue filters by valueKey (quake magnitude)', () => {
  const ctx = {
    counts: {},
    items: {
      quakes: [
        { id: 'q1', lat: 26.5, lon: 56.3, mag: 6.2 }, // near + strong
        { id: 'q2', lat: 26.5, lon: 56.3, mag: 3.1 }, // near but weak
        { id: 'q3', lat: 40.0, lon: 56.3, mag: 7.0 }, // strong but far
      ],
    },
  }
  const res = evaluateCondition(
    { type: 'near', layer: 'quakes', lat: 26.5, lon: 56.3, radiusKm: 50, minValue: 5, valueKey: 'mag' },
    ctx,
  )
  assert.equal(res.matched, true)
  assert.deepEqual(res.hits.map((h) => h.id), ['q1'])

  // without a threshold, both nearby quakes hit
  const noThresh = evaluateCondition({ type: 'near', layer: 'quakes', lat: 26.5, lon: 56.3, radiusKm: 50 }, ctx)
  assert.deepEqual(noThresh.hits.map((h) => h.id), ['q1', 'q2'])
})

test('unknown / malformed condition type is inert', () => {
  assert.deepEqual(evaluateCondition({ type: 'bogus' }, { counts: {}, items: {} }), { matched: false, hits: [] })
  assert.deepEqual(evaluateCondition(undefined, { counts: {}, items: {} }), { matched: false, hits: [] })
})

test('fireEdges debounce: fires once while matched, re-fires after going false then true', () => {
  const rules = [{ id: 'r1', condition: { type: 'count', layer: 'aircraft', op: '>', value: 2 } }]
  const state = new Map()
  const hi = { counts: { aircraft: 5 }, items: {} }
  const lo = { counts: { aircraft: 1 }, items: {} }

  // first matched pass -> fires
  assert.equal(fireEdges(rules, hi, state).length, 1)
  // still matched -> debounced, no re-fire
  assert.equal(fireEdges(rules, hi, state).length, 0)
  // goes false -> no fire
  assert.equal(fireEdges(rules, lo, state).length, 0)
  // rises again -> fires
  assert.equal(fireEdges(rules, hi, state).length, 1)
})
