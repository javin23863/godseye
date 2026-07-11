// Dark-vessel detection layer (CAP-14): the headline maritime capability from the source
// videos — vessels that turn off AIS to run a chokepoint. On a 'SCAN DARK' action it reads
// the last 6h of recorded 'ships' snapshots, runs the pure gap analysis, and draws each
// AIS-loss -> reappearance pair on the globe. Detection logic lives in darkvessel-detect.mjs
// (headless, node --test'able); this file is only Cesium rendering + wiring.
import { Cartesian2, Cartesian3, Color, CustomDataSource, Viewer } from 'cesium'
import { snapshotsInRange } from './recorder'
import type { Ship } from './ships'
import { detectDarkEvents } from './darkvessel-detect.mjs'

const WINDOW_MS = 6 * 3_600_000
const GAP_MIN = 20

export interface Fix {
  lat: number
  lon: number
  at: number
}
export interface DarkEvent {
  mmsi: number
  name: string
  lastSeen: Fix
  seenAgain: Fix | null
  gapMin: number
}

export class DarkVesselLayer {
  readonly ds = new CustomDataSource('dark-vessels')
  events: DarkEvent[] = []
  count = 0

  constructor(
    private viewer: Viewer,
    private onUpdate: (count: number) => void,
    private listEl?: HTMLElement,
  ) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Read recorded ship history, detect dark events, render, return a status line. */
  async scan(): Promise<string> {
    const now = Date.now()
    const snaps = await snapshotsInRange('ships', now - WINDOW_MS, now)
    if (snaps.length < 2) {
      this.events = []
      this.render()
      return 'DARK VESSELS: NO SHIP HISTORY YET (ENABLE SHIPS + WAIT)'
    }
    this.events = detectDarkEvents(
      snaps.map((s) => ({ at: s.at, items: s.items as Ship[] })),
      GAP_MIN,
    ) as DarkEvent[]
    this.render()
    return this.readout()
  }

  readout(): string {
    return `DARK VESSELS: ${this.events.length} EVENTS`
  }

  private render() {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    for (const e of this.events) {
      const lost = Cartesian3.fromDegrees(e.lastSeen.lon, e.lastSeen.lat)
      this.ds.entities.add({
        id: `dark-lost-${e.mmsi}-${e.lastSeen.at}`,
        position: lost,
        // ponytail: hollow red point as the "dashed/lost" marker — a true dashed outline
        // needs PolylineDashMaterialProperty, which isn't in the layer's import seam.
        point: {
          pixelSize: 7,
          color: Color.TRANSPARENT,
          outlineColor: Color.RED,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `AIS LOST · ${e.name}`,
          font: '9px Consolas, monospace',
          fillColor: Color.RED,
          pixelOffset: new Cartesian2(8, -8),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `${e.name} · MMSI ${e.mmsi}<br>AIS LOST ${new Date(e.lastSeen.at).toISOString()}<br>GAP ${e.gapMin} MIN${e.seenAgain ? '' : ' · STILL DARK'}`,
      })
      if (e.seenAgain) {
        const again = Cartesian3.fromDegrees(e.seenAgain.lon, e.seenAgain.lat)
        this.ds.entities.add({
          id: `dark-again-${e.mmsi}-${e.lastSeen.at}`,
          position: again,
          point: {
            pixelSize: 6,
            color: Color.fromCssColorString('#9ccc65'),
            outlineColor: Color.BLACK.withAlpha(0.5),
            outlineWidth: 1,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: 'SEEN AGAIN',
            font: '9px Consolas, monospace',
            fillColor: Color.fromCssColorString('#9ccc65'),
            pixelOffset: new Cartesian2(8, -8),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        })
        this.ds.entities.add({
          id: `dark-line-${e.mmsi}-${e.lastSeen.at}`,
          polyline: { positions: [lost, again], width: 1, material: Color.RED.withAlpha(0.35) },
        })
      }
    }
    this.ds.entities.resumeEvents()
    this.count = this.events.length
    this.onUpdate(this.count)
    this.renderList()
  }

  /** Side list: one clickable row per event, flies the camera to the AIS-loss point. */
  private renderList() {
    const el = this.listEl
    if (!el) return
    el.innerHTML = ''
    if (!this.events.length) {
      el.textContent = 'NO DARK EVENTS'
      return
    }
    for (const e of this.events) {
      const row = document.createElement('button')
      row.className = 'dark-row'
      row.textContent = `${e.mmsi} · ${e.name} · ${e.gapMin}M · ${e.seenAgain ? 'RETURNED' : 'DARK'}`
      row.onclick = () =>
        this.viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(e.lastSeen.lon, e.lastSeen.lat, 60_000),
        })
      el.appendChild(row)
    }
  }
}
