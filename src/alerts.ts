// NWS weather alerts layer (US-only — api.weather.gov has no international coverage).
// Extreme/Severe alerts get a translucent warning-area polygon + a centroid pin and
// label; Moderate/Minor get a dim pin only (too numerous/low-signal to label).
import { Cartesian2, Cartesian3, Color, CustomDataSource, PropertyBag, Viewer } from 'cesium'
import { normalizeNws, type AlertPin } from './alerts-core.mjs'

const FEED = '/feeds/nwsalerts' // proxied -> api.weather.gov/alerts/active
const EXTREME = Color.fromCssColorString('#ff1744')
const SEVERE = Color.fromCssColorString('#ff9100')
const MODERATE = Color.fromCssColorString('#ffea00')
const MINOR = Color.fromCssColorString('#9e9e9e')

function colorFor(sev: AlertPin['severity']): Color {
  switch (sev) {
    case 'Extreme':
      return EXTREME
    case 'Severe':
      return SEVERE
    case 'Moderate':
      return MODERATE
    default:
      return MINOR
  }
}

export class AlertsLayer {
  readonly ds = new CustomDataSource('alerts')
  count = 0
  busy = false
  private pins = new Map<string, AlertPin>()

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Fetch the NWS active-alerts feed, redraw pins/polygons. Returns a status line. */
  async scan(): Promise<string> {
    if (this.busy) return 'WX ALERTS: BUSY'
    this.busy = true
    try {
      const res = await fetch(FEED)
      if (!res.ok) throw new Error(`nws ${res.status}`)
      const geojson = await res.json()
      const pins = normalizeNws(geojson)
      this.draw(pins)
      if (!pins.length) return 'WX ALERTS: NONE ACTIVE (US)'
      const extreme = pins.filter((p) => p.severity === 'Extreme').length
      return `WX ALERTS: ${pins.length} ACTIVE (US) · ${extreme} EXTREME`
    } catch (err) {
      console.warn('alerts scan failed:', err)
      return 'WX ALERTS: NWS UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  private draw(pins: AlertPin[]) {
    this.ds.entities.removeAll()
    this.pins.clear()
    pins.forEach((p, i) => {
      const id = `alerts-${i}`
      this.pins.set(id, p)
      const color = colorFor(p.severity)
      const major = p.severity === 'Extreme' || p.severity === 'Severe'

      if (major && p.ring && p.ring.length >= 3) {
        this.ds.entities.add({
          id: `${id}-poly`,
          polygon: {
            hierarchy: Cartesian3.fromDegreesArray(p.ring.flat()),
            material: color.withAlpha(0.2),
            outline: true,
            outlineColor: color.withAlpha(0.6),
            height: 0,
          },
        })
      }

      this.ds.entities.add({
        id,
        position: Cartesian3.fromDegrees(p.lon, p.lat),
        point: {
          pixelSize: major ? 8 : 5,
          color: color.withAlpha(major ? 0.9 : 0.6),
          outlineColor: Color.BLACK.withAlpha(0.5),
          outlineWidth: 1,
        },
        label:
          p.severity === 'Extreme'
            ? {
                text: p.event,
                font: '10px monospace',
                fillColor: Color.WHITE,
                outlineColor: Color.BLACK.withAlpha(0.7),
                outlineWidth: 2,
                pixelOffset: new Cartesian2(0, -12),
                showBackground: false,
              }
            : undefined,
        description: `<strong>${p.event.toUpperCase()}</strong> (${p.severity})<br>${p.headline}<br>Area: ${p.area}`,
        properties: new PropertyBag({ type: 'alerts', severity: p.severity }),
      })
    })
    this.count = pins.length
    this.onUpdate(this.count)
  }

  /** Wired from main's LEFT_CLICK for alerts- ids: fly to the pin + report it. */
  select(id: string): string {
    const p = this.pins.get(id)
    if (!p) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(p.lon, p.lat, 400_000) })
    return `${p.event.toUpperCase()} · ${p.severity.toUpperCase()} · ${p.area}`
  }
}
