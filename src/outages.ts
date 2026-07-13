// Internet-outage pins (IODA -> narrative). On-demand SCAN pulls IODA's keyless
// v2 outages/summary feed for the last 24h, joins each country code to a
// hand-maintained centroid, and drops a magenta/violet ring sized by outage
// score. Click a pin -> country + score + fly-to.
//
// PROXY NOTE: /feeds/ioda needs a query-preserving proxy route in
// vite.config.ts — the existing feed() helper (used by opensky/mil/gdelt/etc)
// hardcodes `rewrite: () => path`, which DISCARDS the client's query string.
// IODA needs per-call from=/until= epochs forwarded, so the route must instead
// follow the /feeds/oil pattern (rewrite: (p) => p.replace(prefix, target),
// which keeps everything after the prefix, query included). Out of scope here
// (task is core+layer only) — add that route before wiring this into the app.
import { Cartesian2, Cartesian3, Color, CustomDataSource, PropertyBag, Viewer } from 'cesium'
import { normalizeIoda, type OutagePin } from './outages-core.mjs'

const FEED = '/feeds/ioda' // proxied -> api.ioda.inetintel.cc.gatech.edu/v2/outages/summary
const LABEL_TOP_N = 10 // pins already sorted score desc, so index < 10 gets a label
const MAGENTA = Color.fromCssColorString('#e91e8c')
const VIOLET = Color.fromCssColorString('#7c4dff')

export class OutagesLayer {
  readonly ds = new CustomDataSource('outages')
  count = 0
  busy = false
  /** id -> pin, for click fly-to (matches news/darkvessel click routing). */
  private pins = new Map<string, OutagePin>()

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Last scan's country signals (lat/lon/name/score) — region-intel evidence provider. */
  get items(): OutagePin[] {
    return [...this.pins.values()]
  }

  /** Fetch the last-24h IODA outage summary, redraw pins. Returns a status line. */
  async scan(): Promise<string> {
    if (this.busy) return 'OUTAGES: BUSY'
    this.busy = true
    try {
      const until = Math.floor(Date.now() / 1000)
      const from = until - 86_400
      const qs = `entityType=country&from=${from}&until=${until}`
      const res = await fetch(`${FEED}?${qs}`)
      if (!res.ok) throw new Error(`ioda ${res.status}`)
      const summary = await res.json()
      const pins = normalizeIoda(summary)
      this.draw(pins)
      if (!pins.length) return 'OUTAGES: NO SIGNALS IN LAST 24H'
      const top = pins[0]
      return `OUTAGES: ${pins.length} COUNTRIES · TOP ${top.name.toUpperCase()} (${Math.round(top.score)})`
    } catch (err) {
      console.warn('outages scan failed:', err)
      return 'OUTAGES: IODA UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  private draw(pins: OutagePin[]) {
    this.ds.entities.removeAll()
    this.pins.clear()
    const max = pins.length ? pins[0].score : 1
    pins.forEach((p, i) => {
      const id = `outage-${p.id}`
      this.pins.set(id, p)
      const heat = max > 0 ? p.score / max : 0 // 0..1
      const ring = Color.lerp(VIOLET, MAGENTA, heat, new Color())
      this.ds.entities.add({
        id,
        position: Cartesian3.fromDegrees(p.lon, p.lat),
        point: {
          pixelSize: 10 + Math.round(heat * 16), // 10..26 by score, hollow ring below
          color: ring.withAlpha(0.08), // near-transparent fill -> reads as a ring
          outlineColor: ring.withAlpha(0.9),
          outlineWidth: 3,
        },
        label:
          i < LABEL_TOP_N
            ? {
                text: p.name,
                font: '10px monospace',
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK.withAlpha(0.7),
                outlineWidth: 2,
                pixelOffset: new Cartesian2(0, -14),
                showBackground: false,
              }
            : undefined,
        description: `<strong>NET OUTAGE</strong><br>${p.name}<br>SCORE: ${Math.round(p.score)}<br>SOURCE: IODA 24H`,
        properties: new PropertyBag({ type: 'outage', score: p.score }),
      })
    })
    this.count = pins.length
    this.onUpdate(this.count)
  }

  /** Wired from main's LEFT_CLICK for outage- ids: fly to the pin + report it. */
  select(id: string): string {
    const p = this.pins.get(id)
    if (!p) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(p.lon, p.lat, 800_000) })
    return `OUTAGE: ${p.name.toUpperCase()} · SCORE ${Math.round(p.score)}`
  }
}
