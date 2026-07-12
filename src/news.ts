// GDELT news hotspot pins (feeds -> narrative). On-demand SCAN pulls GDELT's
// keyless v1 GKG GeoJSON feed (last ~15min of geocoded global news mentions),
// aggregates mentions per location, and drops a pin sized/coloured by volume.
// Click a pin -> name + mention count + fly-to.
//
// DATA NOTE: the module brief specified GDELT GEO 2.0 (/api/v2/geo/geo). That
// path returns HTTP 404 from the GDELT server as of build (verified by curl;
// the sibling DOC 2.0 API works, so it's the GEO endpoint specifically). The v1
// GKG GeoJSON feed IS live and keyless and returns the exact
// FeatureCollection<Point> shape we need, so the proxy points there. That feed
// ignores server-side keyword queries (returns empty), so the query box filters
// client-side over each mention's name + themes + url — see news-core.mjs.
import { Cartesian2, Cartesian3, Color, CustomDataSource, PropertyBag, Viewer } from 'cesium'
import { normalizeGeo, type NewsPin } from './news-core.mjs'

const FEED = '/feeds/gdelt' // proxied -> api.gdeltproject.org/api/v1/gkg_geojson
const MAX_PINS = 250 // top-by-count; the raw feed geocodes ~400 places / 15min
const DEFAULT_QUERY = 'war conflict strike attack protest killed missile military'
const CYAN = Color.fromCssColorString('#4fc3f7')
const AMBER = Color.fromCssColorString('#ffab40')

export class NewsLayer {
  readonly ds = new CustomDataSource('news')
  count = 0
  busy = false
  /** id -> pin, for click fly-to (matches darkvessel/fusion click routing). */
  private pins = new Map<string, NewsPin>()

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Fetch the GDELT feed, filter by query, redraw pins. Returns a status line. */
  async scan(query: string): Promise<string> {
    if (this.busy) return 'NEWS: BUSY'
    this.busy = true
    try {
      const res = await fetch(FEED)
      if (!res.ok) throw new Error(`gdelt ${res.status}`)
      const geojson = await res.json()
      const q = query.trim() || DEFAULT_QUERY
      const pins = normalizeGeo(geojson, q).slice(0, MAX_PINS)
      this.draw(pins)
      if (!pins.length) return `NEWS: NO MENTIONS MATCHED "${q}" (LAST 15MIN)`
      const hot = pins[0]
      return `NEWS: ${pins.length} HOTSPOTS · TOP ${hot.name.toUpperCase()} (${hot.count})`
    } catch (err) {
      console.warn('news scan failed:', err)
      return 'NEWS: GDELT UNAVAILABLE, TRY AGAIN'
    } finally {
      this.busy = false
    }
  }

  private draw(pins: NewsPin[]) {
    this.ds.entities.removeAll()
    this.pins.clear()
    const max = pins.length ? pins[0].count : 1
    pins.forEach((p, i) => {
      const id = `news-${i}`
      this.pins.set(id, p)
      const heat = p.count / max // 0..1
      this.ds.entities.add({
        id,
        position: Cartesian3.fromDegrees(p.lon, p.lat),
        point: {
          pixelSize: 5 + Math.round(heat * 13), // 5..18 by volume
          color: Color.lerp(CYAN, AMBER, heat, new Color()).withAlpha(0.85),
          outlineColor: Color.BLACK.withAlpha(0.5),
          outlineWidth: 1,
        },
        label: {
          text: `${p.name.split(',')[0]} · ${p.count}`,
          font: '10px monospace',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK.withAlpha(0.7),
          outlineWidth: 2,
          pixelOffset: new Cartesian2(0, -12),
          showBackground: false,
        },
        description: `<strong>NEWS HOTSPOT</strong><br>${p.name}<br>${p.count} article mention${p.count === 1 ? '' : 's'} (last 15min, GDELT)`,
        properties: new PropertyBag({ type: 'news', count: p.count }),
      })
    })
    this.count = pins.length
    this.onUpdate(this.count)
  }

  /** Wired from main's LEFT_CLICK for news- ids: fly to the pin + report it. */
  select(id: string): string {
    const p = this.pins.get(id)
    if (!p) return ''
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(p.lon, p.lat, 400_000) })
    return `NEWS: ${p.name.toUpperCase()} · ${p.count} MENTIONS`
  }
}
