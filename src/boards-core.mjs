// Saved boards (the collaboration unit): a board = {name, state} where state is a scene-state
// object (camera + layer toggles). Pure — no DOM, no cesium — so node --test drives it; the
// cesium/localStorage seam is boards.ts. Persistence format reuses the scene-state codec so a
// board round-trips through the exact same compact token a share-link carries.
// ponytail: dedup + persistence live here; boards.ts just wires DOM to these 4 functions.
import { decodeState, encodeState } from './scene-state-codec.mjs'

/**
 * @typedef {import('./scene-state-codec.mjs').SceneState} SceneState
 * @typedef {{name: string, state: SceneState}} Board
 */

/**
 * Append a board, replacing any existing one with the same (trimmed) name — re-saving a board
 * updates it in place rather than piling duplicates. Empty/blank names are rejected (returns the
 * array unchanged) so a mis-click can't create a nameless board.
 * @param {Board[]} boards
 * @param {string} name
 * @param {SceneState} state
 * @returns {Board[]} new array (input not mutated)
 */
export function addBoard(boards, name, state) {
  const n = String(name ?? '').trim()
  if (!n) return boards
  return [...boards.filter((b) => b.name !== n), { name: n, state }]
}

/**
 * Drop the board with this (trimmed) name.
 * @param {Board[]} boards
 * @param {string} name
 * @returns {Board[]} new array (input not mutated)
 */
export function removeBoard(boards, name) {
  const n = String(name ?? '').trim()
  return boards.filter((b) => b.name !== n)
}

/**
 * Serialize the whole board set to a JSON string for localStorage. Each state is encoded to the
 * same base64url token used for share-links, so the stored blob is compact and codec-versioned.
 * @param {Board[]} boards
 * @returns {string}
 */
export function serializeBoards(boards) {
  return JSON.stringify(boards.map((b) => ({ n: b.name, s: encodeState(b.state) })))
}

/**
 * Parse localStorage back to boards. Never throws: bad JSON -> []; any single board whose token
 * fails to decode (hand-edited / corrupt) is dropped rather than poisoning the whole set.
 * @param {string | null | undefined} str
 * @returns {Board[]}
 */
export function deserializeBoards(str) {
  let raw
  try {
    raw = JSON.parse(str ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  const out = []
  for (const o of raw) {
    const state = decodeState(String(o?.s ?? ''))
    const name = String(o?.n ?? '').trim()
    if (name && state) out.push({ name, state })
  }
  return out
}
