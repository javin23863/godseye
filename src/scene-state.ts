// Scene-state capture/apply (deep-links + saved boards): read the live cesium camera pose,
// merge in the non-camera view bits (playhead time, layer toggles, AOIs) the caller supplies,
// and fly the camera back on restore. Codec is in scene-state-codec.mjs (headless, node --test'able);
// this file is only the cesium/DOM seam.
import { Cartesian3, Math as CMath, Viewer } from 'cesium'
import { decodeState, encodeState } from './scene-state-codec.mjs'

export interface Aoi {
  lat: number
  lon: number
  radiusKm: number
  name?: string
}
export interface SceneStateV1 {
  v: 1
  cam: { lon: number; lat: number; height: number; heading: number; pitch: number }
  t?: number
  layers?: string[]
  aois?: Aoi[]
}
export interface SceneStateV2 {
  v: 2
  cam: { lon: number; lat: number; height: number; heading: number; pitch: number }
  /** ISO-8601 instant when the scene was captured, distinct from an optional playback cursor. */
  observedAt: string
  t?: number
  layers?: string[]
  aois?: Aoi[]
  style?: string
  basemap?: string
}
export type SceneState = SceneStateV1 | SceneStateV2
/** Non-camera view bits the caller owns — merged into the state, re-applied by hand on restore. */
export interface SceneExtras {
  observedAt?: string
  t?: number
  layers?: string[]
  aois?: Aoi[]
  style?: string
  basemap?: string
}

/** Snapshot the current camera pose + caller-supplied extras into a serializable state. */
export function captureState(viewer: Viewer, extras: SceneExtras = {}): SceneStateV2 {
  const c = viewer.camera
  const carto = c.positionCartographic
  const state: SceneStateV2 = {
    v: 2,
    observedAt: extras.observedAt ?? new Date().toISOString(),
    cam: {
      lon: CMath.toDegrees(carto.longitude),
      lat: CMath.toDegrees(carto.latitude),
      height: carto.height,
      heading: c.heading, // radians, applied straight back via flyTo
      pitch: c.pitch,
    },
  }
  if (extras.t !== undefined) state.t = extras.t
  if (extras.layers) state.layers = extras.layers
  if (extras.aois) state.aois = extras.aois
  if (extras.style) state.style = extras.style
  if (extras.basemap) state.basemap = extras.basemap
  return state
}

/** Fly the camera to the saved pose; return the non-camera parts for the caller to re-apply
 *  (layer toggles / AOIs / playhead time aren't the camera's job). */
export function applyState(viewer: Viewer, state: SceneState): SceneExtras {
  // deep-links are untrusted (hand-edited / stale-schema URLs): decodeState does no shape
  // validation, so a token like {v:1} with no cam reaches here — restore extras, skip the fly.
  if (!state?.cam) return { t: state?.t, layers: state?.layers, aois: state?.aois }
  const { lon, lat, height, heading, pitch } = state.cam
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: { heading, pitch, roll: 0 },
    duration: 1.5,
  })
  return state.v === 2
    ? { observedAt: state.observedAt, t: state.t, layers: state.layers, aois: state.aois, style: state.style, basemap: state.basemap }
    : { t: state.t, layers: state.layers, aois: state.aois }
}

/** '#s='-prefixed hash fragment for a shareable deep-link. */
export function stateToHash(state: SceneState): string {
  return '#s=' + encodeState(state)
}

/** Parse the current location.hash back to a state, or null if absent/malformed. */
export function readHashState(): SceneState | null {
  const m = /(?:^#|&)s=([^&]+)/.exec(location.hash)
  return m ? (decodeState(m[1]) as SceneState | null) : null
}
