// AIS vessel layer (CAP-13, DS-05): aisstream.io WebSocket, bbox-subscribed.
// Realtime-only feed (zero backfill) -> every position lands in the recorder so
// playback/gate analytics have history from the moment the tab opens (STK-10).
// Default theater: Persian Gulf / Strait of Hormuz (the source videos' stage).
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  Math as CMath,
  NearFarScalar,
  PolylineGlowMaterialProperty,
  Viewer,
} from 'cesium'
import { record } from './recorder'

// White hull pointing north; billboard `color` tints moving vs anchored.
const HULL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
  '<path fill="#fff" d="M12 1l5 7v13q-5 3-10 0V8z"/></svg>'
const HULL_URI = 'data:image/svg+xml,' + encodeURIComponent(HULL_SVG)
const TRAIL_LEN = 20 // fixes per moving ship (~100 s at the 5 s render tick)

const WS_URL = 'wss://stream.aisstream.io/v0/stream'
const KEY = import.meta.env.VITE_AISSTREAM_KEY as string | undefined
const STALE_MS = 15 * 60_000
const SNAPSHOT_MS = 30_000
// s,w,n,e — NW Europe / English Channel / North Sea: the densest reliable coverage in
// aisstream's crowd-sourced feed (the source-video Persian Gulf theater has little to no
// receiver coverage). SUBSCRIBE VIEW re-subscribes to wherever the camera is pointed.
const DEFAULT_BBOX: [number, number, number, number] = [48, -6, 54, 9]

export interface Ship {
  mmsi: number
  name: string
  lat: number
  lon: number
  sog: number // knots
  cog: number // degrees
  heading: number
  at: number
}

