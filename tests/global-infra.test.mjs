import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cableSegments } from '../src/global-infra-core.mjs'

const sample = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { id: 'atlantic', name: 'Atlantic-1', color: '#ff0000', feature_id: 'atlantic-0' },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[-70, 40], [-30, 45], [0, 50]], // one sub-line
          [[10, 51], [20, 52]], // second sub-line (antimeridian-style split)
        ],
      },
    },
    // malformed: not a MultiLineString -> skipped
    { type: 'Feature', properties: { name: 'bad' }, geometry: { type: 'Point', coordinates: [1, 2] } },
    // malformed: sub-line with < 2 valid points -> skipped, but sibling kept
    {
      type: 'Feature',
      properties: { name: 'Partial', color: 'not-a-color' },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [[5, 5]], // too short -> dropped
          [[6, 6], ['x', null], [7, 7]], // one bad coord filtered, still 2 valid -> kept
        ],
      },
    },
  ],
}

test('flattens each MultiLineString sub-line into its own segment', () => {
  const segs = cableSegments(sample)
  // atlantic: 2 sub-lines, partial: 1 kept sub-line, point feature skipped
  assert.equal(segs.length, 3)
  assert.deepEqual(segs[0], { id: 'atlantic-0-0', name: 'Atlantic-1', color: '#ff0000', path: [[-70, 40], [-30, 45], [0, 50]] })
  assert.equal(segs[1].id, 'atlantic-0-1')
})

test('drops sub-2-point sub-lines but keeps valid siblings, sanitizes bad color', () => {
  const segs = cableSegments(sample)
  const partial = segs.find((s) => s.name === 'Partial')
  assert.ok(partial, 'partial cable should survive')
  assert.deepEqual(partial.path, [[6, 6], [7, 7]]) // the ['x',null] coord filtered out
  assert.equal(partial.color, '#4fc3f7') // invalid color -> cyan fallback
})

test('returns [] for non-FeatureCollection / junk input', () => {
  assert.deepEqual(cableSegments(null), [])
  assert.deepEqual(cableSegments({ type: 'Feature' }), [])
  assert.deepEqual(cableSegments({ type: 'FeatureCollection', features: 'nope' }), [])
})
