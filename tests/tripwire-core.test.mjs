// Headless tests for the tripwire pure core: context folding + preset->condition mapping,
// then a full round-trip through the real rules-eval evaluator so a "dark in AOI" preset
// actually fires on injected data (the whole sentinel logic path, no Cesium/DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCtxFromSnapshots, presetCondition, tripwireName, TRIPWIRE_PRESETS } from '../src/tripwire-core.mjs'
import { evaluateCondition } from '../src/rules-eval.mjs'

test('buildCtxFromSnapshots folds a Map into counts + items', () => {
  const snaps = new Map([
    ['military', { items: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }] }],
    ['flights', { items: [] }],
  ])
  const ctx = buildCtxFromSnapshots(snaps)
  assert.equal(ctx.counts.military, 2)
  assert.equal(ctx.counts.flights, 0)
  assert.deepEqual(ctx.items.military[0], { lat: 1, lon: 2 })
})

test('buildCtxFromSnapshots accepts a plain object and tolerates junk snapshots', () => {
  const ctx = buildCtxFromSnapshots({ ships: { items: [{ lat: 0, lon: 0 }] }, gpsjam: {}, quakes: null })
  assert.equal(ctx.counts.ships, 1)
  assert.equal(ctx.counts.gpsjam, 0) // missing items -> empty
  assert.equal(ctx.counts.quakes, 0) // null snapshot -> empty, no throw
})

test('every non-param preset maps to an inAoi condition on its layer', () => {
  const aoi = { lat: 26.5, lon: 56.3, radiusKm: 50 }
  for (const p of TRIPWIRE_PRESETS.filter((x) => !x.param)) {
    const cond = presetCondition(p.id, aoi)
    assert.equal(cond.type, 'inAoi')
    assert.equal(cond.layer, p.layer)
    assert.equal(cond.radiusKm, 50)
  }
})

test('param presets carry the threshold', () => {
  const aoi = { lat: 0, lon: 0, radiusKm: 10 }
  assert.deepEqual(presetCondition('flights', aoi, 100), { type: 'count', layer: 'flights', op: '>', value: 100 })
  const q = presetCondition('quake', aoi, 5)
  assert.equal(q.type, 'near')
  assert.equal(q.minValue, 5)
  assert.equal(q.valueKey, 'mag')
})

test('unknown preset -> null', () => {
  assert.equal(presetCondition('nope', { lat: 0, lon: 0, radiusKm: 1 }), null)
})

test('tripwireName bakes the param in', () => {
  assert.equal(tripwireName('flights', 250), 'FLIGHTS > 250')
  assert.equal(tripwireName('quake', 6), 'QUAKE M>=6 NEAR AOI')
  assert.equal(tripwireName('mil'), 'MILITARY IN AOI')
})

test('end-to-end: dark-in-AOI preset fires on a still-dark vessel inside the ring', () => {
  const aoi = { lat: 26.5, lon: 56.3, radiusKm: 40 }
  const cond = presetCondition('dark', aoi)
  // synthetic 'dark' pseudo-layer, exactly what tripwires.ts injects (lat/lon of last fix)
  const inside = buildCtxFromSnapshots({ dark: { items: [{ lat: 26.6, lon: 56.4, mmsi: 1, name: 'GHOST' }] } })
  const far = buildCtxFromSnapshots({ dark: { items: [{ lat: 10, lon: 10, mmsi: 2, name: 'CLEAR' }] } })
  assert.equal(evaluateCondition(cond, inside).matched, true)
  assert.equal(evaluateCondition(cond, far).matched, false)
})

test('end-to-end: FLIGHTS > N fires only above the threshold', () => {
  const cond = presetCondition('flights', { lat: 0, lon: 0, radiusKm: 1 }, 2)
  const many = buildCtxFromSnapshots({ flights: { items: [{}, {}, {}] } })
  const few = buildCtxFromSnapshots({ flights: { items: [{}] } })
  assert.equal(evaluateCondition(cond, many).matched, true)
  assert.equal(evaluateCondition(cond, few).matched, false)
})
