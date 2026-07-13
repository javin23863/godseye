import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gatherEvidence, buildPrompt, fallbackReport } from '../src/regionintel-core.mjs'

const target = { lat: 26.5, lon: 56.3 } // Strait of Hormuz-ish

const providers = {
  newsItems: [
    { lat: 26.5, lon: 56.3, name: 'Bandar Abbas port incident', count: 12 }, // ~0km
    { lat: 27.5, lon: 56.3, name: 'far headline', count: 3 }, // ~111km
    { lat: 40, lon: 40, name: 'way too far', count: 99 }, // >800km, dropped
  ],
  quakes: [{ lat: 26.6, lon: 56.3, mag: 4.8, place: 'Persian Gulf' }],
  flightsCount: 37,
}

test('gatherEvidence radius-filters each bucket', () => {
  const ev = gatherEvidence(target, providers, 800)
  assert.equal(ev.buckets.news.length, 2, 'far-away item dropped')
  assert.equal(ev.counts.news, 2)
  assert.equal(ev.buckets.quakes.length, 1)
})

test('gatherEvidence caps each bucket at 12 nearest, sorted', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ lat: 26.5 + i * 0.05, lon: 56.3, name: `n${i}` }))
  const ev = gatherEvidence(target, { newsItems: many }, 800)
  assert.equal(ev.buckets.news.length, 12)
  assert.equal(ev.counts.news, 20, 'count reflects all in-radius, not just the capped slice')
  const dists = ev.buckets.news.map((it) => it.distanceKm)
  assert.deepEqual([...dists].sort((a, b) => a - b), dists, 'nearest-first order')
})

test('gatherEvidence drops items with non-finite lat/lon and passes scalar *Count through', () => {
  const ev = gatherEvidence(target, { newsItems: [{ name: 'no coords' }], flightsCount: 37 }, 800)
  assert.equal(ev.buckets.news.length, 0)
  assert.equal(ev.counts.flights, 37)
})

test('buildPrompt is deterministic: same evidence -> same string', () => {
  const ev = gatherEvidence(target, providers, 800)
  assert.equal(buildPrompt(ev), buildPrompt(gatherEvidence(target, providers, 800)))
})

test('buildPrompt embeds target coords, radius, and each evidence line', () => {
  const ev = gatherEvidence(target, providers, 800)
  const p = buildPrompt(ev)
  assert.ok(p.includes('TARGET: 26.5N, 56.3E'))
  assert.ok(p.includes('radius 800km'))
  assert.ok(p.includes('Bandar Abbas port incident'))
  assert.ok(p.includes('Persian Gulf'))
  assert.ok(p.includes('120-180 word'))
})

test('buildPrompt says evidence is none when thin', () => {
  const ev = gatherEvidence(target, {}, 800)
  assert.ok(buildPrompt(ev).includes('(none within radius)'))
})

test('fallbackReport summarizes counts + nearest named item per bucket', () => {
  const ev = gatherEvidence(target, providers, 800)
  const r = fallbackReport(ev)
  assert.ok(r.includes('2 news'))
  assert.ok(r.includes('Bandar Abbas port incident'))
  assert.ok(r.includes('1 quakes'))
  assert.ok(r.includes('37 flights'))
})

test('fallbackReport thin-evidence path reports no evidence', () => {
  const ev = gatherEvidence(target, {}, 800)
  assert.equal(fallbackReport(ev), 'NO EVIDENCE WITHIN 800KM OF TARGET 26.5N, 56.3E.')
})
