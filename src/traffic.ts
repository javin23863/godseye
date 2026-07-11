// Street traffic particles (CAP-16): Overpass road network for the current view,
// vehicles animated along polylines. On-demand per view (Overpass is a shared free
// resource) — activate while zoomed to a city, re-activate after moving the camera.
// ponytail: main-thread tick over <=600 points; worker + arterial second pass when
// a profiler complains (the original crashed on naive spawning — cap is the fix).
import {
  Cartesian3,
  Color,
  Math as CMath,
  PointPrimitiveCollection,
  LabelCollection,
  Viewer,
} from 'cesium'
import { buildRoad, pointAt } from './road-geom.mjs'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const MAX_VEHICLES = 600
const MAX_SPAN_DEG = 0.6 // refuse queries wider than a city — Overpass etiquette + perf
const LABEL_EVERY = 12 // sparse VEH-XXXX labels (dense mode melts the GPU)

interface Road {
  pts: { lat: number; lon: number }[]
  cum: number[]
  length: number
}
interface Vehicle {
  road: Road
  d: number
  dir: 1 | -1
  speed: number // m/s
}

export class TrafficLayer {
  private points: PointPrimitiveCollection
  private labels: LabelCollection
  private vehicles: Vehicle[] = []
  private prims: ReturnType<PointPrimitiveCollection['add']>[] = []
  private labelPrims: (ReturnType<LabelCollection['add']> | null)[] = []
  private tickRemover: (() => void) | null = null
  private lastTick = 0
  count = 0
  busy = false

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    this.points = viewer.scene.primitives.add(new PointPrimitiveCollection()) as PointPrimitiveCollection
    this.labels = viewer.scene.primitives.add(new LabelCollection()) as LabelCollection
  }

  get shown() {
    return this.points.show
  }
  set shown(v: boolean) {
    this.points.show = v
    this.labels.show = v
  }

  /** Query roads for the current camera view and (re)spawn vehicles. */
  async activate(): Promise<string> {
    if (this.busy) return 'TRAFFIC: BUSY'
    const rect = this.viewer.camera.computeViewRectangle()
    if (!rect) return 'TRAFFIC: NO VIEW'
    const s = CMath.toDegrees(rect.south)
    const w = CMath.toDegrees(rect.west)
    const n = CMath.toDegrees(rect.north)
    const e = CMath.toDegrees(rect.east)
    if (n - s > MAX_SPAN_DEG || e - w > MAX_SPAN_DEG) return 'TRAFFIC: ZOOM INTO A CITY FIRST'

    this.busy = true
    try {
      // main roads only — the sequential-loading lesson from the original build
      const q = `[out:json][timeout:25];way["highway"~"^(motorway|trunk|primary|secondary)$"](${s},${w},${n},${e});out geom 400;`
      const res = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
      })
      if (!res.ok) throw new Error(`overpass ${res.status}`)
      const body = (await res.json()) as { elements: { geometry?: { lat: number; lon: number }[] }[] }
      const roads = body.elements.map((el) => buildRoad(el.geometry ?? [])).filter((r): r is Road => r !== null)
      if (!roads.length) return 'TRAFFIC: NO ROADS IN VIEW'
      this.spawn(roads)
      return `TRAFFIC: ${this.count} VEHICLES ON ${roads.length} ROADS`
    } catch (err) {
      console.warn('traffic activate failed:', err)
      return 'TRAFFIC: OVERPASS UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  private spawn(roads: Road[]) {
    this.clear()
    const totalLen = roads.reduce((a, r) => a + r.length, 0)
    for (let i = 0; i < MAX_VEHICLES; i++) {
      // weight vehicle count by road length so motorways get more traffic
      let pick = Math.random() * totalLen
      let road = roads[0]
      for (const r of roads) {
        pick -= r.length
        if (pick <= 0) {
          road = r
          break
        }
      }
      const v: Vehicle = {
        road,
        d: Math.random() * road.length,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: 8 + Math.random() * 14, // 30-80 km/h
      }
      this.vehicles.push(v)
      const p = pointAt(road, v.d)
      this.prims.push(
        this.points.add({
          position: Cartesian3.fromDegrees(p.lon, p.lat, 2),
          pixelSize: 3,
          color: Color.fromCssColorString('#9ccc65'),
        }),
      )
      this.labelPrims.push(
        i % LABEL_EVERY === 0
          ? this.labels.add({
              position: Cartesian3.fromDegrees(p.lon, p.lat, 6),
              text: `VEH-${1000 + Math.floor(Math.random() * 9000)}`,
              font: '9px Consolas, monospace',
              fillColor: Color.fromCssColorString('#9ccc65'),
              pixelOffset: { x: 5, y: -5 } as never,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            })
          : null,
      )
    }
    this.count = this.vehicles.length
    this.onUpdate(this.count)
    if (!this.tickRemover) {
      this.lastTick = performance.now()
      this.tickRemover = this.viewer.clock.onTick.addEventListener(() => this.tick())
    }
  }

  private tick() {
    if (!this.points.show || !this.vehicles.length) return
    const now = performance.now()
    const dt = Math.min((now - this.lastTick) / 1000, 0.5)
    this.lastTick = now
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i]
      v.d += v.speed * v.dir * dt
      if (v.d <= 0 || v.d >= v.road.length) v.dir = -v.dir as 1 | -1 // bounce at road ends
      const p = pointAt(v.road, v.d)
      const pos = Cartesian3.fromDegrees(p.lon, p.lat, 2)
      this.prims[i].position = pos
      const lbl = this.labelPrims[i]
      if (lbl) lbl.position = Cartesian3.fromDegrees(p.lon, p.lat, 6)
    }
  }

  private clear() {
    this.points.removeAll()
    this.labels.removeAll()
    this.vehicles = []
    this.prims = []
    this.labelPrims = []
    this.count = 0
  }
}
