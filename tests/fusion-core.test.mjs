import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findComposites } from '../src/fusion-core.mjs'

const AT = 1_700_000_000_000

test('two co-located events of different layers -> one composite', () => {
  const out = findComposites([
    { layer: 'gpsjam', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'military', lat: 26.51, lon: 56.31, at: AT + 60_000 },
  ])
  assert.equal(out.length, 1)
  assert.deepEqual(out[0].layers, ['gpsjam', 'military'])
  assert.equal(out[0].members.length, 2)
})

test('same-layer only -> no composite', () => {
  const out = findComposites([
    { layer: 'military', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'military', lat: 26.51, lon: 56.31, at: AT },
  ])
  assert.equal(out.length, 0)
})

test('far apart -> no composite', () => {
  const out = findComposites([
    { layer: 'gpsjam', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'military', lat: -40, lon: 170, at: AT },
  ])
  assert.equal(out.length, 0)
})

test('outside the time window -> no composite', () => {
  const out = findComposites(
    [
      { layer: 'gpsjam', lat: 26.5, lon: 56.3, at: AT },
      { layer: 'military', lat: 26.5, lon: 56.3, at: AT + 3 * 3_600_000 },
    ],
    { windowMin: 90 },
  )
  assert.equal(out.length, 0)
})

test('score is monotonic in distinct-layer count', () => {
  const two = findComposites([
    { layer: 'gpsjam', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'military', lat: 26.5, lon: 56.3, at: AT },
  ])[0]
  const three = findComposites([
    { layer: 'gpsjam', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'military', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'dark', lat: 26.5, lon: 56.3, at: AT },
  ])[0]
  assert.ok(three.score > two.score, 'three distinct layers must outscore two')
})

test('deterministic regardless of input order', () => {
  const events = [
    { layer: 'gpsjam', lat: 26.5, lon: 56.3, at: AT },
    { layer: 'military', lat: 26.51, lon: 56.31, at: AT + 30_000 },
    { layer: 'quake', lat: 26.49, lon: 56.29, at: AT - 30_000 },
  ]
  assert.deepEqual(findComposites(events), findComposites([...events].reverse()))
})
