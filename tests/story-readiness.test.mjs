import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsStoryFallback, summarizeStoryReadiness } from '../src/story-readiness.mjs'

const passing = () => ({
  camera: { level: 'pass', detail: 'globe visible' },
  tiles: { level: 'pass', detail: 'tiles ready' },
  sources: { level: 'pass', detail: 'one registered source' },
  overlays: { level: 'pass', detail: 'overlay fits' },
  contrast: { level: 'pass', detail: 'contrast ready' },
})

test('Story readiness is ready only when no check fails', () => {
  const ready = summarizeStoryReadiness(passing())
  assert.equal(ready.ready, true)
  assert.equal(ready.checks.camera, 'pass')
  assert.deepEqual(ready.warnings, [])

  const checks = passing()
  checks.sources = { level: 'warn', detail: 'one unregistered active layer' }
  const warned = summarizeStoryReadiness(checks)
  assert.equal(warned.ready, true)
  assert.deepEqual(warned.warnings, ['sources: one unregistered active layer'])
})

test('camera fallback is limited to camera and contrast failures', () => {
  const visual = passing()
  visual.contrast = { level: 'fail', detail: 'frame is blank' }
  const visualResult = summarizeStoryReadiness(visual)
  assert.equal(visualResult.ready, false)
  assert.equal(needsStoryFallback(visualResult), true)

  const provenance = passing()
  provenance.sources = { level: 'fail', detail: 'no active registered source' }
  assert.equal(needsStoryFallback(summarizeStoryReadiness(provenance)), false)

  const tiles = passing()
  tiles.tiles = { level: 'fail', detail: 'tiles loading' }
  assert.equal(needsStoryFallback(summarizeStoryReadiness(tiles)), false)
})

test('Story readiness rejects incomplete check sets', () => {
  assert.throws(() => summarizeStoryReadiness({ camera: { level: 'pass', detail: 'ok' } }), /requires tiles/)
})