export class ShipLayer {
  readonly ds = new CustomDataSource('ships')
  count = 0
  playback = false
  readonly enabled = !!KEY
  private ships = new Map<number, Ship>()
  private ws: WebSocket | null = null
  private bbox = DEFAULT_BBOX
  private reconnectDelay = 2_000

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
    if (!this.enabled) return
    this.connect()
    window.setInterval(() => this.render(), 5_000)
    window.setInterval(() => {
      if (this.ships.size) void record('ships', [...this.ships.values()])
    }, SNAPSHOT_MS)
  }

  /** Re-subscribe to the current camera view (falls back to Gulf default when zoomed out). */
  subscribeView(): string {
    if (!this.enabled) return 'SHIPS: NO VITE_AISSTREAM_KEY'
    const rect = this.viewer.camera.computeViewRectangle()
    if (rect) {
      const s = CMath.toDegrees(rect.south)
      const w = CMath.toDegrees(rect.west)
      const n = CMath.toDegrees(rect.north)
      const e = CMath.toDegrees(rect.east)
      if (n - s < 40 && e - w < 40) this.bbox = [s, w, n, e]
      else this.bbox = DEFAULT_BBOX
    }
    this.ships.clear()
    this.render()
    this.ws?.close() // onclose reconnects with the new bbox
    return `SHIPS: SUBSCRIBED ${this.bbox.map((x) => x.toFixed(1)).join(',')}`
  }

  private connect() {
    const ws = new WebSocket(WS_URL)
    this.ws = ws
    ws.onopen = () => {
      this.reconnectDelay = 2_000
      const [s, w, n, e] = this.bbox
      // no message-type filter: Class-A (PositionReport) and Class-B
      // (StandardClassBPositionReport) both carry position; we read lat/lon from MetaData.
      ws.send(
        JSON.stringify({
          APIKey: KEY,
          BoundingBoxes: [
            [
              [s, w],
              [n, e],
            ],
          ],
        }),
      )
    }
    ws.onmessage = async (ev) => {
      try {
        // aisstream frames arrive as Blob in the browser (string only under node's ws lib)
        const raw: string = typeof ev.data === 'string' ? ev.data : await (ev.data as Blob).text()
        type PosRep = { Sog?: number; Cog?: number; TrueHeading?: number }
        const m = JSON.parse(raw) as {
          MetaData?: { MMSI: number; ShipName?: string; latitude: number; longitude: number }
          Message?: { PositionReport?: PosRep; StandardClassBPositionReport?: PosRep }
        }
        if (!m.MetaData || !Number.isFinite(m.MetaData.latitude)) return
        const pr = m.Message?.PositionReport ?? m.Message?.StandardClassBPositionReport
        const heading = pr?.TrueHeading != null && pr.TrueHeading < 360 ? pr.TrueHeading : pr?.Cog ?? 0
        this.ships.set(m.MetaData.MMSI, {
          mmsi: m.MetaData.MMSI,
          name: (m.MetaData.ShipName ?? '').trim() || `MMSI ${m.MetaData.MMSI}`,
          lat: m.MetaData.latitude,
          lon: m.MetaData.longitude,
          sog: pr?.Sog ?? 0,
          cog: pr?.Cog ?? 0,
          heading,
          at: Date.now(),
        })
      } catch {} // malformed frames: drop, stream continues
    }
    ws.onclose = () => {
      window.setTimeout(() => this.connect(), this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000) // backoff, feed is free-tier
    }
    ws.onerror = () => ws.close()
  }

  private render() {
    if (this.playback) return
    const cutoff = Date.now() - STALE_MS
    for (const [mmsi, s] of this.ships) if (s.at < cutoff) this.ships.delete(mmsi)
    this.renderItems([...this.ships.values()])
  }

  // wake trails: last rendered fixes per moving ship (playback frames grow trails too)
  private history = new Map<number, Cartesian3[]>()

  renderItems(ships: Ship[]) {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    const seen = new Set<number>()
    for (const s of ships) {
      const pos = Cartesian3.fromDegrees(s.lon, s.lat)
      const moving = s.sog > 0.5
      if (moving) {
        seen.add(s.mmsi)
        const h = this.history.get(s.mmsi) ?? []
        h.push(pos)
        if (h.length > TRAIL_LEN) h.shift()
        this.history.set(s.mmsi, h)
        if (h.length >= 2)
          this.ds.entities.add({
            id: `ship-${s.mmsi}-trail`,
            polyline: {
              positions: [...h],
              width: 5,
              material: new PolylineGlowMaterialProperty({ glowPower: 0.2, color: Color.SPRINGGREEN.withAlpha(0.6) }),
            },
          })
      }
      this.ds.entities.add({
        id: `ship-${s.mmsi}`,
        position: pos,
        billboard: {
          image: HULL_URI,
          color: moving ? Color.SPRINGGREEN : Color.LIGHTSLATEGRAY, // moving vs anchored/parked
          width: 13,
          height: 13,
          rotation: CMath.toRadians(-s.heading),
          alignedAxis: Cartesian3.UNIT_Z,
          scaleByDistance: new NearFarScalar(5e3, 1.2, 3e6, 0.5),
        },
        label: {
          text: s.name,
          font: '9px Consolas, monospace',
          fillColor: Color.SPRINGGREEN,
          pixelOffset: new Cartesian2(6, -6),
          distanceDisplayCondition: new DistanceDisplayCondition(0, 900_000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `${s.name} · MMSI ${s.mmsi}<br>SOG ${s.sog.toFixed(1)} kn · COG ${s.cog.toFixed(0)}° · HDG ${s.heading}°<br>${new Date(s.at).toISOString()}`,
      })
    }
    for (const k of this.history.keys()) if (!seen.has(k)) this.history.delete(k) // stale/anchored -> drop wake
    this.ds.entities.resumeEvents()
    this.count = ships.length
    this.onUpdate(this.count)
  }

  /** Click dossier line (CAP-13 minimal; registry join is M6). */
  dossier(entityId: string): string | null {
    const mmsi = Number(entityId.replace('ship-', ''))
    const s = this.ships.get(mmsi)
    if (!s) return null
    return `${s.name} · MMSI ${s.mmsi} · SOG ${s.sog.toFixed(1)}KN · COG ${Math.round(s.cog)}° · ${s.sog > 0.5 ? 'UNDERWAY' : 'STATIONARY'}`
  }
}
