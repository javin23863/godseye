import { test } from 'node:test'
import assert from 'node:assert/strict'
import { segmentsCross, crossingSide, detectCrossings } from '../src/gate-geom.mjs'

// A simple vertical gate along lon=0 from (0,-1) to (0,1), directed north (+y).
// For a north-pointing gate: moving west (left) => IN, moving east (right) => OUT.
const gate = { a: { lon: 0, lat: -1 }, b: { lon: 0, lat: 1 } }

test('segmentsCross: proper crossing, near-miss, collinear, touch', () => {
  assert.equal(segmentsCross({ lon: -1, lat: 0 }, { lon: 1, lat: 0 }, gate.a, gate.b), true)
  // crosses lon=0 at lat=2, outside the gate's [-1,1] extent
  assert.equal(segmentsCross({ lon: -1, lat: 2 }, { lon: 1, lat: 2 }, gate.a, gate.b), false)
  // collinear with the gate
  assert.equal(segmentsCross({ lon: 0, lat: -0.5 }, { lon: 0, lat: 0.5 }, gate.a, gate.b), false)
  // endpoint lands exactly on the gate => graze, not a transit
  assert.equal(segmentsCross({ lon: -1, lat: 0 }, { lon: 0, lat: 0 }, gate.a, gate.b), false)
})

test('crossingSide: left is positive, right is negative, on-line is zero', () => {
  assert.ok(crossingSide(gate.a, gate.b, { lon: -1, lat: 0 }) > 0)
  assert.ok(crossingSide(gate.a, gate.b, { lon: 1, lat: 0 }) < 0)
  assert.equal(crossingSide(gate.a, gate.b, { lon: 0, lat: 0 }), 0)
})

test('clean crossing IN (east -> west)', () => {
  const tracks = new Map([[111, [{ lon: 1, lat: 0, at: 10 }, { lon: -1, lat: 0, at: 20 }]]])
  assert.deepEqual(detectCrossings(gate, tracks), [{ mmsi: 111, at: 20, dir: 'IN' }])
})

test('clean crossing OUT (west -> east)', () => {
  const tracks = new Map([[222, [{ lon: -1, lat: 0, at: 5 }, { lon: 1, lat: 0, at: 15 }]]])
  assert.deepEqual(detectCrossings(gate, tracks), [{ mmsi: 222, at: 15, dir: 'OUT' }])
})

test('near-miss and collinear tracks yield no crossings', () => {
  const tracks = new Map([
    [1, [{ lon: -1, lat: 2 }, { lon: 1, lat: 2 }]], // passes outside the gate extent
    [2, [{ lon: 0, lat: -0.5 }, { lon: 0, lat: 0.5 }]], // rides along the gate line
    [3, [{ lon: -1, lat: 0 }]], // single point, no segment
  ])
  assert.deepEqual(detectCrossings(gate, tracks), [])
})

test('two vessels: one IN, one OUT', () => {
  const tracks = new Map([
    [111, [{ lon: 1, lat: 0, at: 20 }, { lon: -1, lat: 0, at: 30 }]], // IN
    [222, [{ lon: -1, lat: 0, at: 40 }, { lon: 1, lat: 0, at: 50 }]], // OUT
  ])
  const res = detectCrossings(gate, tracks)
  assert.equal(res.length, 2)
  assert.equal(res.find((c) => c.mmsi === 111).dir, 'IN')
  assert.equal(res.find((c) => c.mmsi === 222).dir, 'OUT')
})

test('one vessel crossing back and forth counts twice', () => {
  const tracks = new Map([
    [333, [{ lon: -1, lat: 0, at: 1 }, { lon: 1, lat: 0, at: 2 }, { lon: -1, lat: 0, at: 3 }]],
  ])
  const res = detectCrossings(gate, tracks)
  assert.deepEqual(res.map((c) => c.dir), ['OUT', 'IN'])
  assert.deepEqual(res.map((c) => c.at), [2, 3])
})
