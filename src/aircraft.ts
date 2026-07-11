// Aircraft layers (CAP-08 commercial, CAP-09 military): poll -> normalize -> point entities.
// ponytail: main-thread parse + hard entity cap; move to a worker + clustering when
// profiling shows jank (M1 engine rule will formalize).
import { Cartesian3, Color, CustomDataSource, Viewer, Cartesian2, DistanceDisplayCondition } from 'cesium'

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
      this.ds.entities.suspendEvents()
      this.ds.entities.removeAll()
      for (const a of craft) {
        this.ds.entities.add({
          id: a.id,
          position: Cartesian3.fromDegrees(a.lon, a.lat, Math.max(0, a.altM)),
          point: { pixelSize: 3, color: this.opts.color },
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
      this.ds.entities.resumeEvents()
      this.count = craft.length
      this.onUpdate(this.count)
    } catch (e) {
      console.warn(`${this.ds.name} refresh failed, keeping last data:`, e)
    }
  }
}
