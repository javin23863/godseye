// Cross-layer fusion layer (CAP-22 payoff): the OSINT differentiator. On a 'SCAN FUSION'
// action it gathers recent events from every INT source — dark-vessel AIS-loss points,
// GPS-jam cells, military aircraft positions, and earthquakes — normalizes each to a
// {layer,lat,lon,at,label} event, runs the pure space-time clustering in fusion-core.mjs,
// and paints a pulsing composite marker wherever >=2 DISTINCT layers overlap. Clicking a
// composite flies to it and asks the LLM why co-located signals of those kinds matter.
// Clustering + scoring is headless (fusion-core.mjs); this file is only Cesium + wiring.
import { Cartesian2, Cartesian3, CallbackProperty, Color, CustomDataSource, Viewer } from 'cesium'
import { findComposites } from './fusion-core.mjs'
import { snapshotsInRange } from './recorder'
import { llmAsk } from './llm'
import type { Aircraft } from './aircraft'
import type { Quake } from './quakes'
import type { DarkVesselLayer } from './darkvessel'

const WINDOW_MS = 6 * 3_600_000 // how far back to reach for each source's latest frame
const RADIUS_KM = 50 // co-location radius fed to findComposites
const WINDOW_MIN = 180 // co-location window (min) — wide enough that a dark loss earlier in
// the 6h archive still fuses with the current jam/military frame; narrow it for tighter joins
const CELL_HALF = 0.125 // gpsjam CELL_DEG (0.25) / 2 — bins store the SW corner, centre them

interface FusionEvent {
  layer: string
  lat: number
  lon: number
  at: number
  weight?: number
  label?: string
}
interface Composite {
  lat: number
  lon: number
  at: number
  layers: string[]
  members: FusionEvent[]
  score: number
}
interface JamCell {
  lat: number
  lon: number
  low: number
  total: number
  frac: number
}

export class FusionLayer {
  readonly ds = new CustomDataSource('fusion')
  count = 0
  private byId = new Map<string, Composite>()

  constructor(
    private viewer: Viewer,
    private onUpdate: (count: number) => void,
    private onStatus: (text: string) => void,
    private listEl: HTMLElement,
    private darkvessel: DarkVesselLayer,
  ) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Gather the picture, correlate, render, return a status line. */
  async scan(): Promise<string> {
    const events = await this.gather()
    if (events.length < 2) {
      this.render([])
      return 'FUSION: NOT ENOUGH LAYER ACTIVITY YET (ENABLE LAYERS · SCAN DARK/JAM FIRST)'
    }
    const composites = findComposites(events, { radiusKm: RADIUS_KM, windowMin: WINDOW_MIN }) as Composite[]
    this.render(composites)
    const layerCount = new Set(events.map((e) => e.layer)).size
    return composites.length
      ? `FUSION: ${composites.length} COMPOSITE${composites.length > 1 ? 'S' : ''} FROM ${events.length} SIGNALS ACROSS ${layerCount} LAYERS`
      : `FUSION: NO CO-LOCATED MULTI-INT EVENTS (${events.length} SIGNALS, NONE OVERLAP)`
  }

