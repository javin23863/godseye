// Scene-state codec (foundation for shareable deep-links + saved boards): serialize the
// exact view to a compact URL-safe token and back, losslessly. Pure — no DOM, no cesium —
// so both the browser wrapper (scene-state.ts) and node --test can drive it.
// ponytail: JSON -> UTF-8 -> base64url (no padding); v1 remains readable while v2 adds
// observation time and display metadata used by evidence capture.

/**
 * @typedef {{lat:number, lon:number, radiusKm:number, name?:string}} Aoi
 * @typedef {{
 *   v: 1,
 *   cam: {lon:number, lat:number, height:number, heading:number, pitch:number},
 *   t?: number,
 *   layers?: string[],
 *   aois?: Aoi[]
 * }} SceneStateV1
 * @typedef {{
 *   v: 2,
 *   cam: {lon:number, lat:number, height:number, heading:number, pitch:number},
 *   observedAt: string,
 *   t?: number,
 *   layers?: string[],
 *   aois?: Aoi[],
 *   style?: string,
 *   basemap?: string
 * }} SceneStateV2
 * @typedef {SceneStateV1 | SceneStateV2} SceneState
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
    // v1 was intentionally permissive; preserve old links. v2 is an integration boundary,
    // so reject malformed or unknown versions before they reach Cesium.
    if (typeof v !== 'object' || v === null) return null
    if (v.v === 1) return v
    if (!isSceneStateV2(v)) return null
    return v
  } catch {
    return null
  }
}

/** Strict v2 boundary shared by URL decoding, automation, and evidence packets. */
export function isSceneStateV2(v) {
  return v?.v === 2 && validCamera(v.cam) && validIso(v.observedAt) &&
    (v.t === undefined || Number.isFinite(v.t)) &&
    (v.layers === undefined || (Array.isArray(v.layers) && v.layers.every((x) => typeof x === 'string'))) &&
    (v.aois === undefined || (Array.isArray(v.aois) && v.aois.every(validAoi))) &&
    (v.style === undefined || typeof v.style === 'string') &&
    (v.basemap === undefined || typeof v.basemap === 'string')
}

function validCamera(cam) {
  return cam && ['lon', 'lat', 'height', 'heading', 'pitch'].every((k) => Number.isFinite(cam[k]))
}

function validAoi(aoi) {
  return aoi && Number.isFinite(aoi.lat) && Number.isFinite(aoi.lon) &&
    Number.isFinite(aoi.radiusKm) && (aoi.name === undefined || typeof aoi.name === 'string')
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}
