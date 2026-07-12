// Scene-state codec (foundation for shareable deep-links + saved boards): serialize the
// exact view to a compact URL-safe token and back, losslessly. Pure — no DOM, no cesium —
// so both the browser wrapper (scene-state.ts) and node --test can drive it.
// ponytail: JSON -> UTF-8 -> base64url (no padding); a versioned {v:1} envelope is the only
// migration hook — bump v and branch in decodeState if the shape ever changes.

/**
 * @typedef {{lat:number, lon:number, radiusKm:number, name?:string}} Aoi
 * @typedef {{
 *   v: 1,
 *   cam: {lon:number, lat:number, height:number, heading:number, pitch:number},
 *   t?: number,
 *   layers?: string[],
 *   aois?: Aoi[]
 * }} SceneState
 */

/**
 * Encode a scene state to a compact, URL-safe string.
 * @param {SceneState} state
 * @returns {string} base64url (JSON), no `=` padding
 */
export function encodeState(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decode a token back to a scene state. Returns null on ANY malformed input — never throws,
 * so callers can hand it a raw hash fragment without guarding.
 * @param {string} str
 * @returns {SceneState | null}
 */
export function decodeState(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const v = JSON.parse(new TextDecoder().decode(bytes))
    // state is always an object; a bare number/string/null that happened to parse is not one
    if (typeof v !== 'object' || v === null) return null
    return v
  } catch {
    return null
  }
}
