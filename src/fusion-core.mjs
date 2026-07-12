// Cross-layer fusion core (CAP-22 payoff) — the OSINT differentiator. Takes normalized
// events from every layer and auto-flags CLUSTERS that are co-located in space AND time
// AND span >=2 DISTINCT intelligence layers: a jam cell + a dark vessel + a military jet
// over the same patch of sea in the same window is worth more than any single signal.
// Pure + deterministic (no DOM, no cesium, no globals) so `node --test` runs it directly.
// ponytail: O(n²) greedy seed-and-absorb — fine for the low-hundreds of events one scan
// yields; swap to a spatial grid index if event counts ever reach thousands.
import { haversineKm } from './rules-eval.mjs'

/**
 * @typedef {{ layer:string, lat:number, lon:number, at:number, weight?:number, label?:string }} FusionEvent
 * @typedef {{ lat:number, lon:number, at:number, layers:string[], members:FusionEvent[], score:number }} Composite
 */

/**
 * Cluster events sitting within radiusKm AND windowMin of a seed that together span >=2
 * distinct layers. Greedy: events are walked in a stable order, each still-unclaimed event
 * seeds a cluster that absorbs every other unclaimed event inside its space-time ball;
 * clusters that stay single-layer are dropped (co-location of one INT is not fusion).
 * @param {FusionEvent[]} events
 * @param {{radiusKm?:number, windowMin?:number}} [opts]
 * @returns {Composite[]} highest score first
 */
export function findComposites(events, { radiusKm = 50, windowMin = 90 } = {}) {
  const windowMs = windowMin * 60_000
  // stable, deterministic processing order — output must never depend on input array order
  const pool = events
    .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon) && Number.isFinite(e.at))
    .slice()
    .sort((a, b) => a.at - b.at || a.lat - b.lat || a.lon - b.lon || a.layer.localeCompare(b.layer))

  const claimed = new Set()
  const composites = []

  for (const seed of pool) {
    if (claimed.has(seed)) continue
    const members = [seed]
    claimed.add(seed)
    for (const other of pool) {
      if (claimed.has(other)) continue
      if (Math.abs(other.at - seed.at) > windowMs) continue
      if (haversineKm(seed.lat, seed.lon, other.lat, other.lon) > radiusKm) continue
      members.push(other)
      claimed.add(other)
    }
    const layers = [...new Set(members.map((m) => m.layer))].sort()
    if (layers.length < 2) continue // single-INT cluster is not a composite
    const n = members.length
    const lat = members.reduce((s, m) => s + m.lat, 0) / n
    const lon = members.reduce((s, m) => s + m.lon, 0) / n
    const at = Math.round(members.reduce((s, m) => s + m.at, 0) / n)
    const weightSum = members.reduce((s, m) => s + (m.weight ?? 1), 0)
    // distinct-layer count dominates (that IS fusion); member weights only break ties, so
    // score is strictly increasing in layer count for any fixed member set.
    const score = Math.round((layers.length * 100 + weightSum) * 100) / 100
    composites.push({ lat, lon, at, layers, members, score })
  }

  return composites.sort((a, b) => b.score - a.score)
}
