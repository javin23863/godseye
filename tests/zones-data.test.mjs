import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ZONES_DATA } from '../src/zones-data.mjs'

const STATUSES = new Set(['ACTIVE', 'CONTESTED', 'DISPUTED'])

test('at least one zone exists', () => {
  assert.ok(ZONES_DATA.length > 0)
})

test('every zone has a valid ring, status, and non-empty note', () => {
  for (const z of ZONES_DATA) {
    assert.ok(z.ring.length >= 4, `${z.id}: ring needs >=4 vertices, got ${z.ring.length}`)
    for (const [lon, lat] of z.ring) {
      assert.ok(lon >= -180 && lon <= 180, `${z.id}: lon ${lon} out of range`)
      assert.ok(lat >= -90 && lat <= 90, `${z.id}: lat ${lat} out of range`)
    }
    assert.ok(STATUSES.has(z.status), `${z.id}: bad status ${z.status}`)
    assert.ok(typeof z.note === 'string' && z.note.trim().length > 0, `${z.id}: empty note`)
    assert.ok(/^\d{4}-\d{2}$/.test(z.asOf), `${z.id}: bad asOf ${z.asOf}`)
  }
})

test('zone ids are unique', () => {
  const ids = ZONES_DATA.map((z) => z.id)
  assert.strictEqual(new Set(ids).size, ids.length)
})

test('required zones are present with the right status', () => {
  const byId = new Map(ZONES_DATA.map((z) => [z.id, z]))
  const expected = {
    'ukraine-east': 'ACTIVE',
    gaza: 'ACTIVE',
    sudan: 'ACTIVE',
    myanmar: 'ACTIVE',
    'drc-east': 'ACTIVE',
    'sahel-tri-border': 'ACTIVE',
    'red-sea-corridor': 'ACTIVE',
    'hormuz-tension': 'ACTIVE',
    'somalia-south-central': 'ACTIVE',
    'haiti-portauprince': 'ACTIVE',
    'taiwan-strait': 'CONTESTED',
    'south-china-sea-spratlys': 'CONTESTED',
    'kashmir-loc': 'CONTESTED',
    'western-sahara': 'DISPUTED',
    essequibo: 'DISPUTED',
    'golan-heights': 'DISPUTED',
  }
  for (const [id, status] of Object.entries(expected)) {
    assert.ok(byId.has(id), `missing required zone ${id}`)
    assert.strictEqual(byId.get(id).status, status, `${id} should be ${status}`)
  }
})
