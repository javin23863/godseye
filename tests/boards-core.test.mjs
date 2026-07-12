import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addBoard, removeBoard, serializeBoards, deserializeBoards } from '../src/boards-core.mjs'

/** @type {import('../src/scene-state-codec.mjs').SceneState} */
const stA = { v: 1, cam: { lon: 55.5, lat: 26.1, height: 1e6, heading: 0.3, pitch: -1.2 }, layers: ['flights'] }
const stB = { v: 1, cam: { lon: -74, lat: 40.7, height: 2e6, heading: 0, pitch: -1.5 }, layers: ['ships', 'infra'] }

test('addBoard appends and does not mutate input', () => {
  const a = []
  const b = addBoard(a, 'Hormuz', stA)
  assert.equal(a.length, 0)
  assert.deepEqual(b, [{ name: 'Hormuz', state: stA }])
})

test('addBoard trims and replaces a same-name board in place', () => {
  let boards = addBoard([], '  NYC  ', stA)
  boards = addBoard(boards, 'NYC', stB) // re-save same name
  assert.equal(boards.length, 1)
  assert.equal(boards[0].name, 'NYC')
  assert.deepEqual(boards[0].state, stB)
})

test('addBoard rejects blank names', () => {
  assert.deepEqual(addBoard([], '   ', stA), [])
  assert.deepEqual(addBoard([], '', stA), [])
})

test('removeBoard drops by trimmed name, keeps rest', () => {
  const boards = addBoard(addBoard([], 'Hormuz', stA), 'NYC', stB)
  assert.deepEqual(removeBoard(boards, ' Hormuz '), [{ name: 'NYC', state: stB }])
})

test('serialize -> deserialize round-trips through the codec', () => {
  const boards = addBoard(addBoard([], 'Hormuz', stA), 'NYC', stB)
  const back = deserializeBoards(serializeBoards(boards))
  assert.deepEqual(back, boards)
})

test('deserialize tolerates garbage and drops undecodable boards', () => {
  assert.deepEqual(deserializeBoards('not json'), [])
  assert.deepEqual(deserializeBoards(null), [])
  assert.deepEqual(deserializeBoards('{"not":"array"}'), [])
  // one good, one with an un-decodable token -> only the good one survives
  const mixed = JSON.stringify([{ n: 'ok', s: serializeToken(stA) }, { n: 'bad', s: '@@@not-base64@@@' }])
  const back = deserializeBoards(mixed)
  assert.equal(back.length, 1)
  assert.equal(back[0].name, 'ok')
})

// helper mirrors what serializeBoards stores per board (encodeState token)
function serializeToken(state) {
  return JSON.parse(serializeBoards([{ name: 'x', state }]))[0].s
}
