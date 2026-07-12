// Rules/conditions engine (CAP-22, foundation for tripwires + cross-layer fusion) — pure
// logic, plain .mjs so `node --test` runs it directly. Evaluates one geofenced or threshold
// condition against a picture built from the live layers (or a recorded frame): a snapshot
// of per-layer counts and per-layer item arrays. No DOM, no cesium — the .ts RuleEngine
// wrapper handles debounce + firing.

/**
 * @typedef {{ counts:Record<string,number>, items:Record<string,object[]> }} EvalContext
 *   counts[layer] = how many items that layer holds; items[layer] = the items themselves.
 * @typedef {{ type:'count', layer:string, op:'>'|'<'|'>='|'<=', value:number }} CountCond
 * @typedef {{ type:'inAoi', layer:string, lat:number, lon:number, radiusKm:number }} InAoiCond
 * @typedef {{ type:'near', lat:number, lon:number, radiusKm:number, layer:string, minValue?:number, valueKey?:string }} NearCond
 * @typedef {CountCond|InAoiCond|NearCond} Condition
 * @typedef {{ matched:boolean, hits:object[] }} EvalResult
 * @typedef {{ id:string, condition:Condition }} RuleLike  a rule seen by the pure firing step
 * @typedef {{ rule:object, hits:object[] }} FiredLike     a rising-edge fire (no timestamp yet)
 */

const R_EARTH_KM = 6371

/**
 * Great-circle distance between two lat/lon points, in kilometres.
 * @param {number} aLat
 * @param {number} aLon
 * @param {number} bLat
 * @param {number} bLon
 * @returns {number}
 */
export function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad
  const dLon = (bLon - aLon) * toRad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** @param {number} a @param {'>'|'<'|'>='|'<='} op @param {number} b */
function compare(a, op, b) {
  switch (op) {
    case '>':
      return a > b
    case '<':
      return a < b
    case '>=':
      return a >= b
    case '<=':
      return a <= b
    default:
      return false
  }
}

/**
 * Evaluate a single condition against the current picture.
 * Unknown / malformed condition types are inert: { matched:false, hits:[] }.
 * @param {Condition} cond
 * @param {EvalContext} ctx
 * @returns {EvalResult}
 */
export function evaluateCondition(cond, ctx) {
  const items = ctx?.items ?? {}
  const counts = ctx?.counts ?? {}

  switch (cond?.type) {
    case 'count': {
      const n = counts[cond.layer] ?? 0
      return { matched: compare(n, cond.op, cond.value), hits: [] }
    }
    case 'inAoi': {
      const hits = (items[cond.layer] ?? []).filter(
        (it) =>
          Number.isFinite(it.lat) &&
          Number.isFinite(it.lon) &&
          haversineKm(cond.lat, cond.lon, it.lat, it.lon) <= cond.radiusKm,
      )
      return { matched: hits.length > 0, hits }
    }
    case 'near': {
      const key = cond.valueKey
      const min = cond.minValue
      const hits = (items[cond.layer] ?? []).filter((it) => {
        if (!Number.isFinite(it.lat) || !Number.isFinite(it.lon)) return false
        if (haversineKm(cond.lat, cond.lon, it.lat, it.lon) > cond.radiusKm) return false
        // optional threshold filter, e.g. quake magnitude: item[valueKey] >= minValue
        if (min !== undefined && key !== undefined) return (it[key] ?? -Infinity) >= min
        return true
      })
      return { matched: hits.length > 0, hits }
    }
    default:
      return { matched: false, hits: [] }
  }
}

/**
 * Edge-triggered firing step (the debounce): evaluate each rule against ctx and return only
 * the rules that just became matched — matched now AND not matched on the previous pass. A rule
 * that STAYS matched does not re-fire until it goes false then true again. `state` is the per-id
 * lastMatched memory and is mutated in place, so the caller keeps it across passes.
 * @param {Iterable<RuleLike>} rules
 * @param {EvalContext} ctx
 * @param {Map<string,boolean>} state  per-rule-id lastMatched; mutated in place
 * @returns {FiredLike[]}
 */
export function fireEdges(rules, ctx, state) {
  const fired = []
  for (const rule of rules) {
    const res = evaluateCondition(rule.condition, ctx)
    const was = state.get(rule.id) ?? false
    state.set(rule.id, res.matched)
    if (res.matched && !was) fired.push({ rule, hits: res.hits })
  }
  return fired
}
