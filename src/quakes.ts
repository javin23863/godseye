// Earthquake layer (CAP-17, DS-08): USGS all_day GeoJSON, keyless, refreshed every minute.
// The M0 proof of the layer pipeline: fetch -> normalize -> entities -> toggle -> attribution.
import { Cartesian3, Color, CustomDataSource, Viewer } from 'cesium'
import { normalizeQuakes } from './quakes-normalize.mjs'

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
const REFRESH_MS = 60_000

export class QuakeLayer {
  readonly ds = new CustomDataSource('earthquakes')
  count = 0
  private timer: number | undefined

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
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
    this.timer = window.setInterval(() => void this.refresh(), REFRESH_MS)
  }

  async refresh() {
    try {
      const res = await fetch(FEED)
      if (!res.ok) throw new Error(`USGS ${res.status}`)
      const quakes = normalizeQuakes(await res.json())
      this.ds.entities.removeAll()
      for (const q of quakes) {
        this.ds.entities.add({
          id: q.id,
          position: Cartesian3.fromDegrees(q.lon, q.lat),
          point: {
            pixelSize: 4 + Math.max(0, q.mag) * 2,
            color: Color.ORANGERED.withAlpha(0.85),
            outlineColor: Color.YELLOW.withAlpha(0.6),
            outlineWidth: 1,
          },
          description: `M${q.mag} — ${q.place}<br>${new Date(q.time).toISOString()} · depth ${q.depthKm} km`,
        })
      }
      this.count = quakes.length
      this.onUpdate(this.count)
    } catch (e) {
      console.warn('quake refresh failed, keeping last data:', e)
    }
  }
}
