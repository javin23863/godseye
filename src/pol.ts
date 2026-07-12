// Pattern-of-life panel (CAP-26): select a tracked entity (aircraft os-/mil-, ship ship-) or an
// AOI marker (aoi-) and this assembles that thing's last-24h track from the recorder, runs the
// pure patternOfLife profile, and paints a compact HUD (#pol-panel): a 24-bar UTC hour sparkline,
// the active-hour window, median speed, and a one-line LLM narrative. Pure profiling lives in
// pol-core.mjs; this file is the recorder read + Cesium/DOM + LLM glue only.
import { Cartographic, Math as CMath, Viewer } from 'cesium'
import type { Entity } from 'cesium'
import { TrackStore, type Track } from './tracks'
import { patternOfLife } from './pol-core.mjs'
import { haversineKm } from './rules-eval.mjs'
import { llmSummary } from './llm'

const WINDOW_MS = 24 * 3_600_000
const CORRIDOR_KM = 25 // radius around an AOI whose ship traffic makes the "corridor" track

// entity-id prefix -> which recorded layer + grouping key to rebuild that entity's track from.
// track.id equals the entity id for aircraft (idKey 'id'); ships group on 'mmsi', so the track
// id is the bare number and we strip the 'ship-' prefix to look it up.
const ENTITY_LAYERS: Record<string, { layer: string; idKey: string; strip: string }> = {
  'os-': { layer: 'flights', idKey: 'id', strip: '' },
  'mil-': { layer: 'military', idKey: 'id', strip: '' },
  'ship-': { layer: 'ships', idKey: 'mmsi', strip: 'ship-' },
}

export class PolLayer {
  private store = new TrackStore()
  private el: HTMLElement

  constructor(private viewer: Viewer) {
    this.el = document.createElement('div')
    this.el.id = 'pol-panel'
    this.el.style.display = 'none'
    document.body.appendChild(this.el)
  }

  /** True when this entity id is something POL can profile (used by the click dispatcher). */
  static handles(id: string | undefined): boolean {
    return !!id && (id.startsWith('aoi-') || Object.keys(ENTITY_LAYERS).some((p) => id.startsWith(p)))
  }

  /** Entry point: profile the picked entity and render the panel. */
  async inspect(picked: Entity): Promise<void> {
    const id = picked?.id
    if (!id) return
    const now = Date.now()

    let track: Track | undefined
    let label: string
    if (id.startsWith('aoi-')) {
      label = `CORRIDOR ${id.replace('aoi-', '')}`
      track = await this.corridorTrack(picked, now)
    } else {
      const key = Object.keys(ENTITY_LAYERS).find((p) => id.startsWith(p))!
      const { layer, idKey, strip } = ENTITY_LAYERS[key]
      label = `${layer.toUpperCase()} ${id.replace(strip, '')}`
      await this.store.buildForLayer(layer, now - WINDOW_MS, now, idKey)
      track = this.store.get(strip ? id.replace(strip, '') : id)
    }

    // recorder only fills as the tab runs — a fresh session has no history to profile
    if (!track || track.fixes.length < 2) {
      this.renderInsufficient(label)
      return
    }
    this.render(label, track)
  }

  /** Build a synthetic "corridor" track: every recorded ship fix within CORRIDOR_KM of the AOI,
   *  merged into one time-sorted track so the hour histogram reads the passage's tempo. */
  private async corridorTrack(aoi: Entity, now: number): Promise<Track | undefined> {
    const pos = aoi.position?.getValue(this.viewer.clock.currentTime)
    if (!pos) return undefined
    const carto = Cartographic.fromCartesian(pos)
    const lat = CMath.toDegrees(carto.latitude)
    const lon = CMath.toDegrees(carto.longitude)
    const ships = await this.store.buildForLayer('ships', now - WINDOW_MS, now, 'mmsi')
    const fixes = ships
      .flatMap((t) => t.fixes)
      .filter((f) => haversineKm(lat, lon, f.lat, f.lon) <= CORRIDOR_KM)
      .sort((a, b) => a.at - b.at)
    if (!fixes.length) return undefined
    return { id: aoi.id, fixes, first: fixes[0].at, last: fixes[fixes.length - 1].at, count: fixes.length }
  }

  private renderInsufficient(label: string) {
    this.el.innerHTML = `<h3>PATTERN OF LIFE</h3><div class="pol-sub">${label}</div><div class="pol-empty">INSUFFICIENT HISTORY · NEED 2+ RECORDED FIXES</div>`
    this.el.style.display = 'block'
  }

  private render(label: string, track: Track) {
    const p = patternOfLife(track)
    const peak = Math.max(1, ...p.hourHistogramUTC)
    const bars = p.hourHistogramUTC
      .map((n, h) => {
        const pct = Math.round((n / peak) * 100)
        const on = p.activeHoursUTC.includes(h)
        return `<span class="pol-bar${on ? ' on' : ''}" style="height:${Math.max(3, pct)}%" title="${String(h).padStart(2, '0')}Z · ${n}"></span>`
      })
      .join('')

    const active = p.activeHoursUTC.length
      ? `${hhmm(p.activeHoursUTC[0])}-${hhmm(p.activeHoursUTC[p.activeHoursUTC.length - 1] + 1)}Z`
      : 'NO CLEAR PEAK'

    this.el.innerHTML = `
      <h3>PATTERN OF LIFE</h3>
      <div class="pol-sub">${label} · ${track.count} FIXES</div>
      <div class="pol-spark">${bars}</div>
      <div class="pol-axis"><span>00Z</span><span>12Z</span><span>23Z</span></div>
      <div class="pol-row">ACTIVE <b>${active}</b></div>
      <div class="pol-row">MEDIAN SPEED <b>${p.medianSpeedKmh.toFixed(0)} KM/H</b></div>
      <div class="pol-row">DWELL ZONES <b>${p.dwellZones.length}</b></div>
      <div class="pol-narr">…</div>`
    this.el.style.display = 'block'

    // one-line narrative from the LLM seam; degrades silently (null -> keep the ellipsis)
    const narr = this.el.querySelector('.pol-narr') as HTMLElement
    const busiest = p.hourHistogramUTC.indexOf(Math.max(...p.hourHistogramUTC))
    void llmSummary(
      `Pattern of life for ${label}: ${track.count} fixes over 24h, busiest UTC hour ${busiest}:00, active window ${active}, median speed ${p.medianSpeedKmh.toFixed(0)} km/h, ${p.dwellZones.length} dwell zones. One terse line on its routine.`,
    ).then((line) => {
      if (line) narr.textContent = line
      else narr.textContent = `PEAK ${hhmm(busiest)}Z · ${p.dwellZones.length ? 'DWELLS OBSERVED' : 'TRANSITING'}`
    })
  }

  hide() {
    this.el.style.display = 'none'
  }
}

/** whole-hour -> HHMM string (24 -> 2400 for an end-of-window bound). */
function hhmm(h: number): string {
  return `${String(h).padStart(2, '0')}00`
}
