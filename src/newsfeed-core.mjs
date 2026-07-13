// PURE core for the live SIGINT news ticker (newsfeed.ts): two independent upstream shapes
// (GDELT DOC 2.0 artlist JSON, Google News RSS 2.0 XML) normalized to one item shape, then
// merged/deduped/corroborated into a single feed. No DOM/cesium here — runs under node --test.

/**
 * @typedef {Object} NewsItem
 * @property {string} id       // stable key (article url)
 * @property {string} title
 * @property {string} url
 * @property {string} domain   // publisher hostname, no 'www.'
 * @property {string} lang
 * @property {number} ts       // epoch ms
 * @property {'GDELT'|'RSS'} source
 */

function hostnameOf(url) {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// "20260713T101500Z" (GDELT seendate) -> epoch ms
function parseGdeltDate(s) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(s || ''))
  if (!m) return NaN
  const [, y, mo, d, h, mi, se] = m
  return Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${se}Z`)
}

/**
 * GDELT DOC 2.0 artlist JSON (`{articles:[{title,url,domain,language,seendate,sourcecountry}]}`)
 * -> NewsItem[]. Malformed/partial records are skipped, never thrown.
 * @param {{articles?: Array<Record<string, unknown>>}} json
 * @returns {NewsItem[]}
 */
export function normalizeGdeltDoc(json) {
  const arts = json && Array.isArray(json.articles) ? json.articles : []
  const items = []
  for (const a of arts) {
    if (!a || !a.url || !a.title) continue
    const ts = parseGdeltDate(a.seendate)
    items.push({
      id: String(a.url),
      title: String(a.title),
      url: String(a.url),
      domain: (a.domain && String(a.domain)) || hostnameOf(a.url),
      lang: (a.language && String(a.language)) || '',
      ts: Number.isFinite(ts) ? ts : Date.now(),
      source: 'GDELT',
    })
  }
  return items
}

function pickTag(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
  return m ? m[1].trim() : ''
}

function decodeXml(s) {
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(s.trim())
  const raw = cdata ? cdata[1] : s
  return raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

/**
 * RSS 2.0 (Google News shape: <item><title><link><pubDate><source>) -> NewsItem[].
 * String/regex parsed — no DOM parser, runs under node --test.
 * @param {string} xmlText
 * @param {string} [sourceLabel] fallback domain when the link's host can't be parsed
 * @returns {NewsItem[]}
 */
export function normalizeRss(xmlText, sourceLabel = 'RSS') {
  const items = []
  const blocks = String(xmlText || '').match(/<item[\s\S]*?<\/item>/gi) || []
  for (const block of blocks) {
    const title = decodeXml(pickTag(block, 'title'))
    const link = decodeXml(pickTag(block, 'link'))
    if (!title || !link) continue
    const ts = Date.parse(pickTag(block, 'pubDate'))
    items.push({
      id: link,
      title,
      url: link,
      domain: hostnameOf(link) || sourceLabel,
      lang: '',
      ts: Number.isFinite(ts) ? ts : Date.now(),
      source: 'RSS',
    })
  }
  return items
}

// word-boundary matchers — plain .includes() false-positives on substrings ("war" inside
// "warning", "front" inside "frontier"), so each keyword list compiles to one \b-anchored regex.
const matcher = (words) => new RegExp(`\\b(?:${words.join('|')})\\b`, 'i')

const CONFLICT_RE = matcher(['war', 'strike', 'missile', 'attack', 'troops', 'killed', 'military', 'drone', 'front', 'invasion', 'offensive', 'airstrike', 'shelling', 'combat', 'ceasefire'])
const DISASTER_RE = matcher(['earthquake', 'flood', 'wildfire', 'hurricane', 'eruption', 'magnitude', 'tsunami', 'landslide', 'tornado', 'cyclone'])
const CLIMATE_RE = matcher(['climate', 'heatwave', 'drought', 'emissions', 'carbon', 'warming'])
const MILITARY_RE = matcher(['military', 'troops', 'army', 'navy', 'soldier', 'warship', 'missile', 'drone'])
const POLITICAL_RE = matcher(['election', 'president', 'parliament', 'sanctions', 'minister', 'government', 'coup'])
const ECON_RE = matcher(['market', 'oil', 'inflation', 'fed', 'stocks', 'economy', 'gdp', 'tariff', 'recession'])

/**
 * Keyword category (mutually exclusive, CONFLICT > DISASTER > CLIMATE > NEWS) + secondary tags
 * (can co-occur with any category) from the item's title.
 * @param {{title?: string}} item
 * @returns {{category: 'CONFLICT'|'DISASTER'|'CLIMATE'|'NEWS', tags: string[]}}
 */
export function classify(item) {
  const t = String(item?.title || '').toLowerCase()
  let category = 'NEWS'
  if (CONFLICT_RE.test(t)) category = 'CONFLICT'
  else if (DISASTER_RE.test(t)) category = 'DISASTER'
  else if (CLIMATE_RE.test(t)) category = 'CLIMATE'
  const tags = []
  if (MILITARY_RE.test(t)) tags.push('MILITARY')
  if (POLITICAL_RE.test(t)) tags.push('POLITICAL')
  if (ECON_RE.test(t)) tags.push('ECON')
  return { category, tags }
}

// lowercase, strip punctuation, first 8 significant words — a stable dedupe key across sources
// that word the same story differently only at the margins (byline, outlet suffix, tense).
function dedupeKey(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')
}

/**
 * Merge new items into the existing feed, dedupe same-story items (by title), tag each
 * surviving story with a corroboration chip from its distinct-domain count, classify it,
 * and return newest-first, capped at 200.
 * @param {NewsItem[]} existing
 * @param {NewsItem[]} incoming
 * @returns {(NewsItem & {chip: 'CONFIRMED'|'LIKELY'|'PLAUSIBLE', category: string, tags: string[]})[]}
 */
export function mergeAndCorroborate(existing, incoming) {
  const groups = new Map()
  for (const it of [...(existing || []), ...(incoming || [])]) {
    if (!it || !it.title) continue
    const key = dedupeKey(it.title)
    const g = groups.get(key)
    if (g) g.push(it)
    else groups.set(key, [it])
  }

  const merged = []
  for (const group of groups.values()) {
    // domains accumulate across merge calls: a previously-merged item already carries its
    // own `.domains` union, so re-deriving from single `.domain` fields each call would forget
    // corroboration seen on earlier polls.
    const domains = new Set()
    for (const it of group) {
      if (Array.isArray(it.domains)) it.domains.forEach((d) => d && domains.add(d))
      else if (it.domain) domains.add(it.domain)
    }
    const chip = domains.size >= 3 ? 'CONFIRMED' : domains.size === 2 ? 'LIKELY' : 'PLAUSIBLE'
    const rep = group.reduce((a, b) => (b.ts > a.ts ? b : a)) // newest carries the story forward
    const { category, tags } = classify(rep)
    merged.push({ ...rep, chip, category, tags, domains: [...domains] })
  }

  merged.sort((a, b) => b.ts - a.ts)
  return merged.slice(0, 200)
}

/** "3M AGO" / "2H AGO" / "1D AGO" (floored; <1min -> "NOW"). */
export function ageLabel(ts, now = Date.now()) {
  const diffMs = Math.max(0, now - ts)
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'NOW'
  if (min < 60) return `${min}M AGO`
  const hr = Math.floor(diffMs / 3_600_000)
  if (hr < 24) return `${hr}H AGO`
  return `${Math.floor(diffMs / 86_400_000)}D AGO`
}
