// OPS-WALL / KIOSK MODE (command-center). Button + hotkey "K" enters real
// fullscreen, adds body.clean-ui + body.kiosk, and auto-cycles the camera through
// the CITIES POI tour on a ~12s smooth flyTo timer with a minimal cycle ticker.
// K/Esc exits and restores. fullscreenchange keeps state in sync. No entities.
import { Cartesian3, Math as CMath, Viewer } from 'cesium'
import { CITIES } from './scenes'
import { buildTour, tourLabel } from './kiosk-core.mjs'

const CYCLE_MS = 12_000
const TOUR = buildTour(CITIES)

export function setupKiosk(viewer: Viewer) {
  const ticker = document.createElement('div')
  ticker.id = 'kiosk-ticker'
  document.body.appendChild(ticker)

  let timer: number | null = null
  let idx = 0

  const flyNext = () => {
    const s = TOUR[idx % TOUR.length]
    ticker.textContent = tourLabel(TOUR, idx)
    idx++
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(s.lon, s.lat, s.range),
      orientation: { heading: 0, pitch: CMath.toRadians(-40), roll: 0 },
      duration: 4,
    })
  }

  const enter = () => {
    if (document.body.classList.contains('kiosk')) return
    document.body.classList.add('clean-ui', 'kiosk')
    // requestFullscreen rejects if not user-gesture-driven; button/hotkey both are.
    document.documentElement.requestFullscreen().catch(() => {})
    idx = 0
    flyNext()
    timer = window.setInterval(flyNext, CYCLE_MS)
  }

  const exit = () => {
    if (!document.body.classList.contains('kiosk')) return
    document.body.classList.remove('clean-ui', 'kiosk')
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }

  const toggle = () => (document.body.classList.contains('kiosk') ? exit() : enter())

  const btn = document.createElement('button')
  btn.id = 'kiosk-toggle'
  btn.textContent = 'OPS-WALL'
  btn.title = 'Kiosk / ops-wall auto-cycle (K)'
  btn.onclick = toggle
  document.body.appendChild(btn)

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault()
      toggle()
    } else if (e.key === 'Escape' && document.body.classList.contains('kiosk')) {
      exit()
    }
  })

  // Browser Esc / F11 dropping fullscreen must pull us out of kiosk too.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('kiosk')) exit()
  })

  return { toggle, enter, exit }
}
