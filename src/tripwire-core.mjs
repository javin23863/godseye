// Tripwire/sentinel pure logic (builds on the CAP-22 rules engine) — plain .mjs so
// `node --test` runs it headless. Two jobs: (1) fold a per-layer snapshot map into the
// EvalContext the rules engine consumes, (2) turn a UI preset choice into a Condition +
// human name. All Cesium/DOM/IndexedDB lives in tripwires.ts; nothing here touches them.

/**
 * @typedef {{ items?: unknown[] }} SnapLike            a recorded snapshot (recorder.Snapshot)
 * @typedef {{ lat:number, lon:number, radiusKm:number }} Aoi
 * @typedef {import('./rules-eval.mjs').EvalContext} EvalContext
 * @typedef {import('./rules-eval.mjs').Condition} Condition
 */

/**
 * Fold the latest-per-layer snapshot map into an EvalContext: counts[layer] = item count,
 * items[layer] = the items. Accepts the Map returned by snapshotsAt() or a plain object
 * (tests). Missing/empty snapshots simply contribute nothing — a rule over an absent layer
 * is inert, never a crash.
 * @param {Map<string,SnapLike>|Record<string,SnapLike>} snaps
 * @returns {EvalContext}
 */
export function buildCtxFromSnapshots(snaps) {
  const counts = {}
  const items = {}
  const entries = snaps instanceof Map ? snaps.entries() : Object.entries(snaps ?? {})
  for (const [layer, snap] of entries) {
    const arr = Array.isArray(snap?.items) ? snap.items : []
    items[layer] = arr
    counts[layer] = arr.length
  }
  return { counts, items }
}

// Condition presets shown in the TRIPWIRES <select>. `param` (when set) is prompted for
// in the UI (N = flight threshold, x = quake magnitude); `def` is its default. `layer` is
// the EvalContext key the condition reads — 'dark' is the synthetic still-dark-vessel layer
// tripwires.ts injects from the dark-vessel analysis (not a recorded feed).
export const TRIPWIRE_PRESETS = [
  { id: 'mil', label: 'MILITARY IN AOI', layer: 'military' },
  { id: 'flights', label: 'FLIGHTS > N', layer: 'flights', param: 'N', def: 100 },
  { id: 'quake', label: 'QUAKE M>=x NEAR AOI', layer: 'earthquakes', param: 'x', def: 4 },
  { id: 'dark', label: 'VESSEL DARK IN AOI', layer: 'dark' },
  { id: 'jam', label: 'GPS-JAM IN AOI', layer: 'gpsjam' },
]

/** True if the preset needs the synthetic 'dark' pseudo-layer built before evaluation. */
export const DARK_LAYER = 'dark'

/**
 * Map a preset id + armed AOI (+ numeric param for threshold presets) to a rules Condition.
 * Unknown id -> null (the UI treats null as "nothing to arm").
 * @param {string} id
 * @param {Aoi} aoi
 * @param {number} [param]
 * @returns {Condition|null}
 */
export function presetCondition(id, aoi, param) {
  const { lat, lon, radiusKm } = aoi
  switch (id) {
    case 'mil':
      return { type: 'inAoi', layer: 'military', lat, lon, radiusKm }
    case 'jam':
      return { type: 'inAoi', layer: 'gpsjam', lat, lon, radiusKm }
    case 'dark':
      return { type: 'inAoi', layer: 'dark', lat, lon, radiusKm }
    case 'flights':
      return { type: 'count', layer: 'flights', op: '>', value: Number(param) }
    case 'quake':
      return { type: 'near', layer: 'earthquakes', lat, lon, radiusKm, valueKey: 'mag', minValue: Number(param) }
    default:
      return null
  }
}

/**
 * Human-readable rule name for the side-list + notification, with the param baked in.
 * @param {string} id
 * @param {number} [param]
 * @returns {string}
 */
export function tripwireName(id, param) {
  switch (id) {
    case 'flights':
      return `FLIGHTS > ${param}`
    case 'quake':
      return `QUAKE M>=${param} NEAR AOI`
    default:
      return TRIPWIRE_PRESETS.find((p) => p.id === id)?.label ?? id
  }
}
