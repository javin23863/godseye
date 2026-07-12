// Windy Webcams layer (global public CCTV coverage, CAP-20 extension). On-demand SCAN VIEW
// pulls PUBLIC opt-in webcams near the current camera center via the key-injected /feeds/windy
// proxy (the Windy API key never reaches the bundle), plots a marker per cam (prefix wcam-),
// and on click flies there + opens a PiP showing the cam's own preview still. These are cams
// their owners registered on windy.com — a public detail link is fine (unlike exposed devices).
import { Cartesian2, Cartesian3, Color, CustomDataSource, Math as CMath, Rectangle, Viewer } from 'cesium'
import { normalizeWebcams, type WindyCam } from './windy-core.mjs'

const FEED = '/feeds/windy' // proxied -> api.windy.com/webcams/api/v3/webcams (+ x-windy-api-key)
const INCLUDE = 'location,images,urls'
const LIMIT = 50 // v3 page cap
const CYAN = Color.fromCssColorString('#4fc3f7')

export class WindyCamLayer {
  readonly ds = new CustomDataSource('windy-webcams')
  count = 0
  busy = false
  private pip: HTMLElement | null = null
  private cams = new Map<string, WindyCam>()

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Pull public webcams near the current view center; returns a HUD status line. */
  async scan(): Promise<string> {
    if (this.busy) return 'WEBCAMS: BUSY'
    this.busy = true
    try {
      const { lat, lon, radiusKm } = this.viewCenter()
      const url = `${FEED}?nearby=${lat.toFixed(4)},${lon.toFixed(4)},${radiusKm}&include=${INCLUDE}&limit=${LIMIT}`
      const res = await fetch(url)
      if (res.status === 403 || res.status === 401)
        return 'WEBCAMS: NO WINDY KEY (add WINDY_API_KEY to .env)' // proxy has no key / bad key
      if (!res.ok) throw new Error(`windy ${res.status}`)
      const cams = normalizeWebcams(await res.json())
      this.draw(cams)
      return cams.length
        ? `WEBCAMS: ${cams.length} PUBLIC CAMS WITHIN ${radiusKm}KM`
        : `WEBCAMS: NONE REGISTERED IN THIS VIEW`
    } catch (err) {
      console.warn('windy scan failed:', err)
      return 'WEBCAMS: FEED UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  /** Center + radius (km, Windy nearby cap 250) covering the current camera view. */
  private viewCenter(): { lat: number; lon: number; radiusKm: number } {
    const rect = this.viewer.camera.computeViewRectangle()
    if (rect) {
      const c = Rectangle.center(rect)
      const lat = CMath.toDegrees(c.latitude)
      const lon = CMath.toDegrees(c.longitude)
      const spanDeg = Math.max(CMath.toDegrees(rect.north - rect.south), CMath.toDegrees(rect.east - rect.west))
      const radiusKm = Math.round(Math.min(Math.max((spanDeg * 111) / 2, 20), 250)) // ~111km/deg, clamp to API max
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, radiusKm }
    }
    return { lat: 26.5, lon: 56.3, radiusKm: 250 } // Hormuz default theater
  }

  private draw(cams: WindyCam[]) {
    this.ds.entities.suspendEvents()
    this.ds.entities.removeAll()
    this.cams.clear()
    for (const cam of cams) {
      const id = `wcam-${cam.id}`
      this.cams.set(id, cam)
      this.ds.entities.add({
        id,
        position: Cartesian3.fromDegrees(cam.lon, cam.lat),
        point: { pixelSize: 7, color: CYAN.withAlpha(0.9), outlineColor: Color.BLACK.withAlpha(0.5), outlineWidth: 1 },
        label: {
          text: '▤',
          font: '12px monospace',
          fillColor: CYAN,
          pixelOffset: new Cartesian2(0, -12),
          showBackground: false,
        },
        description: `<strong>PUBLIC WEBCAM</strong><br>${cam.title}<br>${[cam.city, cam.country].filter(Boolean).join(', ')}`,
      })
    }
    this.ds.entities.resumeEvents()
    this.count = cams.length
    this.onUpdate(this.count)
  }

  /** Wired from main's LEFT_CLICK for wcam- ids: fly to the cam + open its preview PiP. */
  select(id: string): string {
    const cam = this.cams.get(id)
    if (!cam) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(cam.lon, cam.lat, 8_000) })
    this.openPip(cam)
    return `WEBCAM: ${cam.title.toUpperCase()} · ${[cam.city, cam.country].filter(Boolean).join(', ')}`
  }

  private openPip(cam: WindyCam) {
    if (!this.pip) {
      const el = document.createElement('div')
      el.id = 'windy-pip'
      el.innerHTML = `
        <div id="windy-pip-head"><span id="windy-pip-name">WEBCAM</span><button id="windy-pip-close" title="close">&times;</button></div>
        <img id="windy-pip-img" alt="webcam preview" />
        <div id="windy-pip-fallback">PREVIEW UNAVAILABLE</div>
        <a id="windy-pip-link" target="_blank" rel="noopener noreferrer">VIEW ON WINDY ↗</a>`
      document.body.appendChild(el)
      ;(el.querySelector('#windy-pip-close') as HTMLButtonElement).onclick = () => (el.style.display = 'none')
      this.pip = el
    }
    const p = this.pip
    p.style.display = 'block'
    ;(p.querySelector('#windy-pip-name') as HTMLElement).textContent = cam.title
    const img = p.querySelector('#windy-pip-img') as HTMLImageElement
    const fallback = p.querySelector('#windy-pip-fallback') as HTMLElement
    const link = p.querySelector('#windy-pip-link') as HTMLAnchorElement
    if (cam.preview) {
      img.style.display = ''
      fallback.style.display = 'none'
      // cache-bust so a re-open pulls the freshest still Windy has cached
      img.src = cam.preview + (cam.preview.includes('?') ? '&' : '?') + 't=' + Date.now()
      img.onerror = () => {
        img.style.display = 'none'
        fallback.style.display = 'block'
      }
    } else {
      img.style.display = 'none'
      fallback.style.display = 'block'
    }
    if (cam.detail) {
      link.style.display = ''
      link.href = cam.detail
    } else {
      link.style.display = 'none'
    }
  }
}
