// Pure FRED CSV parser (DS-17): header line + 'YYYY-MM-DD,VALUE' rows, '.' = missing
// day (market holiday/weekend). Plain .mjs so `node --test` runs it headless — no
// fetch/DOM involved (mirrors src/quakes-normalize.mjs).

/**
 * @param {string} text raw fredgraph.csv body
 * @returns {Array<{date: string, value: number}>}
 */
export function parseFredCsv(text) {
  const out = []
  const lines = text.trim().split('\n')
  for (const line of lines.slice(1)) {
    // header row is lines[0] ("DATE,DCOILBRENTEU"); skip it
    const [date, raw] = line.split(',')
    if (!date || raw === undefined) continue
    const cell = raw.trim()
    if (cell === '.') continue // FRED's missing-day sentinel
    const value = Number(cell)
    if (!Number.isFinite(value)) continue
    out.push({ date, value })
  }
  return out
}
