import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeState, decodeState } from '../src/scene-state-codec.mjs'

test('full state round-trips losslessly', () => {
  const state = {
    v: 1,
    cam: { lon: 56.3, lat: 26.5, height: 1_200_000, heading: 1.5707963, pitch: -0.7853981 },
    t: 1_752_000_000_000,
    layers: ['flights', 'ships', 'gpsjam'],
    aois: [
      { lat: 26.5, lon: 56.3, radiusKm: 50, name: 'Hormuz' },
      { lat: 25.2, lon: 55.27, radiusKm: 10 },
    ],
  }
  assert.deepEqual(decodeState(encodeState(state)), state)
})

test('token is URL-safe and unpadded', () => {
  const token = encodeState({ v: 1, cam: { lon: 0, lat: 0, height: 0, heading: 0, pitch: 0 } })
  assert.match(token, /^[A-Za-z0-9_-]+$/)
})

test('unicode AOI name survives (UTF-8 path)', () => {
  const state = { v: 1, cam: { lon: 1, lat: 2, height: 3, heading: 0, pitch: 0 }, aois: [{ lat: 0, lon: 0, radiusKm: 5, name: 'Orm_Strasse_Zürich_海峡' }] }
  assert.deepEqual(decodeState(encodeState(state)), state)
})

test('garbage decodes to null, never throws', () => {
  assert.equal(decodeState('garbage'), null)
})

test('valid base64 of non-JSON decodes to null', () => {
  const notJson = Buffer.from('hello world').toString('base64url')
  assert.equal(decodeState(notJson), null)
})

test('valid JSON that is not an object decodes to null', () => {
  const bareNumber = Buffer.from('42').toString('base64url')
  assert.equal(decodeState(bareNumber), null)
})

test('empty and partial states round-trip', () => {
  const empty = { v: 1, cam: { lon: 0, lat: 0, height: 0, heading: 0, pitch: 0 } }
  assert.deepEqual(decodeState(encodeState(empty)), empty)
  const partial = { v: 1, cam: { lon: 10, lat: 20, height: 30, heading: 0.1, pitch: -0.2 }, layers: ['flights'] }
  assert.deepEqual(decodeState(encodeState(partial)), partial)
})

test('v2 scene round-trips display and observation metadata', () => {
  const state = {
    v: 2,
    observedAt: '2026-07-15T03:04:05.000Z',
    cam: { lon: 56.3, lat: 26.5, height: 800_000, heading: 1.2, pitch: -0.8 },
    t: 1_752_000_000_000,
    layers: ['ships', 'gpsjam'],
    style: 'FLIR',
    basemap: 'google3d',
  }
  assert.deepEqual(decodeState(encodeState(state)), state)
})

test('v2 rejects malformed integration state while v1 stays compatible', () => {
  assert.equal(decodeState(encodeState({ v: 2, observedAt: 'not-a-date', cam: {} })), null)
  assert.equal(decodeState(encodeState({ v: 3, cam: {} })), null)
  assert.deepEqual(decodeState(encodeState({ v: 1 })), { v: 1 })
})
