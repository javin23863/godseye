// LIVE CCTV MESH + GROUND PROJECTION (CAP-20, AC-04). Honest MVP:
//  - a camera marker per curated public DOT still-cam (entity id `cctv-<id>`);
//  - click -> fly to a framing pose looking along the cam heading + open a PiP
//    panel showing the live snapshot (refreshes 1/min, cache-busted);
//  - COVERAGE: draw the ground footprint wedge on the terrain;
//  - ALIGN-DRAPE: toggle the wedge between OUTLINE (frustum footprint polyline)
//    and DRAPE (translucent filled footprint);
//  - pose sliders (heading/fov/range) live-update the selected cam's wedge.
//
// CEILING (not built): true projective texturing of the live frame onto the 3D
// tileset (needs a classification primitive / custom tileset shader) and PnP
// auto-calibration (B-18, author says WIP). The wedge-drape + PiP is the
// honest stand-in; the image itself always shows reliably in the PiP <img>
// (CORS-safe — no canvas readback, so no image-material drape either).
import {
  Cartesian3,
  ClassificationType,
  Color,
  CustomDataSource,
  HeadingPitchRoll,
  Math as CMath,
  Viewer,
} from 'cesium'
import { CAMS, type Cam } from './cctv-cams'
import { footprintWedge } from './cctv-geom.mjs'

const REFRESH_MS = 60_000 // stills refresh ~1/min (L-03), not real-time
const COV_COLOR = Color.fromCssColorString('#4fc3f7') // cyan, matches UI accent

interface Pose {
  heading: number
  fov: number
  range: number
}

export class CctvLayer {
  readonly ds = new CustomDataSource('cctv')
  count = 0
  selectedId: string | null = null
  private coverageShown = false
  private drape = false
  private poses = new Map<string, Pose>()
  private pip: HTMLElement | null = null
  private refreshTimer: number | null = null

  constructor(private viewer: Viewer, private onUpdate: (n: number) => void) {
    viewer.dataSources.add(this.ds)
    for (const c of CAMS) this.poses.set(c.id, { heading: c.headingDeg, fov: c.fovDeg, range: c.rangeM })
    this.render()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  private cam(id: string): Cam | undefined {
    return CAMS.find((c) => c.id === id)
  }

  /** Camera markers (coverage wedges are added/removed by setCoverage). */
  private render() {
    for (const c of CAMS) {
      this.ds.entities.add({
        id: `cctv-${c.id}`,
        position: Cartesian3.fromDegrees(c.lon, c.lat, 3),
        point: { pixelSize: 8, color: COV_COLOR, outlineColor: Color.BLACK.withAlpha(0.6), outlineWidth: 1 },
        label: {
          text: c.name,
          font: '9px Consolas, monospace',
          fillColor: COV_COLOR,
          pixelOffset: { x: 8, y: -6 } as never,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `PUBLIC DOT CCTV<br>${c.name}`,
      })
    }
    this.count = CAMS.length
    this.onUpdate(this.count)
  }

  // -- COVERAGE + ALIGN-DRAPE ------------------------------------------------
  setCoverage(on: boolean): string {
    this.coverageShown = on
    for (const c of CAMS) this.renderCoverage(c.id)
    return `CCTV: COVERAGE ${on ? 'ON' : 'OFF'}`
  }

  setDrape(on: boolean): string {
    this.drape = on
    if (this.coverageShown) for (const c of CAMS) this.renderCoverage(c.id)
    return `CCTV: ${on ? 'DRAPE (FILLED FOOTPRINT)' : 'PROJECTION (FRUSTUM OUTLINE)'}`
  }

  private renderCoverage(id: string) {
    const covId = `cov-${id}`
    const existing = this.ds.entities.getById(covId)
    if (existing) this.ds.entities.remove(existing)
    const c = this.cam(id)
    const p = this.poses.get(id)
    if (!this.coverageShown || !c || !p) return
    const flat = footprintWedge(c.lat, c.lon, p.heading, p.fov, p.range).flat()
    const positions = Cartesian3.fromDegreesArray(flat)
    if (this.drape) {
      // ponytail: translucent colour fill — draping the live IMAGE as a ground
      // material needs a CORS-enabled texture the public cams don't serve.
      this.ds.entities.add({
        id: covId,
        // classificationType BOTH drapes the fill over terrain AND 3D tiles, so it
        // doesn't sink under hilly ground the way an h=0 ellipsoid polygon would.
        polygon: { hierarchy: positions, material: COV_COLOR.withAlpha(0.22), outline: false, classificationType: ClassificationType.BOTH },
      })
    } else {
      this.ds.entities.add({
        id: covId,
        polyline: { positions, width: 2, material: COV_COLOR.withAlpha(0.9), clampToGround: true },
      })
    }
  }

  // -- selection: fly to framing pose + open PiP -----------------------------
  /** entityId is `cctv-<id>` from the global click handler. */
  select(entityId: string): string {
    const id = entityId.replace('cctv-', '')
    const c = this.cam(id)
    if (!c) return 'CCTV: UNKNOWN CAM'
    this.selectedId = id
    const p = this.poses.get(id)!
    // stand a little behind the cam and above it, looking along the heading
    const backRad = ((p.heading + 180) * Math.PI) / 180
    const mPerDegLat = 111320
    const dLat = (Math.cos(backRad) * 160) / mPerDegLat
    const dLon = (Math.sin(backRad) * 160) / (mPerDegLat * Math.cos((c.lat * Math.PI) / 180))
    this.viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(c.lon + dLon, c.lat + dLat, 110),
      orientation: new HeadingPitchRoll(CMath.toRadians(p.heading), CMath.toRadians(-22), 0),
      duration: 1.6,
    })
    this.openPip(c)
    return `CCTV: ${c.name} — LIVE SNAPSHOT (1 FRAME/MIN)`
  }

