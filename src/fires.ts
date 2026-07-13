// Active fires layer: NASA FIRMS VIIRS 375m active-fire detections, last 24h global.
//
// DATA NOTE: the module brief asked to verify which archive CSV is keyless-reachable.
// Both firms.modaps.eosdis.nasa.gov/data/active_fire/{suomi-npp-viirs-c2,noaa-20-viirs-c2}
// /csv/*_Global_24h.csv URLs return HTTP 200 with no MAP_KEY (these are the public
// "archive download" links, distinct from the api/area/ MAP_KEY-gated endpoints).
// suomi-npp returned header-only (0 detections) at verify time; noaa-20 returned live
// rows, so the proxy targets noaa-20. No MAP_KEY plumbing needed for this endpoint —
// if that ever changes, append `?MAP_KEY=` + env FIRMS_MAP_KEY server-side in the proxy.
import { Cartesian3, Color, CustomDataSource, PropertyBag, Viewer } from 'cesium'
import { parseFirmsCsv, type FirePin } from './fires-core.mjs'

const FEED = '/feeds/fires' // proxied -> firms.../noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv
const MAX_PINS = 1500 // matches parseFirmsCsv's default cap
const FIRE_COLOR = Color.fromCssColorString('#ff3d00') // orange-red

export class FiresLayer {
  readonly ds = new CustomDataSource('fires')
  count = 0
  busy = false
  private pins = new Map<string, FirePin>()

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Last scan's detections (lat/lon/frp/conf) — region-intel evidence provider. */
  get items(): FirePin[] {
    return [...this.pins.values()]
  }

  /** Fetch the FIRMS feed, redraw pins. Returns a status line. */
  async scan(): Promise<string> {
    if (this.busy) return 'FIRES: BUSY'
    this.busy = true
    try {
      const res = await fetch(FEED)
      if (!res.ok) throw new Error(`firms ${res.status}`)
      const csv = await res.text()
      const pins = parseFirmsCsv(csv, { maxRows: MAX_PINS })
      this.draw(pins)
      if (!pins.length) return 'FIRES: NO ACTIVE DETECTIONS (LAST 24H)'
      return `FIRES: ${pins.length} ACTIVE · TOP FRP ${pins[0].frp.toFixed(1)}MW`
    } catch (err) {
      console.warn('fires scan failed:', err)
      return 'FIRES: FIRMS UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  private draw(pins: FirePin[]) {
    this.ds.entities.removeAll()
    this.pins.clear()
    const maxFrp = pins.length ? Math.max(...pins.map((p) => p.frp), 1) : 1
    pins.forEach((p, i) => {
      const id = `fires-${i}`
      this.pins.set(id, p)
      const heat = Math.min(1, p.frp / maxFrp)
      this.ds.entities.add({
        id,
        position: Cartesian3.fromDegrees(p.lon, p.lat),
        point: {
          pixelSize: 3 + Math.round(heat * 9), // 3..12px by FRP
          color: FIRE_COLOR.withAlpha(0.8),
          outlineColor: Color.BLACK.withAlpha(0.4),
          outlineWidth: 1,
        },
        // no label — a 24h global VIIRS pass is thousands of points, too dense to label
        description: `<strong>ACTIVE FIRE</strong><br>FRP: ${p.frp.toFixed(1)} MW<br>Confidence: ${p.conf.toUpperCase()}<br>${p.ts ? new Date(p.ts).toISOString() : 'unknown time'}`,
        properties: new PropertyBag({ type: 'fires', frp: p.frp }),
      })
    })
    this.count = pins.length
    this.onUpdate(this.count)
  }

  /** Wired from main's LEFT_CLICK for fires- ids: fly to the pin + report it. */
  select(id: string): string {
    const p = this.pins.get(id)
    if (!p) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(p.lon, p.lat, 200_000) })
    return `FIRE: ${p.frp.toFixed(1)}MW FRP · ${p.conf.toUpperCase()} CONFIDENCE`
  }
}
