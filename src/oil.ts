// Crude oil price panel (DS-17): Brent + WTI daily closes from FRED (keyless, proxied
// at /feeds/oil — see vite.config.ts), two overlaid sparklines in a bottom-right dock.
// FRED updates once a day -> fetch on load only, no polling (mirrors the source videos'
// synced Brent/WTI ticker, minus the trading-desk plumbing).
import { parseFredCsv } from './oil-csv.mjs'

interface OilPoint {
  date: string
  value: number
}

const SERIES = { brent: 'DCOILBRENTEU', wti: 'DCOILWTICO' } as const
const DAYS = 120 // ~last 4 months, plenty for a sparkline
const CHART_W = 252
const CHART_H = 56

async function fetchSeries(id: string): Promise<OilPoint[] | null> {
  try {
    const res = await fetch(`/feeds/oil?id=${id}`)
    if (!res.ok) return null
    const text = await res.text()
    return (parseFredCsv(text) as OilPoint[]).slice(-DAYS)
  } catch {
    return null // network/CORS failure -> caller shows the unavailable state
  }
}

function drawSparklines(canvas: HTMLCanvasElement, brent: OilPoint[], wti: OilPoint[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, CHART_W, CHART_H)
  const all = [...brent, ...wti].map((p) => p.value)
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const span = hi - lo || 1 // flat series guard
  const yFor = (v: number) => CHART_H - 4 - ((v - lo) / span) * (CHART_H - 8)
  const line = (pts: OilPoint[], color: string) => {
    if (pts.length < 2) return
    ctx.beginPath()
    pts.forEach((p, i) => {
      const x = (i / (pts.length - 1)) * CHART_W
      const y = yFor(p.value)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  line(brent, '#ffb74d')
  line(wti, '#4fc3f7')
}

/** Builds and mounts the panel itself — no index.html markup needed. */
export async function initOilPanel(): Promise<void> {
  const panel = document.createElement('div')
  panel.id = 'oil-panel'
  panel.innerHTML = `
    <div id="oil-head">
      <span>CRUDE OIL &mdash; BRENT / WTI</span>
      <button id="oil-toggle" title="hide/show panel">&minus;</button>
    </div>
    <div id="oil-body">
      <canvas id="oil-chart" width="${CHART_W}" height="${CHART_H}"></canvas>
      <div id="oil-prices">
        <span id="oil-brent" class="oil-brent">BRENT --</span>
        <span id="oil-wti" class="oil-wti">WTI --</span>
      </div>
    </div>
  `
  document.body.appendChild(panel)

  const toggle = panel.querySelector<HTMLButtonElement>('#oil-toggle')!
  toggle.onclick = () => {
    const collapsed = panel.classList.toggle('collapsed')
    toggle.innerHTML = collapsed ? '&plus;' : '&minus;'
  }

  const [brent, wti] = await Promise.all([fetchSeries(SERIES.brent), fetchSeries(SERIES.wti)])
  const body = panel.querySelector<HTMLElement>('#oil-body')!
  if (!brent?.length || !wti?.length) {
    body.innerHTML = '<div id="oil-error">OIL DATA UNAVAILABLE</div>'
    return
  }
  drawSparklines(panel.querySelector('#oil-chart')!, brent, wti)
  panel.querySelector('#oil-brent')!.textContent = `BRENT $${brent[brent.length - 1].value.toFixed(2)}`
  panel.querySelector('#oil-wti')!.textContent = `WTI $${wti[wti.length - 1].value.toFixed(2)}`
}
