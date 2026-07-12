// GPS-jamming layer (CAP-21, improvement B-06): gpsjam.org method — aggregate
// aircraft nav-integrity (NIC/NACp) broadcasts from airplanes.live into a grid,
// flag cells dense with low-integrity reports as an active jamming cell.
// On-demand SCAN VIEW, single-shot per activation (Overpass/traffic-style budget).
// ponytail: lat/lon square grid, not H3 hexagons — swap binIntegrity's cell math
// if hex tiling is ever required.
// Temporal (CAP-21): each scan records its cells (record-first, STK-10) and the 4D
// playhead replays them via renderItems — same pattern as ships/darkvessel. AUTO-SCAN
// opts into periodic sampling so the archive accumulates evolution (off by default,
// since every scan spends one airplanes.live point query = budget-safe).
import { Color, CustomDataSource, Math as CMath, Rectangle, Viewer } from 'cesium'
import { binIntegrity } from './gpsjam-bin.mjs'
import { record } from './recorder'

const POINT_URL = 'https://api.airplanes.live/v2/point'
const DEFAULT_CENTER = { lat: 26.5, lon: 56.3 } // Strait of Hormuz — app default theater
const DEFAULT_RADIUS_NM = 250
const CELL_DEG = 0.25
const AUTO_MS = 180_000 // auto-scan cadence (3 min) — one point query per tick, so opt-in only

interface Report {
  lat: number
  lon: number
  nic?: number
  nac_p?: number
}

type Cell = ReturnType<typeof binIntegrity>[number]

export class GpsJamLayer {
  readonly ds = new CustomDataSource('gpsjam')
  count = 0
  busy = false
  playback = false // playhead owns the draw while replaying; live scans record but don't paint
  private autoTimer: number | null = null

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
      void record('gpsjam', cells) // record-first (STK-10): the 4D timeline replays jam evolution
      if (!this.playback) this.draw(cells) // during playback the playhead owns the draw
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

  /** Playback: redraw recorded jam cells at the playhead instant (same seam as ships/darkvessel). */
  renderItems(cells: Cell[]) {
    this.draw(cells)
  }

  /** Opt-in periodic re-scan so the 4D archive accumulates jam evolution. Off by default —
   *  each tick spends one airplanes.live point query, so this is never a silent background poll. */
  setAuto(on: boolean): string {
    if (this.autoTimer) {
      window.clearInterval(this.autoTimer)
      this.autoTimer = null
    }
    if (on)
      this.autoTimer = window.setInterval(() => {
        if (this.shown && !this.busy) void this.scan()
      }, AUTO_MS)
    return `GPS JAM: AUTO-SCAN ${on ? `ON (EVERY ${AUTO_MS / 60_000}M)` : 'OFF'}`
  }

  private draw(cells: Cell[]) {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    cells.forEach((c, i) => {
      const sev = Color.lerp(Color.YELLOW, Color.RED, c.frac, new Color()) // severity ramp
      this.ds.entities.add({
        id: `jam-${i}`,
        rectangle: {
          coordinates: Rectangle.fromDegrees(c.lon, c.lat, c.lon + CELL_DEG, c.lat + CELL_DEG),
          material: sev.withAlpha(0.25 + 0.4 * c.frac),
          height: 0,
          extrudedHeight: 3_000 + 45_000 * c.frac, // prism height = severity, reads on the 4D timeline
          outline: true,
          outlineColor: sev.withAlpha(0.8),
        },
        description: `GPS jamming cell<br>${c.low}/${c.total} low-integrity (${Math.round(c.frac * 100)}%)`,
      })
    })
    this.ds.entities.resumeEvents()
    this.count = cells.length
    this.onUpdate(this.count)
  }

  /** Playback exit calls refresh() to snap every layer back to live. GPS-jam is on-demand
   *  (no live poll to restore), so "live" = blank — clear the stranded historical frame the
   *  playhead left painted, rather than pass an old scan off as current. */
  refresh() {
    this.clear()
  }

  clear() {
    this.ds.entities.removeAll()
    this.count = 0
    this.onUpdate(0)
  }
}
