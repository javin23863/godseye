import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEvidencePacket } from '../src/evidence-packet.mjs'

const scene = {
  v: 2,
  observedAt: '2026-07-15T03:04:05.000Z',
  cam: { lon: 56.3, lat: 26.5, height: 800_000, heading: 1.2, pitch: -0.8 },
  layers: ['ships', 'unknown-layer'],
}

test('evidence packet keeps full source URLs and flags unregistered layers', () => {
  const packet = createEvidencePacket({
    scene,
    claims: [{ text: 'AIS ships were active in the captured scene', kind: 'observation', sourceKeys: ['ships'] }],
  })

  assert.equal(packet.schema, 'evidence-packet/v1')
  assert.equal(packet.sources[0].key, 'ships')
  assert.match(packet.sources[0].url, /^https:\/\//)
  assert.deepEqual(packet.warnings, ['No provenance registered for active layer: unknown-layer'])
})

test('evidence packet rejects claims not supported by the captured scene', () => {
  assert.throws(
    () => createEvidencePacket({
      scene,
      claims: [{ text: 'Oil moved', kind: 'inference', sourceKeys: ['oil'] }],
    }),
    /outside captured scene/,
  )
})

test('evidence packet rejects malformed scenes and artifacts at the boundary', () => {
  assert.throws(() => createEvidencePacket({ scene: { ...scene, cam: {} } }), /valid scene-state v2/)
  assert.throws(() => createEvidencePacket({ scene, artifacts: [{ name: 'clip' }] }), /artifact needs/)
})
