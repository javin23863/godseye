import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsStoryFallback, storySafeBounds, summarizeStoryReadiness, summarizeStoryTiles } from '../src/story-readiness.mjs'
import { orderedStoryLabels } from '../src/presentation.ts'

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

test('Story safe bounds reserve the caption band in both target aspects', () => {
  const landscape = storySafeBounds(1920, 1080)
  const vertical = storySafeBounds(1080, 1920)
  assert.equal(landscape.bottom, 1080 - Math.max(27, 1080 * 0.18))
  assert.equal(vertical.bottom, 1920 - Math.max(27, 1920 * 0.24))
  assert.ok(landscape.right > landscape.left)
  assert.ok(vertical.right > vertical.left)
})

test('Story tile readiness blocks visible 3D tilesets until they finish loading', () => {
  assert.deepEqual(summarizeStoryTiles(false), { level: 'fail', detail: 'globe tiles are still loading' })
  assert.equal(summarizeStoryTiles(true, [{ tilesLoaded: false }]).level, 'fail')
  assert.match(summarizeStoryTiles(true, [{ tilesLoaded: false }]).detail, /visible 3D tileset/)
  assert.equal(summarizeStoryTiles(true, [{ tilesLoaded: true }]).level, 'pass')
})

test('Story tile readiness can warn on fully rendered coverage while refinements continue', () => {
  assert.deepEqual(summarizeStoryTiles(false, [], true), {
    level: 'warn',
    detail: 'visible globe coverage is rendered; background refinement remains',
  })
})

test('explicit Story layer order isolates the primary plus three supports', () => {
  const active = ['EARTHQUAKES 24H', 'FLIGHTS', 'ACTIVE FIRES', 'WX ALERTS (US)', 'NET OUTAGES']
  assert.deepEqual(
    orderedStoryLabels(active, ['ACTIVE FIRES', 'WX ALERTS (US)', 'NET OUTAGES', 'EARTHQUAKES 24H', 'FLIGHTS']),
    ['ACTIVE FIRES', 'WX ALERTS (US)', 'NET OUTAGES', 'EARTHQUAKES 24H'],
  )
  assert.deepEqual(orderedStoryLabels(active), active.slice(0, 4))
})
