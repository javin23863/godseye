// Windy Map-Forecast overlay panel: a toggleable iframe hosting Windy's animated
// weather map (live wind particles by default), centered on the current Cesium view.
// The iframe loads the same-origin /feeds/windymap page — the proxy injects the
// Map-Forecast key server-side, so it never ships in the bundle. On-demand only:
// each open re-syncs to the view center; the heavy Windy lib loads nothing while closed.
import { Math as CMath, Rectangle, Viewer } from 'cesium'
import { mapUrl } from './windy-map-core.mjs'

export function initWindyMap(viewer: Viewer, onStatus: (t: string) => void) {
  const layers = document.getElementById('layers')
  if (!layers) return
  const btn = document.createElement('button')
  btn.id = 'windy-map-toggle'
  btn.textContent = '└ WEATHER MAP'
  layers.appendChild(btn)

  let panel: HTMLElement | null = null
  btn.onclick = async () => {
    if (panel && panel.style.display !== 'none') {
      panel.style.display = 'none'
      return
    }
    const rect = viewer.camera.computeViewRectangle()
    const c = rect ? Rectangle.center(rect) : null
    const lat = c && Number.isFinite(c.latitude) ? CMath.toDegrees(c.latitude) : 26.5
    const lon = c && Number.isFinite(c.longitude) ? CMath.toDegrees(c.longitude) : 56.3
    const url = mapUrl(lat, lon, viewer.camera.positionCartographic.height)
    // dev/preview SPA-fallback any unknown path to index.html (200), so status alone
    // can't detect a missing key — the real page marks itself with x-windy-map.
    const head = await fetch(url, { method: 'HEAD' }).catch(() => null)
    if (!head?.headers.get('x-windy-map')) {
      onStatus('WEATHER MAP: NO KEY (add WINDY_MAP_KEY to .env + restart)')
      return
    }
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'windy-map'
      panel.innerHTML = `
        <div id="windy-map-head"><span>WEATHER MAP · LIVE WIND</span><button id="windy-map-close" title="close">&times;</button></div>
        <iframe id="windy-map-frame" title="windy weather map"></iframe>`
      document.body.appendChild(panel)
      ;(panel.querySelector('#windy-map-close') as HTMLButtonElement).onclick = () => (panel!.style.display = 'none')
    }
    ;(panel.querySelector('#windy-map-frame') as HTMLIFrameElement).src = url
    panel.style.display = 'block'
    onStatus(`WEATHER MAP: LIVE WIND @ ${lat.toFixed(2)},${lon.toFixed(2)}`)
  }
}