  /** Normalize the latest recorded frame of each source + dark-vessel loss points to events. */
  private async gather(): Promise<FusionEvent[]> {
    const now = Date.now()
    const from = now - WINDOW_MS
    const events: FusionEvent[] = []

    // military aircraft — latest recorded frame (positions of interest for co-location)
    const milSnap = (await snapshotsInRange('military', from, now)).at(-1)
    if (milSnap)
      for (const a of milSnap.items as Aircraft[])
        events.push({ layer: 'military', lat: a.lat, lon: a.lon, at: milSnap.at, label: a.callsign })

    // earthquakes — latest frame, keyed on each quake's own time; bigger quakes weigh more
    const qkSnap = (await snapshotsInRange('earthquakes', from, now)).at(-1)
    if (qkSnap)
      for (const q of qkSnap.items as Quake[])
        events.push({
          layer: 'quake',
          lat: q.lat,
          lon: q.lon,
          at: q.time,
          weight: 1 + Math.max(0, q.mag) / 3,
          label: `M${q.mag}`,
        })

    // gps-jam cells — latest frame, cell centre; denser jam weighs more
    const jamSnap = (await snapshotsInRange('gpsjam', from, now)).at(-1)
    if (jamSnap)
      for (const c of jamSnap.items as JamCell[])
        events.push({
          layer: 'gpsjam',
          lat: c.lat + CELL_HALF,
          lon: c.lon + CELL_HALF,
          at: jamSnap.at,
          weight: 1 + c.frac,
          label: `${c.low}/${c.total} LOW-INT`,
        })

    // dark-vessel loss points — from the darkvessel layer's last scan (already computed)
    for (const e of this.darkvessel.events)
      events.push({ layer: 'dark', lat: e.lastSeen.lat, lon: e.lastSeen.lon, at: e.lastSeen.at, weight: 1.5, label: e.name })

    return events
  }

  private render(composites: Composite[]) {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    this.byId.clear()
    composites.forEach((c, i) => {
      const id = `fx-${i}`
      this.byId.set(id, c)
      this.ds.entities.add({
        id,
        position: Cartesian3.fromDegrees(c.lon, c.lat),
        // ponytail: sine-driven pixelSize for the pulse; the viewer renders continuously
        // (no requestRenderMode), so a CallbackProperty animates without a clock tick.
        point: {
          pixelSize: new CallbackProperty(() => 12 + 5 * Math.sin(Date.now() / 250), false),
          color: Color.fromCssColorString('#ffab40').withAlpha(0.85),
          outlineColor: Color.fromCssColorString('#4fc3f7'),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `⊕ ${c.layers.join('+').toUpperCase()}`,
          font: '10px Consolas, monospace',
          fillColor: Color.fromCssColorString('#ffab40'),
          pixelOffset: new Cartesian2(10, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `COMPOSITE · ${c.members.length} signals across ${c.layers.length} layers<br>${c.layers.join(' + ')}<br>SCORE ${c.score}`,
      })
    })
    this.ds.entities.resumeEvents()
    this.count = composites.length
    this.onUpdate(this.count)
    this.renderList(composites)
  }

  /** Side list: one clickable row per composite, flies to it and explains it. */
  private renderList(composites: Composite[]) {
    const el = this.listEl
    el.innerHTML = ''
    if (!composites.length) {
      el.textContent = 'NO COMPOSITES'
      return
    }
    composites.forEach((c, i) => {
      const row = document.createElement('button')
      row.className = 'fusion-row'
      row.textContent = `${c.layers.join('+').toUpperCase()} · ${c.members.length} SIG · SCORE ${c.score}`
      row.onclick = () => this.onStatus(this.select(`fx-${i}`))
      el.appendChild(row)
    })
  }

  /** Fly to a composite + kick off the LLM "why it matters" explanation. Sync-returns an
   *  immediate line so the LEFT_CLICK handler can display it; the LLM line lands via onStatus. */
  select(id: string): string {
    const c = this.byId.get(id)
    if (!c) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(c.lon, c.lat, 80_000) })
    void this.explain(c)
    return `FUSION: ${c.layers.join(' + ').toUpperCase()} CO-LOCATED · SCORE ${c.score}`
  }

  private async explain(c: Composite) {
    const ans = await llmAsk(
      `Why does it matter that these co-located OSINT signals appear within ${RADIUS_KM}km of each other: ${c.layers.join(', ')}? One short line.`,
      `Composite at ${c.lat.toFixed(2)},${c.lon.toFixed(2)}; layers ${c.layers.join('+')}; ${c.members.length} signals.`,
    )
    if (ans) this.onStatus(ans)
  }
}
