// Satellite-to-ground AOI access lines (CAP-12, AC-05). Draws a fan line sat->AOI whenever an
// imaging-watchlist satellite (CAP-29) is above a tunable elevation mask as seen from that AOI.
// ponytail: propagates its own small curated watchlist independent of SatelliteLayer's
// sparse/full slice — a bit of dual SGP4 work, but far simpler than threading a subscription
// through that layer for a handful of named birds.
import { CallbackProperty, Cartesian2, Cartesian3, Color, CustomDataSource, Entity, Viewer } from 'cesium'
import * as sat from 'satellite.js'
import { parseTle } from './tle-parse.mjs'
import { elevationAngle } from './aoi-geom.mjs'
import { AOI_LIST, IMAGING_WATCHLIST } from './aoi-data'

const CATALOG_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
const CACHE_KEY = 'godseye-tle-active'
const CACHE_TTL_MS = 2 * 3600_000
const PROPAGATE_MS = 5_000
const MAX_SATS = 40
const DEFAULT_MASK_DEG = 20

interface WatchSat {
  name: string
  noradId: string
  rec: sat.SatRec
}

interface Access {
  entity: Entity
  positions: [Cartesian3, Cartesian3]
}

function eciToEcfKm(rec: sat.SatRec, date: Date): [number, number, number] | null {
  const pv = sat.propagate(rec, date)
  if (!pv || typeof pv.position === 'boolean' || !pv.position) return null
  const ecf = sat.eciToEcf(pv.position, sat.gstime(date))
  return [ecf.x, ecf.y, ecf.z]
}

export class AOILayer {
  readonly ds = new CustomDataSource('aoi-access-lines')
  count = 0
  playbackTime: Date | null = null
  private mask = DEFAULT_MASK_DEG
  private watch: WatchSat[] = []
  private access = new Map<string, Access>() // key `${noradId}|${aoiName}`

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
    this.renderAoiMarkers()
    void this.start()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  setMask(deg: number) {
    this.mask = deg
    this.propagate() // slider is the primary control — reflect it now, don't wait for the 5s tick
  }

  private async start() {
    this.watch = await this.loadWatchlist()
    this.propagate()
    window.setInterval(() => this.propagate(), PROPAGATE_MS)
  }

  /** Re-propagate immediately (playback scrubbing shouldn't wait for the tick). */
  repropagate() {
    this.propagate()
  }

  private renderAoiMarkers() {
    for (const a of AOI_LIST) {
      this.ds.entities.add({
        id: `aoi-${a.name}`,
        position: Cartesian3.fromDegrees(a.lon, a.lat),
        point: { pixelSize: 6, color: Color.CYAN.withAlpha(0.9), outlineColor: Color.BLACK.withAlpha(0.5), outlineWidth: 1 },
        label: {
          text: a.name,
          font: '11px monospace',
          fillColor: Color.CYAN,
          outlineColor: Color.BLACK.withAlpha(0.7),
          outlineWidth: 2,
          pixelOffset: new Cartesian2(0, -10),
          showBackground: false,
        },
        description: `<strong>AOI</strong><br>${a.name}`,
      })
    }
  }

  private async loadWatchlist(): Promise<WatchSat[]> {
    const all = await this.loadCatalog()
    const re = new RegExp(IMAGING_WATCHLIST.join('|'), 'i')
    return all
      .filter((t) => re.test(t.name))
      .slice(0, MAX_SATS)
      .map((t) => ({ name: t.name, noradId: t.noradId, rec: sat.twoline2satrec(t.line1, t.line2) }))
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
      if (parsed.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), text }))
        } catch {} // quota: cache is an optimization, not a requirement
        return parsed
      }
    } catch (e) {
      console.warn('celestrak fetch failed (aoi):', e)
    }
    return cached ? parseTle((JSON.parse(cached) as { text: string }).text) : []
  }

  private propagate() {
    if (!this.ds.show) return
    if (this.watch.length === 0) return
    const t = this.playbackTime ?? new Date()
    const live = new Set<string>()

    for (const s of this.watch) {
      const satEcf = eciToEcfKm(s.rec, t)
      if (!satEcf) continue
      const satCart = new Cartesian3(satEcf[0] * 1000, satEcf[1] * 1000, satEcf[2] * 1000)
      for (const a of AOI_LIST) {
        const el = elevationAngle(satEcf, a.lat, a.lon)
        const key = `${s.noradId}|${a.name}`
        if (el < this.mask) continue
        live.add(key)
        let acc = this.access.get(key)
        if (!acc) {
          const positions: [Cartesian3, Cartesian3] = [satCart, Cartesian3.fromDegrees(a.lon, a.lat)]
          const entity = this.ds.entities.add({
            id: `aoiline-${key}`,
            polyline: {
              positions: new CallbackProperty(() => acc!.positions, false),
              width: 1,
              material: Color.CYAN.withAlpha(0.5),
            },
            // no baked-in elevation: the line endpoint moves each tick, a static angle would go stale
            description: `<strong>ACCESS</strong><br>${s.name} → ${a.name}<br>above ${this.mask}° mask`,
          })
          acc = { entity, positions }
          this.access.set(key, acc)
        } else {
          acc.positions[0] = satCart
        }
      }
    }

    // drop lines that fell below mask this tick
    for (const [key, acc] of this.access) {
      if (!live.has(key)) {
        this.ds.entities.remove(acc.entity)
        this.access.delete(key)
      }
    }

    this.count = this.access.size
    this.onUpdate(this.count)
  }
}
