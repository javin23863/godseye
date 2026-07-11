import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTle } from '../src/tle-parse.mjs'

const ISS = `ISS (ZARYA)
1 25544U 98067A   26192.50000000  .00016717  00000-0  10270-3 0  9005
2 25544  51.6400 208.9163 0006317  69.9862  25.2906 15.54225995 12345`

test('parses name/line1/line2 triples with norad id', () => {
  const out = parseTle(ISS)
  assert.equal(out.length, 1)
  assert.equal(out[0].name, 'ISS (ZARYA)')
  assert.equal(out[0].noradId, '25544')
  assert.ok(out[0].line1.startsWith('1 25544U'))
})

test('throttle banner / garbage -> empty, no throw', () => {
  assert.deepEqual(parseTle('GP data has not updated since your last successful\ndownload.'), [])
  assert.deepEqual(parseTle(''), [])
})

test('unnamed entries get NORAD fallback name', () => {
  const noName = ISS.split('\n').slice(1).join('\n')
  const out = parseTle('\n' + noName)
  assert.equal(out[0]?.name, 'NORAD 25544')
})
