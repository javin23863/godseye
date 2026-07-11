// Satellite layer (CAP-11, DS-04): CelesTrak TLEs + satellite.js SGP4, propagated
// client-side. SPARSE (default) renders a slice of the catalog; FULL renders all.
// Click a satellite to draw its orbit ground track (one period) — CAP-11/CAP-12 seed.
import {
  CallbackProperty,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  CustomDataSource,
  Entity,
  JulianDate,
  Viewer,
} from 'cesium'
import * as sat from 'satellite.js'
import { parseTle } from './tle-parse.mjs'

const CATALOG_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
const CACHE_KEY = 'godseye-tle-active'
const CACHE_TTL_MS = 2 * 3600_000 // CelesTrak group data updates every ~2h and throttles re-downloads
const SPARSE_COUNT = 1500
const PROPAGATE_MS = 5_000 // ponytail: 5s re-propagation on main thread; worker when FULL-mode profiling demands

interface Sat {
  name: string
  noradId: string
  rec: sat.SatRec
  entity: Entity
}

function eciToCartesian3(rec: sat.SatRec, date: Date): Cartesian3 | null {
  const pv = sat.propagate(rec, date)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) return null
  const gmst = sat.gstime(date)
  const ecf = sat.eciToEcf(pv.position, gmst)
  return new Cartesian3(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000)
}

export class SatelliteLayer {
  readonly ds = new CustomDataSource('satellites')
  count = 0
  full = false
  private all: { name: string; line1: string; line2: string; noradId: string }[] = []
  private active: Sat[] = []
  private orbitEntity: Entity | null = null

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  async start() {
    this.all = await this.loadCatalog()
    this.rebuild()
    window.setInterval(() => this.propagateAll(), PROPAGATE_MS)
  }

  setFull(full: boolean) {
    this.full = full
    this.rebuild()
  }

  private async loadCatalog() {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { at, text } = JSON.parse(cached) as { at: number; text: string }
      if (Date.now() - at < CACHE_TTL_MS) return parseTle(text)
    }
    try {
      const res = await fetch(CATALOG_URL)
      const text = await res.text()
      const parsed = parseTle(text)
      // throttle banner parses to [] -> fall back to stale cache rather than nothing
      if (parsed.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), text }))
        } catch {} // quota: cache is an optimization, not a requirement
        return parsed
      }
    } catch (e) {
      console.warn('celestrak fetch failed:', e)
    }
    return cached ? parseTle((JSON.parse(cached) as { text: string }).text) : []
  }

  private rebuild() {
    this.ds.entities.removeAll()
    this.active = []
    const slice = this.full ? this.all : this.all.slice(0, SPARSE_COUNT)
    const now = new Date()
    for (const t of slice) {
      const rec = sat.twoline2satrec(t.line1, t.line2)
      const pos = eciToCartesian3(rec, now)
      if (!pos) continue
      const entity = this.ds.entities.add({
        id: `sat-${t.noradId}`,
        position: new ConstantPositionProperty(pos),
        point: { pixelSize: 2, color: Color.WHITE.withAlpha(0.9) },
        description: `${t.name} · NORAD ${t.noradId}`,
      })
      this.active.push({ name: t.name, noradId: t.noradId, rec, entity })
    }
    this.count = this.active.length
    this.onUpdate(this.count)
  }

  /** Playback: null = live "now"; a Date = propagate the whole constellation at that instant. */
  playbackTime: Date | null = null

  private propagateAll() {
    if (!this.ds.show) return
    const t = this.playbackTime ?? new Date()
    for (const s of this.active) {
      const pos = eciToCartesian3(s.rec, t)
      if (pos) (s.entity.position as ConstantPositionProperty).setValue(pos)
    }
  }

  /** Re-propagate immediately (playback scrubbing shouldn't wait for the 5s tick). */
  repropagate() {
    this.propagateAll()
  }

  /** Draw (or move) the orbit line for a picked satellite entity; returns info text or null. */
  showOrbit(entityId: string): string | null {
    const s = this.active.find((x) => x.entity.id === entityId)
    if (!s) return null
    // sample one orbital period into an earth-fixed ground track
    const periodMin = (2 * Math.PI) / s.rec.no // no = rad/min
    const start = new Date()
    const positions: Cartesian3[] = []
    const steps = 240
    for (let i = 0; i <= steps; i++) {
      const p = eciToCartesian3(s.rec, new Date(start.getTime() + (i / steps) * periodMin * 60_000))
      if (p) positions.push(p)
    }
    if (this.orbitEntity) this.ds.entities.remove(this.orbitEntity)
    this.orbitEntity = this.ds.entities.add({
      polyline: {
        positions: new CallbackProperty(() => positions, false),
        width: 1,
        material: Color.RED.withAlpha(0.7),
      },
    })
    const altKm = Cartesian3.magnitude(positions[0]) / 1000 - 6371
    const kind = periodMin > 1300 && periodMin < 1500 ? (s.rec.inclo < 0.2 ? 'GEOSTATIONARY' : 'GEOSYNCHRONOUS') : periodMin < 128 ? 'LEO' : 'MEO/HEO'
    return `${s.name} · NORAD ${s.noradId} · ~${Math.round(altKm)} km · ${Math.round(periodMin)} min · ${kind}`
  }

  clearOrbit() {
    if (this.orbitEntity) {
      this.ds.entities.remove(this.orbitEntity)
      this.orbitEntity = null
    }
  }
}
