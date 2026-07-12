// Earthquake layer (CAP-17, DS-08): USGS all_day GeoJSON, keyless, refreshed every minute.
// The M0 proof of the layer pipeline: fetch -> normalize -> entities -> toggle -> attribution.
import { CallbackProperty, Cartesian3, Color, CustomDataSource, Viewer } from 'cesium'
import type { Property } from 'cesium'
import { normalizeQuakes } from './quakes-normalize.mjs'
import { record } from './recorder'

export interface Quake {
  id: string
  lon: number
  lat: number
  depthKm: number
  mag: number
  place: string
  time: number
}

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const REFRESH_MS = 60_000

export class QuakeLayer {
  readonly ds = new CustomDataSource('earthquakes')
  count = 0
  playback = false
  private timer: number | undefined
  private last: Quake[] = []

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Last rendered quakes — for fusion/analyst candidates + the brief's top-N. */
  get items(): Quake[] {
    return this.last
  }
  topByMag(n: number): Quake[] {
    return [...this.last].sort((a, b) => b.mag - a.mag).slice(0, n)
  }

  start() {
    void this.refresh()
    this.timer = window.setInterval(() => void this.refresh(), REFRESH_MS)
  }

  async refresh() {
    try {
      const res = await fetch(FEED)
      if (!res.ok) throw new Error(`USGS ${res.status}`)
      const quakes = normalizeQuakes(await res.json()) as Quake[]
      void record('earthquakes', quakes)
      if (!this.playback) this.renderItems(quakes)
    } catch (e) {
      console.warn('quake refresh failed, keeping last data:', e)
    }
  }

  renderItems(quakes: Quake[]) {
    this.ds.entities.removeAll()
    quakes.forEach((q, i) => {
      const base = 4 + Math.max(0, q.mag) * 2
      this.ds.entities.add({
        id: q.id,
        position: Cartesian3.fromDegrees(q.lon, q.lat),
        point: {
          // sonar pulse — per-point CallbackProperty is cheap (billboard size, no geometry rebuild)
          pixelSize: new CallbackProperty(() => base + 1.5 + 1.5 * Math.sin(performance.now() / 300 + i), false) as unknown as Property,
          color: Color.ORANGERED.withAlpha(0.85),
          outlineColor: Color.YELLOW.withAlpha(0.6),
          outlineWidth: 1,
        },
        description: `M${q.mag} — ${q.place}<br>${new Date(q.time).toISOString()} · depth ${q.depthKm} km`,
      })
      if (q.mag >= 4)
        // static impact ring scaled by magnitude (animated ellipses rebuild geometry per frame — not worth it)
        this.ds.entities.add({
          id: `${q.id}-ring`,
          position: Cartesian3.fromDegrees(q.lon, q.lat),
          ellipse: {
            semiMajorAxis: q.mag * 15_000,
            semiMinorAxis: q.mag * 15_000,
            material: Color.ORANGERED.withAlpha(0.1),
            outline: true,
            outlineColor: Color.ORANGERED.withAlpha(0.5),
            height: 0,
          },
        })
    })
    this.count = quakes.length
    this.last = quakes
    this.onUpdate(this.count)
  }
}
