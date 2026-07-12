// Tripwires + sentinel (the "watchstander" headline): arm an AOI + a condition; on a ~20s
// timer the app folds the latest recorded snapshot of every live layer into an EvalContext,
// runs the CAP-22 rules engine, and on any rising-edge fire raises a desktop notification,
// flies the camera to the AOI, and captions it. Pure ctx-folding + preset->condition logic
// lives in ./tripwire-core.mjs (headless-tested); this file is the Cesium/DOM shell only.
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Viewer,
} from 'cesium'
import { RuleEngine, type FiredRule, type Rule } from './rules'
import { haversineKm } from './rules-eval.mjs'
import { snapshotsAt, snapshotsInRange } from './recorder'
import { detectDarkEvents } from './darkvessel-detect.mjs'
import type { Ship } from './ships'
import { buildCtxFromSnapshots, presetCondition, tripwireName, TRIPWIRE_PRESETS, DARK_LAYER } from './tripwire-core.mjs'

const CYAN = Color.fromCssColorString('#4fc3f7')
const RED = Color.fromCssColorString('#ff5252')
const EVAL_MS = 20_000 // sentinel cadence
const CTX_LAYERS = ['military', 'flights', 'earthquakes', 'ships', 'gpsjam'] // recorded feeds folded into ctx
const DARK_WINDOW_MS = 6 * 3_600_000 // matches DarkVesselLayer
const DARK_GAP_MIN = 20

interface Pt {
  lat: number
  lon: number
}
type Aoi = { lat: number; lon: number; radiusKm: number }

export class TripwireLayer {
  readonly ds = new CustomDataSource('tripwires')
  private engine = new RuleEngine()
  private armed: Aoi | null = null // AOI staged by ARM, consumed by ADD
  private fired = new Set<string>() // rule ids that have tripped (paints the ring red)
  private pending: Pt[] = [] // 2-click arm buffer
  private clickHandler: ScreenSpaceEventHandler | null = null
  private seq = 0
  count = 0

  constructor(
    private viewer: Viewer,
    private onStatus: (t: string) => void,
    private onCount: (n: number) => void,
    private listEl: HTMLElement,
  ) {
    viewer.dataSources.add(this.ds)
    this.engine.onFire((f) => this.handleFire(f))
    // Ask once so the very first trip can actually pop a toast (Electron renderer supports it).
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    // The sentinel watches whenever rules are armed — independent of the layer's show toggle,
    // which only hides the rings. That's the whole point: arm it and walk away.
    window.setInterval(() => void this.tick(), EVAL_MS)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** ARM AOI (2 CLICKS): first click = center, second = radius edge — mirrors gate.armSetGate. */
  armAoi(onStatus: (t: string) => void) {
    this.pending = []
    onStatus('TRIPWIRE: CLICK AOI CENTER, THEN AN EDGE POINT')
    this.clickHandler?.destroy()
    const h = new ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.clickHandler = h
    h.setInputAction((e: { position: Cartesian2 }) => {
      const carto = this.viewer.camera.pickEllipsoid(e.position)
      if (!carto) return
      const c = this.viewer.scene.globe.ellipsoid.cartesianToCartographic(carto)
      this.pending.push({ lon: (c.longitude * 180) / Math.PI, lat: (c.latitude * 180) / Math.PI })
      if (this.pending.length === 2) {
        const [center, edge] = this.pending
        const radiusKm = Math.max(haversineKm(center.lat, center.lon, edge.lat, edge.lon), 1)
        this.armed = { lat: center.lat, lon: center.lon, radiusKm }
        this.drawPreview()
        h.destroy()
        this.clickHandler = null
        onStatus(`TRIPWIRE: AOI ARMED r=${radiusKm.toFixed(0)}KM — PICK A CONDITION + ADD TRIPWIRE`)
      }
    }, ScreenSpaceEventType.LEFT_CLICK)
  }

  /** ADD TRIPWIRE: turn the armed AOI + selected preset into a live rule. Prompts for the
   *  threshold on the FLIGHTS>N / QUAKE M>=x presets. */
  addTripwire(presetId: string, onStatus: (t: string) => void) {
    if (!this.armed) return onStatus('TRIPWIRE: ARM AN AOI FIRST')
    const preset = TRIPWIRE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return onStatus('TRIPWIRE: UNKNOWN CONDITION')
    let param: number | undefined
    if (preset.param) {
      const raw = window.prompt(`${preset.param} for ${preset.label}`, String(preset.def))
      if (raw === null) return onStatus('TRIPWIRE: CANCELLED')
      param = Number(raw)
      if (!Number.isFinite(param)) return onStatus('TRIPWIRE: BAD NUMBER')
    }
    const condition = presetCondition(presetId, this.armed, param)
    if (!condition) return onStatus('TRIPWIRE: UNKNOWN CONDITION')
    const id = `tw${this.seq++}`
    const rule: Rule = { id, name: tripwireName(presetId, param), condition, aoi: this.armed }
    this.engine.add(rule)
    this.armed = null
    this.ds.entities.removeById('tw-preview')
    this.drawAll()
    this.renderList()
    this.onCount((this.count = this.engine.list().length))
    onStatus(`TRIPWIRE ARMED: ${rule.name}`)
    // Live pass so an already-true condition trips immediately instead of waiting a full tick.
    void this.tick()
  }

  /** Click a ring on the globe (id tw-<ruleId>) -> recenter on that AOI. Wired from main's LEFT_CLICK. */
  inspect(entityId: string): string {
    const ruleId = entityId.slice('tw-'.length)
    const rule = this.engine.list().find((r) => r.id === ruleId)
    if (!rule?.aoi) return ''
    this.flyToAoi(rule.aoi)
    return `TRIPWIRE: ${rule.name}${this.fired.has(ruleId) ? ' · TRIPPED' : ''}`
  }

  // --- evaluation loop -------------------------------------------------------

  private async tick() {
    const rules = this.engine.list()
    if (!rules.length) return
    const snaps = await snapshotsAt(Date.now(), CTX_LAYERS)
    if (rules.some((r) => (r.condition as { layer?: string }).layer === DARK_LAYER)) {
      snaps.set(DARK_LAYER, { layer: DARK_LAYER, at: Date.now(), items: await this.computeDark() })
    }
    this.engine.evaluate(buildCtxFromSnapshots(snaps)) // fires handleFire on rising edges
  }

  /** Synthetic 'dark' layer: still-dark vessels (AIS lost, not yet reappeared) over the last 6h,
   *  reduced to {lat,lon} of their last fix so inAoi can test them. Reuses the CAP-14 detector. */
  private async computeDark(): Promise<Pt[]> {
    const now = Date.now()
    const snaps = await snapshotsInRange('ships', now - DARK_WINDOW_MS, now)
    if (snaps.length < 2) return []
    const events = detectDarkEvents(
      snaps.map((s) => ({ at: s.at, items: s.items as Ship[] })),
      DARK_GAP_MIN,
    ) as { lastSeen: { lat: number; lon: number }; seenAgain: unknown }[]
    return events.filter((e) => !e.seenAgain).map((e) => ({ lat: e.lastSeen.lat, lon: e.lastSeen.lon }))
  }

  private handleFire(f: FiredRule) {
    this.fired.add(f.rule.id)
    const body = `${f.rule.name} — ${f.hits.length} hit${f.hits.length === 1 ? '' : 's'}`
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification('GODSEYE TRIPWIRE', { body })
    } catch (e) {
      console.warn('tripwire notification failed:', e)
    }
    const aoi = (f.rule as Rule).aoi
    if (aoi) this.flyToAoi(aoi)
    this.drawAll() // repaint the tripped ring red + updated caption
    this.onStatus(`⚠ TRIPWIRE: ${f.rule.name.toUpperCase()} · ${f.hits.length} HIT`)
  }

