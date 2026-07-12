// Aircraft layers (CAP-08 commercial, CAP-09 military): poll -> normalize -> point entities.
// ponytail: main-thread parse + hard entity cap; move to a worker + clustering when
// profiling shows jank (M1 engine rule will formalize).
import {
  Cartesian3,
  Color,
  CustomDataSource,
  Viewer,
  Cartesian2,
  DistanceDisplayCondition,
  Math as CMath,
  NearFarScalar,
  PolylineGlowMaterialProperty,
} from 'cesium'
import { record } from './recorder'

// White glyph pointing north; billboard `color` tints it per-layer. rotation = -heading
// with alignedAxis Z reads correctly top-down (approximate at steep tilts — HUD trade).
const PLANE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
  '<path fill="#fff" d="M12 0l1.8 7.2 9.2 5v2l-9-2.6-.6 6.4 3.4 2.8V23l-4.8-1.4L7.2 23v-2.2l3.4-2.8-.6-6.4-9 2.6v-2l9.2-5z"/></svg>'
const PLANE_URI = 'data:image/svg+xml,' + encodeURIComponent(PLANE_SVG)
const TRAIL_LEN = 10 // fixes per aircraft (~10 min at the mil 60s poll)

/** Altitude -> hue ramp: warm on the deck, blue at cruise. */
function altColor(altM: number): Color {
  const t = Math.min(Math.max(altM / 13_000, 0), 1)
  return Color.fromHsl(0.08 + 0.58 * t, 0.9, 0.55)
}

export interface Aircraft {
  id: string
  callsign: string
  lon: number
  lat: number
  altM: number
  heading: number
}

const ENTITY_CAP = 8000 // hard on-screen budget (roadmap M1 engine rule)

export class AircraftLayer {
  readonly ds: CustomDataSource
  count = 0
  private timer: number | undefined

  constructor(
    viewer: Viewer,
    name: string,
    private opts: {
      urls: string[] // tried in order — community feeds 502 without warning, keep a mirror
      normalize: (body: never) => Aircraft[] // JSDoc'd .mjs normalizers narrow their own input
      pollMs: number
      color: Color
      labels?: boolean
      trails?: boolean // glow trails need a fast poll; useless at the 15-min flights cadence
    },
    private onUpdate: (count: number) => void,
  ) {
    this.ds = new CustomDataSource(name)
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Playback mode: live refreshes keep recording but stop touching the screen. */
  playback = false

  start() {
    void this.refresh()
    this.timer = window.setInterval(() => void this.refresh(), this.opts.pollMs)
  }

  async refresh() {
    try {
      let body: unknown = null
      for (const url of this.opts.urls) {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`${url} -> ${res.status}`)
          body = await res.json()
          break
        } catch (e) {
          console.warn(`${this.ds.name}: ${url} failed, trying next mirror:`, e)
        }
      }
      if (body === null) throw new Error('all mirrors failed')
      const craft = this.opts.normalize(body as never).slice(0, ENTITY_CAP)
      void record(this.ds.name, craft) // 4D doctrine: record-first, render second
      if (!this.playback) this.renderItems(craft)
    } catch (e) {
      console.warn(`${this.ds.name} refresh failed, keeping last data:`, e)
    }
  }

  // last few rendered positions per aircraft — replays through renderItems too, so the
  // 4D playhead grows trails from whatever frames it paints (scrub-backwards looks odd; fine)
  private history = new Map<string, Cartesian3[]>()

  renderItems(craft: Aircraft[]) {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    const seen = new Set<string>()
    for (const a of craft) {
      const pos = Cartesian3.fromDegrees(a.lon, a.lat, Math.max(0, a.altM))
      if (this.opts.trails) {
        seen.add(a.id)
        const h = this.history.get(a.id) ?? []
        h.push(pos)
        if (h.length > TRAIL_LEN) h.shift()
        this.history.set(a.id, h)
        if (h.length >= 2)
          this.ds.entities.add({
            id: `${a.id}-trail`,
            polyline: {
              positions: [...h],
              width: 6,
              material: new PolylineGlowMaterialProperty({ glowPower: 0.25, color: altColor(a.altM).withAlpha(0.8) }),
            },
          })
      }
      this.ds.entities.add({
        id: a.id,
        position: pos,
        billboard: {
          image: PLANE_URI,
          color: this.opts.color,
          width: 18,
          height: 18,
          rotation: CMath.toRadians(-a.heading),
          alignedAxis: Cartesian3.UNIT_Z,
          scaleByDistance: new NearFarScalar(1e4, 1.1, 8e6, 0.45),
        },
        label: this.opts.labels
          ? {
              text: a.callsign,
              font: '10px Consolas, monospace',
              fillColor: this.opts.color,
              pixelOffset: new Cartesian2(6, -6),
              // labels only near the ground — thousands of labels at global zoom melt the GPU
              distanceDisplayCondition: new DistanceDisplayCondition(0, 3_000_000),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            }
          : undefined,
        description: `${a.callsign} · alt ${Math.round(a.altM)} m · hdg ${Math.round(a.heading)}°`,
      })
    }
    for (const k of this.history.keys()) if (!seen.has(k)) this.history.delete(k) // gone from feed -> drop trail
    this.ds.entities.resumeEvents()
    this.count = craft.length
    this.onUpdate(this.count)
  }
}
