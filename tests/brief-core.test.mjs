import assert from 'assert'
import test from 'node:test'
import { buildBriefPrompt, briefBadges } from '../src/brief-core.mjs'

const picture = {
  windowLabel: 'LAST 6H',
  activeLayers: [
    { key: 'flights', label: 'FLIGHTS', count: 42 },
    { key: 'darkvessel', label: 'DARK VESSELS', count: 2 },
  ],
  events: [
    { kind: 'dark-vessel', text: '2 vessels dark near Hormuz' },
    { kind: 'quake', text: 'M5.1 offshore Iran' },
  ],
}

test('buildBriefPrompt embeds every layer count', () => {
  const p = buildBriefPrompt(picture)
  assert.ok(p.includes('FLIGHTS 42'), 'flight count')
  assert.ok(p.includes('DARK VESSELS 2'), 'dark count')
  assert.ok(p.includes('LAST 6H'), 'window label')
})

test('buildBriefPrompt embeds every event text', () => {
  const p = buildBriefPrompt(picture)
  assert.ok(p.includes('2 vessels dark near Hormuz'))
  assert.ok(p.includes('M5.1 offshore Iran'))
})

test('buildBriefPrompt degrades with an empty picture', () => {
  const p = buildBriefPrompt({ windowLabel: 'NOW', activeLayers: [], events: [] })
  assert.ok(p.includes('none active'))
  assert.ok(p.includes('none flagged'))
})

test('briefBadges filters to known keys and drops url', () => {
  const badges = briefBadges(['flights', 'not-a-layer', 'darkvessel'])
  assert.strictEqual(badges.length, 2, 'unknown key dropped')
  assert.strictEqual(badges[0].label, 'FLIGHTS')
  assert.ok(badges[0].provider && badges[0].freshness && badges[0].limits)
  assert.ok(!('url' in badges[0]), 'url dropped')
})
