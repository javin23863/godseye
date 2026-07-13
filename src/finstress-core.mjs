// FIN. STRESS core (headless): FRED CSV -> series, % change, stress-color thresholds,
// and the instrument roster. Plain .mjs so `node --test` runs it headless (mirrors
// oil-csv.mjs / quakes-normalize.mjs) — reuses the same CSV parser, doesn't reinvent it.
import { parseFredCsv } from './oil-csv.mjs'

export const INSTRUMENTS = [
  { key: 'WTI', fred: 'DCOILWTICO', hub: { name: 'Cushing OK', lat: 35.98, lon: -96.77 } },
  { key: 'BRENT', fred: 'DCOILBRENTEU', hub: { name: 'North Sea', lat: 57.5, lon: 1.0 } },
  { key: 'NATGAS', fred: 'DHHNGSP', hub: { name: 'Henry Hub LA', lat: 29.98, lon: -92.03 } },
  { key: 'VIX', fred: 'VIXCLS', hub: { name: 'CBOE Chicago', lat: 41.88, lon: -87.63 } },
  // GOLD: curl-verified 2026-07-13 — GOLDAMGBD228NLBM (LBMA PM fix) and GOLDPMGBD228NLBM
  // are both discontinued (FRED returns an HTML error page, no CSV). IQ12260 and
  // IR14270 (gold-ore/gold-mining PPI) are monthly and stale (latest 2026-05-01). The
  // only series returning live daily 2026-07 rows is GVZCLS (CBOE Gold ETF Volatility
  // Index) — a stress proxy rather than a spot price, used here for that reason.
  { key: 'GOLD', fred: 'GVZCLS', hub: { name: 'London Bullion Market', lat: 51.51, lon: -0.09 } },
]

/** @param {string} csvText raw fredgraph.csv body -> {dates, values} parallel arrays. */
export function buildSeries(csvText) {
  const rows = parseFredCsv(csvText)
  return { dates: rows.map((r) => r.date), values: rows.map((r) => r.value) }
}

/** % change from `days` trading-rows back to the latest row (FRED drops holiday/missing
 *  rows entirely via parseFredCsv, so this counts rows, not calendar days). Null when
 *  there isn't enough history or the base value is zero (div-by-zero guard). */
export function pctChange(series, days) {
  const v = series.values
  if (!v || v.length <= days) return null
  const from = v[v.length - 1 - days]
  const to = v[v.length - 1]
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null
  return ((to - from) / Math.abs(from)) * 100
}

/** css color for a stress dot/ring: calm ≤0%, amber >2%, red >5% (vol/commodity spike bands). */
export function stressColor(pctChange5d) {
  if (pctChange5d == null || !Number.isFinite(pctChange5d)) return '#78909c' // unknown -> neutral gray
  if (pctChange5d > 5) return '#ff5252'
  if (pctChange5d > 2) return '#ffab40'
  return '#9ccc65'
}
