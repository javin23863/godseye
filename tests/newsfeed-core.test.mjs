import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGdeltDoc, normalizeRss, classify, mergeAndCorroborate, ageLabel } from '../src/newsfeed-core.mjs'

test('normalizeGdeltDoc parses artlist articles, skips malformed, never throws', () => {
  assert.deepEqual(normalizeGdeltDoc(null), [])
  assert.deepEqual(normalizeGdeltDoc({}), [])
  const items = normalizeGdeltDoc({
    articles: [
      { title: 'Missile strike hits border town', url: 'https://www.reuters.com/a1', domain: 'reuters.com', language: 'English', seendate: '20260713T101500Z', sourcecountry: 'Ukraine' },
      { title: 'no url here' }, // dropped
      { url: 'https://x/no-title' }, // dropped
      { title: 'Bad date fallback', url: 'https://x.com/a2', seendate: 'garbage' },
    ],
  })
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], {
    id: 'https://www.reuters.com/a1',
    title: 'Missile strike hits border town',
    url: 'https://www.reuters.com/a1',
    domain: 'reuters.com',
    lang: 'English',
    ts: Date.parse('2026-07-13T10:15:00Z'),
    source: 'GDELT',
  })
  assert.equal(items[1].domain, 'x.com') // no domain field -> derived from url host
  assert.ok(Number.isFinite(items[1].ts)) // bad seendate -> falls back to Date.now(), not NaN/throw
})

test('normalizeRss parses Google-News-shaped RSS 2.0, handles CDATA + entities', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title><![CDATA[Troops mass at the front - Example News]]></title>
      <link>https://www.example.com/story-1</link>
      <pubDate>Mon, 13 Jul 2026 10:15:00 GMT</pubDate>
      <source url="https://example.com">Example News</source>
    </item>
    <item>
      <title>Markets rally &amp; oil dips</title>
      <link>https://another.co/story-2</link>
      <pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate>
    </item>
    <item>
      <title>missing link, dropped</title>
    </item>
  </channel></rss>`
  const items = normalizeRss(xml, 'RSS')
  assert.equal(items.length, 2)
  assert.deepEqual(items[0], {
    id: 'https://www.example.com/story-1',
    title: 'Troops mass at the front - Example News',
    url: 'https://www.example.com/story-1',
    domain: 'example.com',
    lang: '',
    ts: Date.parse('Mon, 13 Jul 2026 10:15:00 GMT'),
    source: 'RSS',
  })
  assert.equal(items[1].title, 'Markets rally & oil dips') // &amp; decoded
  assert.equal(items[1].domain, 'another.co')
})

test('normalizeRss falls back to sourceLabel when the link host cannot be parsed', () => {
  const xml = `<item><title>Odd link</title><link>not-a-url</link><pubDate>Mon, 13 Jul 2026 09:00:00 GMT</pubDate></item>`
  const items = normalizeRss(xml, 'GOOGLE-NEWS')
  assert.equal(items[0].domain, 'GOOGLE-NEWS')
})

test('classify: category priority + secondary tags', () => {
  assert.equal(classify({ title: 'Missile strike kills troops near border' }).category, 'CONFLICT')
  assert.equal(classify({ title: '7.2 magnitude earthquake triggers tsunami warning' }).category, 'DISASTER')
  assert.equal(classify({ title: 'Record heatwave linked to climate emissions' }).category, 'CLIMATE')
  assert.equal(classify({ title: 'Local bakery wins award' }).category, 'NEWS')
  // CONFLICT keyword wins over DISASTER when both present
  assert.equal(classify({ title: 'Military strike follows earthquake relief effort' }).category, 'CONFLICT')

  const tags = classify({ title: 'President sanctions military over stock market crash' }).tags
  assert.deepEqual(tags.sort(), ['ECON', 'MILITARY', 'POLITICAL'])
  assert.deepEqual(classify({ title: 'Quiet day, nothing to report' }).tags, [])
  assert.deepEqual(classify({}).tags, []) // no title, never throws
})

test('mergeAndCorroborate dedupes by normalized title and escalates the chip by distinct domains', () => {
  const now = Date.parse('2026-07-13T12:00:00Z')
  const a = { id: '1', title: 'Missile strike hits capital city overnight killing dozens', url: 'u1', domain: 'reuters.com', ts: now - 1000, source: 'GDELT' }
  const b = { id: '2', title: 'Missile strike hits capital city overnight, killing dozens!', url: 'u2', domain: 'apnews.com', ts: now, source: 'RSS' }
  const c = { id: '3', title: 'Completely unrelated story about a bakery opening', url: 'u3', domain: 'reuters.com', ts: now - 500, source: 'GDELT' }

  const first = mergeAndCorroborate([], [a, c])
  assert.equal(first.length, 2)
  const strike1 = first.find((x) => x.url === 'u1')
  assert.equal(strike1.chip, 'PLAUSIBLE') // 1 distinct domain so far
  assert.equal(strike1.category, 'CONFLICT')

  const second = mergeAndCorroborate(first, [b])
  assert.equal(second.length, 2) // b merged into the same story as a, not a 3rd row
  const strike2 = second.find((x) => x.title.includes('killing dozens'))
  assert.equal(strike2.chip, 'LIKELY') // now 2 distinct domains (reuters.com + apnews.com)
  assert.equal(strike2.id, '2') // newest item (b) carries the story forward
  assert.equal(strike2.ts, now)

  const d = { id: '4', title: 'MISSILE STRIKE HITS CAPITAL CITY OVERNIGHT KILLING DOZENS', url: 'u4', domain: 'bbc.com', ts: now + 1000, source: 'RSS' }
  const third = mergeAndCorroborate(second, [d])
  const strike3 = third.find((x) => x.id === '4')
  assert.equal(strike3.chip, 'CONFIRMED') // 3 distinct domains
})

test('mergeAndCorroborate sorts newest-first and caps at 200', () => {
  const items = Array.from({ length: 250 }, (_, i) => ({
    id: String(i), title: `Story number ${i} about something happening`, url: `u${i}`, domain: `d${i}.com`, ts: i, source: 'GDELT',
  }))
  const merged = mergeAndCorroborate([], items)
  assert.equal(merged.length, 200)
  assert.equal(merged[0].id, '249') // newest first
  assert.ok(merged[0].ts >= merged[1].ts)
})

test('ageLabel formats minutes/hours/days', () => {
  const now = Date.parse('2026-07-13T12:00:00Z')
  assert.equal(ageLabel(now - 30_000, now), 'NOW')
  assert.equal(ageLabel(now - 3 * 60_000, now), '3M AGO')
  assert.equal(ageLabel(now - 2 * 3_600_000, now), '2H AGO')
  assert.equal(ageLabel(now - 25 * 3_600_000, now), '1D AGO')
})
