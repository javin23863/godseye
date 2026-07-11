// Chokepoint gate crossing analytics (CAP-15) — the "crossings dropped 92%" analysis.
// A gate is a line across a waterway; on demand we replay the last 24h of recorded AIS
// ship snapshots, rebuild each vessel's track, and tally how many transited IN vs OUT.
// Pure geometry lives in ./gate-geom.mjs (headless-tested); this file is the Cesium/DOM shell.
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'
import { detectCrossings } from './gate-geom.mjs'
import { snapshotsInRange } from './recorder'
import type { Ship } from './ships'

const AMBER = Color.fromCssColorString('#ffb74d')
const WINDOW_MS = 24 * 60 * 60_000

interface Pt {
  lon: number
  lat: number
  at?: number
}
interface Gate {
  a: Pt
  b: Pt
}

// Preset gate across the Strait of Hormuz: NW end -> SE end. IN = toward the Persian Gulf.
const HORMUZ: Gate = { a: { lon: 56.5, lat: 26.6 }, b: { lon: 56.9, lat: 26.3 } }

export class GateLayer {
  readonly ds = new CustomDataSource('hormuz-gate')
  private gate: Gate = HORMUZ
  private panel: HTMLElement
  private pending: Pt[] = [] // click-to-set buffer
  private clickHandler: ScreenSpaceEventHandler | null = null
  count = 0
  readout = 'GATE: NOT RUN'

  constructor(private viewer: Viewer) {
    viewer.dataSources.add(this.ds)
    this.ds.show = false // onDemand: hidden until analyzed
    this.panel = document.createElement('div')
    this.panel.id = 'gate-panel'
    this.panel.hidden = true
    document.body.appendChild(this.panel)
    this.drawGate()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
    this.panel.hidden = !v || this.count === 0
  }

  /** Replay recorded ship snapshots over the last 24h and tally IN/OUT/NET. */
  async analyze(): Promise<string> {
    const now = Date.now()
    const snaps = await snapshotsInRange('ships', now - WINDOW_MS, now)
    if (!snaps.length) {
      this.readout = 'GATE: NO RECORDED SHIP DATA — LEAVE THE TAB OPEN TO RECORD'
      return this.readout
    }
    // rebuild per-MMSI chronological tracks (snapshots already come back in time order)
    const tracks = new Map<number, Pt[]>()
    for (const snap of snaps) {
      for (const s of snap.items as Ship[]) {
        let t = tracks.get(s.mmsi)
        if (!t) tracks.set(s.mmsi, (t = []))
        t.push({ lon: s.lon, lat: s.lat, at: s.at })
      }
    }
    const crossings = detectCrossings(this.gate, tracks)
    const inN = crossings.filter((c) => c.dir === 'IN').length
    const outN = crossings.length - inN
    this.renderPanel(inN, outN, tracks.size)
    this.ds.show = true
    this.panel.hidden = false
    this.count = crossings.length
    this.readout = `HORMUZ GATE · ${tracks.size} VESSELS · IN ${inN} · OUT ${outN} · NET ${inN - outN}`
    return this.readout
  }

  private renderPanel(inN: number, outN: number, vessels: number) {
    this.panel.innerHTML =
      `<h3>HORMUZ GATE</h3>` +
      `<div class="row"><span>IN</span><b class="in">${inN}</b></div>` +
      `<div class="row"><span>OUT</span><b class="out">${outN}</b></div>` +
      `<div class="row net"><span>NET</span><b>${inN - outN >= 0 ? '+' : ''}${inN - outN}</b></div>` +
      `<div class="sub">${vessels} VESSELS · 24H</div>`
  }

  private drawGate() {
    this.ds.entities.removeAll()
    const { a, b } = this.gate
    this.ds.entities.add({
      id: 'hormuz-gate-line',
      polyline: {
        positions: [Cartesian3.fromDegrees(a.lon, a.lat), Cartesian3.fromDegrees(b.lon, b.lat)],
        width: 2,
        material: AMBER,
      },
    })
    this.ds.entities.add({
      id: 'hormuz-gate-label',
      position: Cartesian3.fromDegrees((a.lon + b.lon) / 2, (a.lat + b.lat) / 2),
      label: {
        text: 'GATE',
        font: '9px Consolas, monospace',
        fillColor: AMBER,
        pixelOffset: new Cartesian2(0, -10),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  /** Optional: arm two clicks to redefine the gate; re-run analyze() to re-tally. */
  armSetGate(onStatus: (t: string) => void) {
    this.pending = []
    onStatus('GATE: CLICK TWO POINTS TO SET')
    // ponytail: own handler on the same canvas; the app's main click handler also fires,
    // harmless here (empty-space clicks). Torn down after the 2nd point.
    this.clickHandler?.destroy()
    const h = new ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.clickHandler = h
    h.setInputAction((e: { position: Cartesian2 }) => {
      const carto = this.viewer.camera.pickEllipsoid(e.position)
      if (!carto) return
      const c = this.viewer.scene.globe.ellipsoid.cartesianToCartographic(carto)
      const p: Pt = {
        lon: (c.longitude * 180) / Math.PI,
        lat: (c.latitude * 180) / Math.PI,
      }
      this.pending.push(p)
      if (this.pending.length === 2) {
        this.gate = { a: this.pending[0], b: this.pending[1] }
        this.drawGate()
        h.destroy()
        this.clickHandler = null
        onStatus('GATE SET — SCAN 24H TO RE-TALLY')
      }
    }, ScreenSpaceEventType.LEFT_CLICK)
  }
}
