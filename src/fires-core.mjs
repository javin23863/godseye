// Pure CSV parser for NASA FIRMS active-fire feeds (VIIRS 375m + MODIS 1km share
// the same column family — this handles both header layouts).
// VIIRS columns: latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
// MODIS columns: latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
// confidence differs too: VIIRS is 'l'|'n'|'h', MODIS is 0-100 numeric — bucketed
// here to the same l/n/h scale so callers (fires.ts) never branch on satellite.

/**
 * @typedef {Object} FirePin
 * @property {number} lat
 * @property {number} lon
 * @property {number} frp     // fire radiative power (MW), 0 if missing/non-numeric
 * @property {'l'|'n'|'h'} conf
 * @property {number} ts      // epoch ms from acq_date+acq_time, 0 if unparseable
 */

/** MODIS numeric confidence (0-100) -> VIIRS-style bucket. */
function bucketConf(raw) {
  const s = String(raw).trim().toLowerCase()
  if (s === 'l' || s === 'n' || s === 'h') return s
  const n = Number(s)
  if (!Number.isFinite(n)) return 'n'
  if (n < 30) return 'l'
  if (n < 80) return 'n'
  return 'h'
}

/** acq_date 'YYYY-MM-DD' + acq_time 'HMM'/'HHMM' -> epoch ms (UTC), 0 if bad. */
function parseTs(date, time) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim())
  if (!m) return 0
  const t = String(time).trim().padStart(4, '0')
  const hh = Number(t.slice(0, 2))
  const mm = Number(t.slice(2, 4))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * Parse a FIRMS active-fire CSV (VIIRS or MODIS header variant) into fire pins.
 * Malformed/short lines are skipped, never thrown.
 *
 * @param {string} csvText
 * @param {{maxRows?: number}} [opts]
 * @returns {FirePin[]} pins sorted by frp desc, capped at maxRows
 */
export function parseFirmsCsv(csvText, { maxRows = 1500 } = {}) {
  const lines = String(csvText ?? '').split(/\r?\n/).filter((l) => l.trim().length)
  if (!lines.length) return []

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const idx = (...names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1
  const iLat = idx('latitude')
  const iLon = idx('longitude')
  const iFrp = idx('frp')
  const iConf = idx('confidence')
  const iDate = idx('acq_date')
  const iTime = idx('acq_time')
  if (iLat < 0 || iLon < 0) return [] // not a FIRMS CSV at all

  /** @type {FirePin[]} */
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < header.length) continue // truncated/malformed line
    const lat = Number(cols[iLat])
    const lon = Number(cols[iLon])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue
    const frp = iFrp >= 0 ? Number(cols[iFrp]) : 0
    rows.push({
      lat,
      lon,
      frp: Number.isFinite(frp) ? frp : 0,
      conf: iConf >= 0 ? bucketConf(cols[iConf]) : 'n',
      ts: iDate >= 0 && iTime >= 0 ? parseTs(cols[iDate], cols[iTime]) : 0,
    })
  }

  rows.sort((a, b) => b.frp - a.frp)
  return rows.slice(0, maxRows)
}
