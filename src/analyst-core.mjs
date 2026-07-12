// AI-as-analyst core (pure logic, plain .mjs so `node --test` runs it directly). Two headless
// helpers behind the analyst panel: rankAttention orders live analytics candidates so the top-3
// "worth your attention" surface first (keyless — the scores are already on the candidates), and
// applyGeoFilter narrows a layer's items to an NL query's radius + value threshold. No DOM, no
// cesium, no LLM — analyst.ts wraps these with the rationale + NL-translation seams.
import { haversineKm } from './rules-eval.mjs'

/**
 * @typedef {{ kind:string, lat:number, lon:number, score:number, text:string }} Candidate
 * @typedef {{ center?:{lat:number,lon:number}, radiusKm?:number, minValue?:number, valueKey?:string }} GeoFilter
 */

/**
 * Order candidates by score descending, STABLE — ties keep input order. (V8 sort is stable, but
 * we tiebreak on the original index anyway so equal scores are order-preserving on any engine.)
 * @param {Candidate[]} candidates
 * @returns {Candidate[]}
 */
export function rankAttention(candidates) {
  return (candidates ?? [])
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (b.c.score ?? 0) - (a.c.score ?? 0) || a.i - b.i)
    .map((x) => x.c)
}

/**
 * Keep items inside center±radiusKm (when both given) AND >= minValue on valueKey (when both
 * given). A missing center OR radiusKm disables the geo filter; a missing valueKey OR minValue
 * disables the value filter — so an empty filter passes everything through. Items lacking finite
 * lat/lon are dropped only while a geo filter is active.
 * @param {Array<Record<string, any>>} items
 * @param {GeoFilter} [filter]
 * @returns {Array<Record<string, any>>}
 */
export function applyGeoFilter(items, filter) {
  const f = filter ?? {}
  const geo = !!f.center && Number.isFinite(f.radiusKm)
  const val = f.valueKey != null && Number.isFinite(f.minValue)
  return (items ?? []).filter((it) => {
    if (geo) {
      if (!Number.isFinite(it.lat) || !Number.isFinite(it.lon)) return false
      if (haversineKm(f.center.lat, f.center.lon, it.lat, it.lon) > f.radiusKm) return false
    }
    if (val && (it[f.valueKey] ?? -Infinity) < f.minValue) return false
    return true
  })
}
