import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRoad, pointAt } from '../src/road-geom.mjs'

test('buildRoad: cumulative lengths on a 1-degree east-west line at equator', () => {
  const r = buildRoad([
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
  ])
  assert.ok(r)
  assert.ok(Math.abs(r.length - 111_320) < 200) // ~111.32 km per degree at the equator
})

test('pointAt: midpoint and clamping', () => {
  const r = buildRoad([
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
  ])
  const mid = pointAt(r, r.length / 2)
  assert.ok(Math.abs(mid.lon - 0.5) < 1e-6)
  assert.deepEqual(pointAt(r, -50), { lat: 0, lon: 0 })
  assert.deepEqual(pointAt(r, r.length + 50), { lat: 0, lon: 1 })
})

test('degenerate ways rejected', () => {
  assert.equal(buildRoad([{ lat: 0, lon: 0 }]), null)
  assert.equal(buildRoad([{ lat: 0, lon: 0 }, { lat: 0, lon: 0 }]), null)
  assert.equal(buildRoad(undefined), null)
})
