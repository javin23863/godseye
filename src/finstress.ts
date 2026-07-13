// FIN. STRESS (extends the DS-17 oil-panel concept to a multi-instrument stress board):
// WTI/Brent/NatGas/VIX/GOLD-proxy daily closes from FRED, each with a hub marker on the
// globe colored by 5-day % change. FRED updates once a day -> scan() on load only, no
// polling (mirrors oil.ts). Self-injects '#finstress-panel' + its own <style>, no CSS/HTML
// file edits needed. Rides the existing /feeds/oil FRED proxy (it forwards ?id= verbatim).
import { Cartesian2, Cartesian3, Color, CustomDataSource, Viewer } from 'cesium'
import { buildSeries, INSTRUMENTS, pctChange, stressColor } from './finstress-core.mjs'

interface Reading {
  key: string
  hub: { name: string; lat: number; lon: number }
  last: number | null
  last5: number[]
  chg5d: number | null
}

const CHANGE_DAYS = 5

async function fetchSeries(fred: string) {
  try {
    const res = await fetch(`/feeds/oil?id=${fred}`) // existing FRED route preserves ?id= — any series, not just oil
    if (!res.ok) return null
    return buildSeries(await res.text())
  } catch {
    return null // network failure -> caller shows the instrument as unavailable
  }
}

export class FinStressLayer {
  readonly ds = new CustomDataSource('finstress')
  count = 0
  private panel: HTMLDivElement
  private last: Reading[] = []

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
    injectStyle()
    this.panel = buildPanel()
    document.body.appendChild(this.panel)
    this.panel.querySelector<HTMLButtonElement>('#finstress-toggle')!.onclick = () => {
      const collapsed = this.panel.classList.toggle('collapsed')
      this.panel.querySelector('#finstress-toggle')!.innerHTML = collapsed ? '&plus;' : '&minus;'
    }
    this.panel.querySelector<HTMLButtonElement>('#finstress-refresh')!.onclick = () => void this.scan()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
    this.panel.style.display = v ? '' : 'none'
  }

  get items(): Reading[] {
    return this.last
  }

  async scan() {
    const readings = await Promise.all(
      INSTRUMENTS.map(async (inst): Promise<Reading> => {
        const series = await fetchSeries(inst.fred)
        if (!series || !series.values.length) {
          return { key: inst.key, hub: inst.hub, last: null, last5: [], chg5d: null }
        }
        return {
          key: inst.key,
          hub: inst.hub,
          last: series.values[series.values.length - 1],
          last5: series.values.slice(-5),
          chg5d: pctChange(series, CHANGE_DAYS),
        }
      }),
    )
    this.last = readings
    this.render(readings)
  }

  private render(readings: Reading[]) {
    this.ds.entities.removeAll()
    for (const r of readings) {
      if (r.last == null) continue
      const color = Color.fromCssColorString(stressColor(r.chg5d))
      this.ds.entities.add({
        id: `finstress-${r.key}`,
        position: Cartesian3.fromDegrees(r.hub.lon, r.hub.lat),
        point: { pixelSize: 12, color: color.withAlpha(0.25), outlineColor: color, outlineWidth: 3 },
        label: {
          text: `${r.key} ${r.last.toFixed(2)}`,
          font: '10px Consolas, monospace',
          fillColor: color,
          pixelOffset: new Cartesian2(10, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description:
          `<strong>${r.key}</strong> &middot; ${r.hub.name}<br>` +
          `last ${r.last.toFixed(2)} &middot; ${CHANGE_DAYS}d ${fmtPct(r.chg5d)}<br>` +
          `last ${r.last5.length}: ${r.last5.map((v) => v.toFixed(2)).join(', ')}`,
      })
    }
    this.count = readings.filter((r) => r.last != null).length
    this.renderPanel(readings)
    this.onUpdate(this.count)
  }

  private renderPanel(readings: Reading[]) {
    const body = this.panel.querySelector<HTMLElement>('#finstress-body')!
    body.innerHTML = ''
    if (!readings.length) {
      body.innerHTML = '<div class="fs-empty">NO DATA</div>'
      return
    }
    for (const r of readings) {
      const row = document.createElement('div')
      row.className = 'fs-row'
      const dot = document.createElement('span')
      dot.className = 'fs-dot'
      dot.style.background = stressColor(r.chg5d)
      const key = document.createElement('span')
      key.className = 'fs-key'
      key.textContent = r.key
      const val = document.createElement('span')
      val.className = 'fs-val'
      val.textContent = r.last == null ? '--' : r.last.toFixed(2)
      const chg = document.createElement('span')
      chg.className = 'fs-chg'
      chg.textContent = fmtPct(r.chg5d)
      row.append(dot, key, val, chg)
      if (r.last != null) row.onclick = () => this.select(`finstress-${r.key}`)
      body.appendChild(row)
    }
  }

  /** Fly to the instrument's hub + report it (wired from main's LEFT_CLICK for finstress- ids,
   *  same contract as news.ts/windy.ts select()). */
  select(id: string): string {
    const key = id.replace('finstress-', '')
    const r = this.last.find((x) => x.key === key)
    if (!r) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(r.hub.lon, r.hub.lat, 600_000) })
    return `${r.key}: ${r.last?.toFixed(2) ?? '--'} · ${CHANGE_DAYS}D ${fmtPct(r.chg5d).toUpperCase()}`
  }
}

function fmtPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '--'
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}%`
}

function buildPanel(): HTMLDivElement {
  const panel = document.createElement('div')
  panel.id = 'finstress-panel'
  panel.innerHTML = `
    <div id="finstress-head">
      <span>// FIN. STRESS</span>
      <button id="finstress-refresh" title="rescan">&#8635;</button>
      <button id="finstress-toggle" title="hide/show panel">&minus;</button>
    </div>
    <div id="finstress-body"><div class="fs-empty">LOADING&hellip;</div></div>
  `
  return panel
}

/** Self-contained styling (no style.css edit needed) — mirrors the frosted-glass panel
 *  look used by #oil-panel / #analyst so it reads as part of the same UI system. */
function injectStyle() {
  if (document.getElementById('finstress-style')) return
  const style = document.createElement('style')
  style.id = 'finstress-style'
  style.textContent = `
#finstress-panel {
  position: absolute; bottom: 230px; right: 16px; width: 220px;
  background: rgba(8, 14, 18, 0.82); border: 1px solid #263238; border-radius: 6px;
  padding: 8px 10px; font-size: 10px; color: #cfd8dc; backdrop-filter: blur(6px);
}
#finstress-head { display: flex; justify-content: space-between; align-items: center; letter-spacing: 2px; color: #78909c; gap: 6px; }
#finstress-head span { flex: 1; }
#finstress-head button {
  font: inherit; color: #78909c; background: none; border: 1px solid #263238; border-radius: 3px;
  width: 18px; height: 18px; cursor: pointer; line-height: 1;
}
#finstress-head button:hover { color: #4fc3f7; border-color: #4fc3f7; }
#finstress-panel.collapsed #finstress-body { display: none; }
#finstress-body { margin-top: 6px; }
.fs-row { display: flex; align-items: center; gap: 6px; padding: 2px 0; cursor: pointer; letter-spacing: 1px; }
.fs-row:hover { color: #fff; }
.fs-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.fs-key { flex: 1; color: #b0bec5; }
.fs-val { color: #4fc3f7; }
.fs-chg { width: 46px; text-align: right; }
.fs-empty { color: #78909c; letter-spacing: 1px; padding: 6px 0; text-align: center; }
`
  document.head.appendChild(style)
}
