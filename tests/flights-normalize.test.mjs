import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOpenSky, normalizeAdsbMil } from '../src/flights-normalize.mjs'

test('openSky: real state-vector shape, drops grounded and positionless', () => {
  const out = normalizeOpenSky({
    states: [
      ['39de4f', 'TVF21CH ', 'France', 1783769470, 1783769470, 3.0616, 48.7862, 3299.46, false, 159.02, 79.56, 5.2, null, 3543.3, null, false, 0],
      ['aaaaaa', '', 'X', 0, 0, null, null, 100, false, 0, 0, 0, null, null, null, false, 0], // no position
      ['bbbbbb', 'GND1', 'X', 0, 0, 1, 2, 0, true, 0, 0, 0, null, null, null, false, 0], // on ground
      ['cccccc', null, 'X', 0, 0, 5, 6, null, false, 0, null, 0, null, null, null, false, 0], // sparse
    ],
  })
  assert.equal(out.length, 2)
  assert.deepEqual(out[0], { id: 'os-39de4f', callsign: 'TVF21CH', lon: 3.0616, lat: 48.7862, altM: 3543.3, heading: 79.56 })
  assert.deepEqual(out[1], { id: 'os-cccccc', callsign: 'CCCCCC', lon: 5, lat: 6, altM: 0, heading: 0 })
})

test('openSky: null states -> empty', () => {
  assert.deepEqual(normalizeOpenSky({ states: null }), [])
  assert.deepEqual(normalizeOpenSky({}), [])
})

test('adsbMil: real /v2/mil shape, ft->m, drops ground/positionless', () => {
  const out = normalizeAdsbMil({
    ac: [
      { hex: 'ae080e', flight: 'RCH5055 ', r: '99-0168', t: 'C17', alt_baro: 1550, alt_geom: 1475, track: 80.31, lat: 61.237015, lon: -149.982997 },
      { hex: 'ffffff', alt_baro: 'ground', lat: 1, lon: 2 },
      { hex: 'eeeeee', flight: '', r: '58-0100' }, // no position
      { hex: 'dddddd', lat: 3, lon: 4 }, // sparse -> callsign from hex, alt 0
    ],
  })
  assert.equal(out.length, 2)
  assert.equal(out[0].id, 'mil-ae080e')
  assert.equal(out[0].callsign, 'RCH5055')
  assert.ok(Math.abs(out[0].altM - 1475 * 0.3048) < 1e-9)
  assert.deepEqual(out[1], { id: 'mil-dddddd', callsign: 'DDDDDD', lon: 4, lat: 3, altM: 0, heading: 0 })
})