  private flyToAoi(aoi: Aoi) {
    this.viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(aoi.lon, aoi.lat, Math.max(aoi.radiusKm * 4000, 60_000)),
    })
  }

  // --- rendering -------------------------------------------------------------

  private drawAll() {
    this.ds.entities.suspendEvents()
    for (const r of this.engine.list()) {
      if (!r.aoi) continue
      this.ds.entities.removeById(`tw-${r.id}`)
      const tripped = this.fired.has(r.id)
      const color = tripped ? RED : CYAN
      this.ds.entities.add({
        id: `tw-${r.id}`,
        position: Cartesian3.fromDegrees(r.aoi.lon, r.aoi.lat),
        ellipse: {
          semiMinorAxis: r.aoi.radiusKm * 1000,
          semiMajorAxis: r.aoi.radiusKm * 1000,
          material: color.withAlpha(tripped ? 0.16 : 0.06),
          outline: true,
          outlineColor: color,
          height: 0,
        },
        label: {
          text: `${tripped ? '⚠ ' : ''}${r.name}`,
          font: '9px Consolas, monospace',
          fillColor: color,
          pixelOffset: new Cartesian2(0, -8),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    }
    this.ds.entities.resumeEvents()
  }

  /** Dim staged ring for an armed-but-not-yet-added AOI. */
  private drawPreview() {
    if (!this.armed) return
    this.ds.entities.removeById('tw-preview')
    this.ds.entities.add({
      id: 'tw-preview',
      position: Cartesian3.fromDegrees(this.armed.lon, this.armed.lat),
      ellipse: {
        semiMinorAxis: this.armed.radiusKm * 1000,
        semiMajorAxis: this.armed.radiusKm * 1000,
        material: CYAN.withAlpha(0.04),
        outline: true,
        outlineColor: CYAN.withAlpha(0.5),
        height: 0,
      },
    })
    this.ds.show = true
  }

  /** #tripwire-list: one row per armed rule — click name to recenter, ✕ to remove. */
  private renderList() {
    this.listEl.innerHTML = ''
    const rules = this.engine.list()
    if (!rules.length) {
      this.listEl.textContent = 'NO TRIPWIRES ARMED'
      return
    }
    for (const r of rules) {
      const row = document.createElement('div')
      row.className = 'tw-row'
      const name = document.createElement('button')
      name.className = 'tw-name'
      name.textContent = `${this.fired.has(r.id) ? '⚠ ' : ''}${r.name}`
      name.onclick = () => r.aoi && this.flyToAoi(r.aoi)
      const del = document.createElement('button')
      del.className = 'tw-del'
      del.textContent = '✕'
      del.title = 'remove tripwire'
      del.onclick = () => this.remove(r.id)
      row.append(name, del)
      this.listEl.appendChild(row)
    }
  }

  private remove(id: string) {
    this.engine.remove(id)
    this.fired.delete(id)
    this.ds.entities.removeById(`tw-${id}`)
    this.renderList()
    this.onCount((this.count = this.engine.list().length))
  }
}
