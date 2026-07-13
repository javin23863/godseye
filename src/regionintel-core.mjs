// REGION INTEL core (pure, no DOM/cesium/LLM — plain .mjs so `node --test` runs it directly).
// Click-a-point OSINT read: gatherEvidence pulls whatever's near the target out of the app's
// own live layers (radius-filtered, capped, distance-sorted), buildPrompt turns that into a
// grounded LLM ask, fallbackReport gives the same shape keyless. Distance math reuses the
// haversine already in rules-eval.mjs (analyst-core.mjs/fusion-core.mjs/pol.ts all do the same)
// — no second implementation.
import { haversineKm } from './rules-eval.mjs'

/**
 * @typedef {{ lat: number, lon: number, [k: string]: any }} EvidenceItem
 * @typedef {{ lat: number, lon: number }} Target
 * @typedef {Record<string, EvidenceItem[] | number | undefined>} Providers
 *   Array-valued keys are geo-filtered into a bucket (newsItems -> buckets.news, quakes ->
 *   buckets.quakes, ...; a trailing "Items" is stripped from the bucket name, everything else
 *   passes through as-is). Keys ending "Count" are scalars folded straight into counts (no
 *   bucket, no distance filter) — e.g. flightsCount -> counts.flights.
 * @typedef {{ target: Target, radiusKm: number, buckets: Record<string, (EvidenceItem & {distanceKm: number})[]>, counts: Record<string, number> }} Evidence
 */

const DEFAULT_RADIUS_KM = 800
const MAX_PER_BUCKET = 12

function round1(n) {
  return Math.round(n * 10) / 10
}

/**
 * Radius-filter + cap-12-nearest every array field on `providers`, scalar "*Count" fields pass
 * straight through. Items missing finite lat/lon are dropped (can't be placed relative to the
 * target).
 * @param {Target} target
 * @param {Providers} [providers]
 * @param {number} [radiusKm]
 * @returns {Evidence}
 */
export function gatherEvidence(target, providers = {}, radiusKm = DEFAULT_RADIUS_KM) {
  /** @type {Evidence['buckets']} */
  const buckets = {}
  /** @type {Record<string, number>} */
  const counts = {}

  for (const [key, value] of Object.entries(providers)) {
    if (key.endsWith('Count')) {
      counts[key.slice(0, -'Count'.length)] = Number(value) || 0
      continue
    }
    if (!Array.isArray(value)) continue
    const name = key.endsWith('Items') ? key.slice(0, -'Items'.length) : key
    const withDist = value
      .filter((it) => it && Number.isFinite(it.lat) && Number.isFinite(it.lon))
      .map((it) => ({ ...it, distanceKm: round1(haversineKm(target.lat, target.lon, it.lat, it.lon)) }))
      .filter((it) => it.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
    counts[name] = withDist.length
    buckets[name] = withDist.slice(0, MAX_PER_BUCKET)
  }

  return { target, radiusKm, buckets, counts }
}

/** Best label for an evidence item: whatever name-ish field it happens to carry. */
function labelOf(kind, it) {
  return it.title ?? it.name ?? it.place ?? it.callsign ?? it.id ?? kind
}

/** Best "key value" for an evidence item: whatever measure-ish field it happens to carry. */
function valueOf(it) {
  const v = it.mag ?? it.magnitude ?? it.frp ?? it.score ?? it.count ?? it.value ?? it.severity
  return v === undefined || v === null ? undefined : v
}

/**
 * Terse OSINT-analyst prompt grounded ONLY in the evidence lines — deterministic ordering
 * (bucket names sorted, items already distance-sorted by gatherEvidence) so the same evidence
 * always yields the same string.
 * @param {Evidence} evidence
 * @returns {string}
 */
export function buildPrompt(evidence) {
  const lines = []
  let n = 1
  for (const name of Object.keys(evidence.buckets).sort()) {
    for (const it of evidence.buckets[name]) {
      const val = valueOf(it)
      lines.push(
        `${n++}. ${name} · ${labelOf(name, it)} · ${it.distanceKm}km${val !== undefined ? ` · ${val}` : ''}`,
      )
    }
  }
  return [
    'You are an OSINT analyst. Write a terse 120-180 word regional assessment using ONLY the ' +
      'evidence lines below. No invented facts. If evidence is thin, say so.',
    `TARGET: ${evidence.target.lat}N, ${evidence.target.lon}E (radius ${evidence.radiusKm}km)`,
    'EVIDENCE:',
    lines.length ? lines.join('\n') : '(none within radius)',
  ].join('\n')
}

/** Keyless template report — same shape as every other module's LLM-unavailable fallback
 *  (see brief-core.mjs templateBrief): counts per bucket + nearest named item, no prose model. */
export function fallbackReport(evidence) {
  const parts = []
  const bucketNames = Object.keys(evidence.buckets).sort()
  for (const name of bucketNames) {
    const count = evidence.counts[name] ?? 0
    if (!count) continue
    const nearest = evidence.buckets[name][0]
    parts.push(nearest ? `${count} ${name} (nearest: ${labelOf(name, nearest)}, ${nearest.distanceKm}km)` : `${count} ${name}`)
  }
  for (const [name, count] of Object.entries(evidence.counts)) {
    if (bucketNames.includes(name) || !count) continue
    parts.push(`${count} ${name}`)
  }
  if (!parts.length) {
    return `NO EVIDENCE WITHIN ${evidence.radiusKm}KM OF TARGET ${evidence.target.lat}N, ${evidence.target.lon}E.`
  }
  return `REGION SNAPSHOT (${evidence.radiusKm}km radius): ${parts.join('; ')}.`
}
