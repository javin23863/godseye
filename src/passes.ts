// AOI imaging-pass scheduler (CAP-12/CAP-29): real OSINT tasking. On demand, for every
// (imaging-watchlist sat, AOI) pair it propagates the SAME cached CelesTrak TLEs the SAT AOI
// LINES feature uses (localStorage godseye-tle-active) with satellite.js SGP4 and finds the next
// time the bird clears the elevation mask over that target within ~6h. Sorted soonest-first;
// click a row to fly to the AOI. No network of its own — rides the TLE cache the sat scan fills.
import { Cartesian3, Viewer } from 'cesium'
import * as sat from 'satellite.js'
import { parseTle } from './tle-parse.mjs'
import { nextPass } from './passes-core.mjs'
import { AOI_LIST, IMAGING_WATCHLIST, type Aoi } from './aoi-data'

const CACHE_KEY = 'godseye-tle-active'
const HORIZON_MIN = 360 // ~6h look-ahead
const STEP_SEC = 30 // pass-timing resolution
const MASK_DEG = 20 // matches the SAT AOI LINES default mask
const MAX_SATS = 40 // matches AOILayer's watchlist cap — same birds, same cache

interface PassRow {
  satName: string
  aoi: Aoi
  etaMin: number
}

/** ECEF-km propagator for one SatRec, matching the eci->ecf path in satellites.ts / aoi.ts. */
function ecefKmAt(rec: sat.SatRec, ms: number): { x: number; y: number; z: number } | null {
  const date = new Date(ms)
  const pv = sat.propagate(rec, date)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) return null
  const ecf = sat.eciToEcf(pv.position, sat.gstime(date))
  return { x: ecf.x, y: ecf.y, z: ecf.z }
}

export class PassScheduler {
  constructor(private viewer: Viewer, private listEl: HTMLElement) {}

  /** Compute + render the next-pass table over the cached TLEs; returns a HUD status line. */
  scan(): string {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) {
      this.listEl.textContent = 'NO TLEs (SCAN SATS FIRST)'
      return 'PASSES: NO TLEs — RUN SATELLITES SCAN FIRST'
    }
    const catalog = parseTle((JSON.parse(cached) as { text: string }).text)
    const re = new RegExp(IMAGING_WATCHLIST.join('|'), 'i')
    const watch = catalog.filter((t) => re.test(t.name)).slice(0, MAX_SATS)
    if (watch.length === 0) {
      this.listEl.textContent = 'NO IMAGING SATS IN CACHE'
      return 'PASSES: NO IMAGING WATCHLIST SATS IN THE CACHED CATALOG'
    }

    const now = Date.now()
    const rows: PassRow[] = []
    for (const t of watch) {
      const rec = sat.twoline2satrec(t.line1, t.line2)
      for (const aoi of AOI_LIST) {
        const ms = nextPass((m) => ecefKmAt(rec, m), aoi, {
          fromMs: now,
          horizonMin: HORIZON_MIN,
          stepSec: STEP_SEC,
          maskDeg: MASK_DEG,
        })
        if (ms != null) rows.push({ satName: t.name, aoi, etaMin: Math.round((ms - now) / 60_000) })
      }
    }
    rows.sort((a, b) => a.etaMin - b.etaMin)
    this.render(rows)
    return `PASSES: ${rows.length} UPCOMING · ${watch.length} SATS × ${AOI_LIST.length} AOIs · NEXT ${HORIZON_MIN / 60}H @ ${MASK_DEG}° MASK`
  }

  private render(rows: PassRow[]) {
    this.listEl.innerHTML = ''
    if (rows.length === 0) {
      this.listEl.textContent = `NO PASSES IN NEXT ${HORIZON_MIN / 60}H`
      return
    }
    for (const r of rows) {
      const row = document.createElement('button')
      row.className = 'pass-row'
      const h = Math.floor(r.etaMin / 60)
      const m = r.etaMin % 60
      const eta = `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m`
      row.textContent = `${r.satName} ▸ ${r.aoi.name} in ${eta}`
      row.onclick = () =>
        this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(r.aoi.lon, r.aoi.lat, 200_000) })
      this.listEl.appendChild(row)
    }
  }
}
