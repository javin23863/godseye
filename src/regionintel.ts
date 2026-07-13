// REGION INTEL (click-anywhere OSINT read): arm() puts the globe in crosshair mode; the next
// LEFT_CLICK picks lat/lon, drops a target reticle, gathers nearby evidence from the app's own
// live layers (via the caller-supplied provider callback — main.ts assembles that from
// flights/quakes/ships/etc.), and asks the LLM seam for a grounded regional assessment. Same
// degrade-without-a-key shape as brief.ts/analyst.ts: llmAsk -> '' falls back to a deterministic
// template so the panel always produces something. Evidence gathering + prompt + fallback are
// pure (regionintel-core.mjs); this file is only the click handler + DOM + LLM + clipboard shell.
import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  Math as CMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium'
import { gatherEvidence, buildPrompt, fallbackReport } from './regionintel-core.mjs'
import { llmAsk } from './llm'

/** Evidence providers, assembled by the caller from the app's live layers. Every field is
 *  optional and degrades gracefully — gatherEvidence skips whatever isn't supplied. Array
 *  fields are geo-filtered to the target; a "*Count" field is a scalar folded straight into
 *  the evidence counts (no distance filter, e.g. flightsCount). */
export interface EvidenceProviders {
  // structural minimum only (no index signature) so concrete layer item types
  // (Quake, NewsPin, …) are assignable as-is; gatherEvidence reads extras dynamically
  newsItems?: { lat: number; lon: number }[]
  quakes?: { lat: number; lon: number }[]
  fires?: { lat: number; lon: number }[]
  zones?: { lat: number; lon: number }[]
  outages?: { lat: number; lon: number }[]
  vessels?: { lat: number; lon: number }[]
  flightsCount?: number
}

const RADIUS_KM = 800

export class RegionIntel {
  private panel: HTMLElement
  private ds = new CustomDataSource('regionintel-target')
  private clickHandler: ScreenSpaceEventHandler | null = null

  constructor(private viewer: Viewer, private getEvidenceProviders: () => EvidenceProviders) {
    void viewer.dataSources.add(this.ds)
    this.panel = document.createElement('div')
    this.panel.id = 'regionintel'
    this.panel.style.display = 'none'
    document.body.appendChild(this.panel)
  }

  /** True while a click is pending (crosshair mode armed). */
  get armed(): boolean {
    return this.clickHandler !== null
  }

  /** Arm crosshair mode: canvas cursor changes, next LEFT_CLICK anywhere on the globe triggers
   *  one region-intel read then auto-disarms (one-shot, matches gates.ts armSetGate). */
  arm(): void {
    this.disarm()
    this.viewer.scene.canvas.style.cursor = 'crosshair'
    const h = new ScreenSpaceEventHandler(this.viewer.scene.canvas)
    this.clickHandler = h
    h.setInputAction((click: { position: Cartesian2 }) => {
      const picked = this.viewer.camera.pickEllipsoid(click.position, this.viewer.scene.globe.ellipsoid)
      this.disarm() // one-shot: consume the click regardless of hit/miss
      if (!picked) return
      const carto = Cartographic.fromCartesian(picked)
      const target = { lat: CMath.toDegrees(carto.latitude), lon: CMath.toDegrees(carto.longitude) }
      this.dropReticle(target)
      void this.runAnalysis(target)
    }, ScreenSpaceEventType.LEFT_CLICK)
  }

  /** Cancel armed crosshair mode without picking anything. */
  disarm(): void {
    this.viewer.scene.canvas.style.cursor = ''
    this.clickHandler?.destroy()
    this.clickHandler = null
  }

  destroy(): void {
    this.disarm()
    this.panel.remove()
    void this.viewer.dataSources.remove(this.ds, true)
  }

  private dropReticle(target: { lat: number; lon: number }): void {
    this.ds.entities.removeAll()
    this.ds.entities.add({
      id: 'regionintel-reticle',
      position: Cartesian3.fromDegrees(target.lon, target.lat),
      point: {
        pixelSize: 14,
        color: Color.TRANSPARENT,
        outlineColor: Color.fromCssColorString('#ffab40'),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  private async runAnalysis(target: { lat: number; lon: number }): Promise<void> {
    this.render(target, 'ANALYZING…')
    // ponytail: gatherEvidence's JSDoc Providers type is structurally stricter than this public
    // interface needs to be (array-or-number union) — cast at the one call site rather than
    // loosen EvidenceProviders for callers.
    const evidence = gatherEvidence(target, this.getEvidenceProviders() as Parameters<typeof gatherEvidence>[1], RADIUS_KM)
    // race the LLM against a 20s deadline — a hung /feeds/llm must not leave 'ANALYZING…' forever
    const deadline = new Promise<string>((resolve) => setTimeout(() => resolve(''), 20_000))
    const answer = (await Promise.race([llmAsk(buildPrompt(evidence), '').then((a) => a || ''), deadline])) || ''
    this.render(target, answer || fallbackReport(evidence))
  }

  private render(target: { lat: number; lon: number }, body: string): void {
    this.panel.innerHTML = `
      <button class="regionintel-close" title="close">X</button>
      <h3>// REGION INTEL</h3>
      <div class="regionintel-target">TARGET: ${target.lat.toFixed(2)}N, ${target.lon.toFixed(2)}E</div>
      <div class="regionintel-body">${escapeHtml(body)}</div>
      <button class="regionintel-copy">COPY</button>`
    this.panel.style.display = 'block'

    this.panel.querySelector<HTMLButtonElement>('.regionintel-close')!.onclick = () => {
      this.panel.style.display = 'none'
      this.ds.entities.removeAll()
    }

    const copy = this.panel.querySelector<HTMLButtonElement>('.regionintel-copy')!
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(body)
        copy.textContent = 'COPIED ✓'
      } catch (e) {
        console.warn('regionintel copy failed:', e)
        copy.textContent = 'COPY FAILED'
      }
      window.setTimeout(() => (copy.textContent = 'COPY'), 1500)
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