  // -- picture-in-picture snapshot panel -------------------------------------
  private openPip(c: Cam) {
    if (!this.pip) this.buildPip()
    const p = this.poses.get(c.id)!
    ;(this.pip!.querySelector('#cctv-pip-name') as HTMLElement).textContent = c.name
    const img = this.pip!.querySelector('#cctv-pip-img') as HTMLImageElement
    const fallback = this.pip!.querySelector('#cctv-pip-fallback') as HTMLElement
    const load = () => {
      img.src = c.snapshotUrl + (c.snapshotUrl.includes('?') ? '&' : '?') + 't=' + Date.now()
    }
    img.onerror = () => {
      img.style.display = 'none'
      fallback.style.display = 'flex'
    }
    img.onload = () => {
      img.style.display = 'block'
      fallback.style.display = 'none'
    }
    load()
    if (this.refreshTimer) window.clearInterval(this.refreshTimer)
    this.refreshTimer = window.setInterval(load, REFRESH_MS)
    // sync + wire the pose sliders to this cam
    this.bindSlider('heading', p.heading, c)
    this.bindSlider('fov', p.fov, c)
    this.bindSlider('range', p.range, c)
    this.pip!.style.display = 'block'
  }

  private bindSlider(key: 'heading' | 'fov' | 'range', val: number, c: Cam) {
    const slider = this.pip!.querySelector(`#cctv-slider-${key}`) as HTMLInputElement
    const out = this.pip!.querySelector(`#cctv-val-${key}`) as HTMLElement
    slider.value = String(Math.round(val))
    out.textContent = String(Math.round(val))
    slider.oninput = () => {
      const n = Number(slider.value)
      out.textContent = String(n)
      this.poses.get(c.id)![key] = n
      this.renderCoverage(c.id)
    }
  }

  private buildPip() {
    const el = document.createElement('div')
    el.id = 'cctv-pip'
    el.innerHTML = `
      <div id="cctv-pip-head">
        <span id="cctv-pip-name">CCTV</span>
        <button id="cctv-pip-close" title="close">&times;</button>
      </div>
      <div id="cctv-pip-view">
        <img id="cctv-pip-img" alt="cctv snapshot" />
        <div id="cctv-pip-fallback">CAM OFFLINE<br><small>SNAPSHOT UNAVAILABLE</small></div>
      </div>
      <div id="cctv-pip-pose">
        <label>HDG <input type="range" id="cctv-slider-heading" min="0" max="359" /> <span id="cctv-val-heading">0</span>&deg;</label>
        <label>FOV <input type="range" id="cctv-slider-fov" min="10" max="140" /> <span id="cctv-val-fov">0</span>&deg;</label>
        <label>RNG <input type="range" id="cctv-slider-range" min="50" max="1500" step="10" /> <span id="cctv-val-range">0</span>m</label>
        <div id="cctv-pip-note">MANUAL CAL &middot; AUTO-CAL WIP</div>
      </div>
    `
    document.body.appendChild(el)
    ;(el.querySelector('#cctv-pip-close') as HTMLButtonElement).onclick = () => this.closePip()
    this.pip = el
  }

  private closePip() {
    if (this.refreshTimer) window.clearInterval(this.refreshTimer)
    this.refreshTimer = null
    this.selectedId = null
    if (this.pip) this.pip.style.display = 'none'
  }
}
