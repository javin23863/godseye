import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOURCES, sourceFor, describeSources } from '../src/sources.ts'

test('sourceFor returns a fully populated record for a live-feed layer', () => {
  const s = sourceFor('flights')
  assert.ok(s)
  for (const field of ['label', 'provider', 'url', 'freshness', 'limits']) {
    assert.equal(typeof s[field], 'string')
    assert.ok(s[field].length > 0, `${field} should be non-empty`)
  }
  assert.match(s.provider, /OpenSky/)
})

test('sourceFor works for ships too', () => {
  const s = sourceFor('ships')
  assert.ok(s)
  assert.match(s.provider, /aisstream/)
  assert.match(s.limits, /backfill/) // the load-bearing caveat must survive
})

test('sourceFor returns undefined for an unknown key', () => {
  assert.equal(sourceFor('nope'), undefined)
})

test('every registered source is fully populated', () => {
  for (const [key, s] of Object.entries(SOURCES)) {
    for (const field of ['label', 'provider', 'url', 'freshness', 'limits']) {
      assert.ok(s[field] && s[field].length > 0, `${key}.${field} empty`)
    }
  }
})

test('describeSources filters to active keys, in order, dropping url', () => {
  const badges = describeSources(['ships', 'flights'])
  assert.equal(badges.length, 2)
  assert.equal(badges[0].label, 'SHIPS') // order preserved
  assert.equal(badges[1].label, 'FLIGHTS')
  assert.equal(badges[0].url, undefined) // url stripped from badges
  assert.deepEqual(Object.keys(badges[0]).sort(), ['freshness', 'label', 'limits', 'provider'])
})

test('describeSources skips unknown keys', () => {
  assert.deepEqual(describeSources(['nope', 'flights', 'ghost']).map((b) => b.label), ['FLIGHTS'])
  assert.deepEqual(describeSources([]), [])
})
