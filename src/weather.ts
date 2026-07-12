// Point weather (Windy Point-Forecast GFS). On demand, forecasts the current view center via the
// key-injected /feeds/weather proxy (GET ?lat=&lon= -> server-side keyed POST) and shows current
// conditions + a next-24h temperature sparkline. On-demand only — point-forecast is a credit'd API,
// so this never polls. Degrades to "NO WEATHER KEY" when WINDY_POINT_FORECAST_KEY is unset.
import { Math as CMath, Rectangle, Viewer } from 'cesium'
import { summarizeForecast } from './weather-core.mjs'

const SPARK_W = 180
const SPARK_H = 34
const SPARK_STEPS = 16 // ~next 24-48h of GFS steps

/** Center of the current camera view, or the Hormuz default theater. */
function viewCenter(viewer: Viewer): { lat: number; lon: number } {
  const rect = viewer.camera.computeViewRectangle()
  if (rect) {
    const c = Rectangle.center(rect)
    const lat = CMath.toDegrees(c.latitude)
    const lon = CMath.toDegrees(c.longitude)
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  }
  return { lat: 26.5, lon: 56.3 }
}

function drawSpark(canvas: HTMLCanvasElement, temps: number[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, SPARK_W, SPARK_H)
  if (temps.length < 2) return
  const lo = Math.min(...temps)
  const hi = Math.max(...temps)
  const span = hi - lo || 1
  ctx.beginPath()
  temps.forEach((t, i) => {
    const x = (i / (temps.length - 1)) * SPARK_W
    const y = SPARK_H - 3 - ((t - lo) / span) * (SPARK_H - 6)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.strokeStyle = '#ffab40'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/** Mount the WEATHER on-demand control + readout into the DATA LAYERS panel. */
export function initWeather(viewer: Viewer, onStatus: (t: string) => void): void {
  const layers = document.getElementById('layers')!
  const btn = document.createElement('button')
  btn.id = 'weather-scan'
  btn.textContent = 'WEATHER (VIEW)'
  const readout = document.createElement('div')
  readout.id = 'weather-readout'
  layers.append(btn, readout)

  btn.onclick = async () => {
    btn.disabled = true
    onStatus('WEATHER: FETCHING GFS FORECAST…')
    try {
      const { lat, lon } = viewCenter(viewer)
      const res = await fetch(`/feeds/weather?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`)
      if (res.status === 401) {
        onStatus('WEATHER: NO KEY (add WINDY_POINT_FORECAST_KEY to .env)')
        readout.textContent = ''
        return
      }
      if (!res.ok) throw new Error(`weather ${res.status}`)
      const { steps, now } = summarizeForecast(await res.json())
      if (!now) throw new Error('empty forecast')
      const g = now.gustKt != null ? ` g${Math.round(now.gustKt)}` : ''
      const line =
        `${now.tempC!.toFixed(0)}°C · ${now.dir} ${now.windKt != null ? Math.round(now.windKt) : '--'}kt${g}` +
        ` · RH ${now.rh != null ? Math.round(now.rh) : '--'}% · ${now.hpa != null ? Math.round(now.hpa) : '--'}hPa`
      readout.innerHTML = `<div id="wx-loc">${lat.toFixed(2)}, ${lon.toFixed(2)}</div>
        <div id="wx-now">${line}</div>
        <canvas id="wx-spark" width="${SPARK_W}" height="${SPARK_H}"></canvas>`
      const temps = steps.slice(0, SPARK_STEPS).map((s) => s.tempC).filter((t): t is number => t != null)
      drawSpark(readout.querySelector('#wx-spark')!, temps)
      onStatus(`WEATHER: ${line} @ ${lat.toFixed(2)},${lon.toFixed(2)}`)
    } catch (err) {
      console.warn('weather fetch failed:', err)
      onStatus('WEATHER: FORECAST UNAVAILABLE, TRY AGAIN')
    } finally {
      btn.disabled = false
    }
  }
}
