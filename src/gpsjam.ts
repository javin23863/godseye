// GPS-jamming layer (CAP-21, improvement B-06): gpsjam.org method — aggregate
// aircraft nav-integrity (NIC/NACp) broadcasts from airplanes.live into a grid,
// flag cells dense with low-integrity reports as an active jamming cell.
// On-demand SCAN VIEW, single-shot per activation (Overpass/traffic-style budget).
// ponytail: lat/lon square grid, not H3 hexagons — swap binIntegrity's cell math
// if hex tiling is ever required.
// ponytail: one-shot scan, no temporal evolution across 4D playback (CAP-21 wants
// intensity that evolves with the timeline) — wire into recorder + playhead render
// when the playback pass reaches this layer, same pattern as ships/darkvessel.
import { Color, CustomDataSource, Math as CMath, Rectangle, Viewer } from 'cesium'
import { binIntegrity } from './gpsjam-bin.mjs'

const POINT_URL = 'https://api.airplanes.live/v2/point'
const DEFAULT_CENTER = { lat: 26.5, lon: 56.3 } // Strait of Hormuz — app default theater
const DEFAULT_RADIUS_NM = 250
const CELL_DEG = 0.25

interface Report {
  lat: number
  lon: number
  nic?: number
  nac_p?: number
}

export class GpsJamLayer {
  readonly ds = new CustomDataSource('gpsjam')
  count = 0
  busy = false

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  async scan(): Promise<string> {
    if (this.busy) return 'GPS JAM: BUSY'
    this.busy = true
    try {
      const { lat, lon, radiusNm } = this.viewCenter()
      const res = await fetch(`${POINT_URL}/${lat}/${lon}/${radiusNm}`)
      if (!res.ok) throw new Error(`airplanes.live ${res.status}`)
      const body = (await res.json()) as { ac?: Report[] }
      const reports = body.ac ?? []
      const cells = binIntegrity(reports, CELL_DEG)
      this.render(cells)
      const low = cells.reduce((a, c) => a + c.low, 0)
      return cells.length
        ? `GPS JAM: ${cells.length} CELLS FROM ${reports.length} AIRCRAFT (${low} LOW-INTEGRITY)`
        : `GPS JAM: NO DEGRADED CLUSTERS IN VIEW (${reports.length} AIRCRAFT)`
    } catch (err) {
      console.warn('gpsjam scan failed:', err)
      return 'GPS JAM: FEED UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  /** Center + radius covering the current camera view; falls back to the Hormuz default. */
  private viewCenter(): { lat: number; lon: number; radiusNm: number } {
    const rect = this.viewer.camera.computeViewRectangle()
    if (rect) {
      const c = Rectangle.center(rect)
      const lat = CMath.toDegrees(c.latitude)
      const lon = CMath.toDegrees(c.longitude)
      const spanDeg = Math.max(CMath.toDegrees(rect.north - rect.south), CMath.toDegrees(rect.east - rect.west))
      const radiusNm = Math.min(Math.max((spanDeg * 60) / 2, 20), 250) // ~60nm/deg, clamp to API max
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, radiusNm }
    }
    return { ...DEFAULT_CENTER, radiusNm: DEFAULT_RADIUS_NM }
  }

  private render(cells: ReturnType<typeof binIntegrity>) {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    cells.forEach((c, i) => {
      this.ds.entities.add({
        id: `jam-${i}`,
        rectangle: {
          coordinates: Rectangle.fromDegrees(c.lon, c.lat, c.lon + CELL_DEG, c.lat + CELL_DEG),
          material: Color.RED.withAlpha(0.25 + 0.5 * c.frac),
          height: 0,
        },
        description: `GPS jamming cell<br>${c.low}/${c.total} low-integrity (${Math.round(c.frac * 100)}%)`,
      })
    })
    this.count = cells.length
    this.onUpdate(this.count)
  }

  clear() {
    this.ds.entities.removeAll()
    this.count = 0
    this.onUpdate(0)
  }
}
