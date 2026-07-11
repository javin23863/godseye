// Pure TLE catalog parser — plain .mjs so `node --test` runs it directly.
// CelesTrak GROUP downloads are throttled to one per ~2h per IP; a throttle
// banner (plain text, no TLE lines) parses to [] and callers keep cached data.
/**
 * @param {string} text 3-line-element catalog (name / line1 / line2)
 * @returns {Array<{name: string, line1: string, line2: string, noradId: string}>}
 */
export function parseTle(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i + 1]
    if (!lines[i + 2]) break
    if (l1.startsWith('1 ') && lines[i + 2].startsWith('2 ')) {
      out.push({
        name: lines[i].trim() || `NORAD ${l1.slice(2, 7).trim()}`,
        line1: l1,
        line2: lines[i + 2],
        noradId: l1.slice(2, 7).trim(),
      })
      i += 2
    }
  }
  return out
}
