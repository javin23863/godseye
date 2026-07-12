// Global critical infrastructure module (beyond the Gulf-only CRITICAL INFRA layer):
//  (1) GlobalInfraLayer   — curated worldwide chokepoints/pipelines/strategic ports (prefix ginfra-)
//  (2) SubmarineCableLayer — TeleGeography submarine cables via same-origin /feeds/cables (prefix cable-)
// Pure GeoJSON flattening lives in ./global-infra.mjs; this file is the Cesium/DOM shell.
import { Cartesian2, Cartesian3, Color, CustomDataSource, PolylineGraphics, Viewer } from 'cesium'
import { cableSegments } from './global-infra-core.mjs'
import { GLOBAL_INFRA } from './global-infra-data'
import type { InfraFeature } from './infra-data'

type Kind = InfraFeature['properties']['kind']

// Shared with infra.ts's convention: amber = transit, red = choke, orange = strategic, cyan = sustain.
function colorByKind(kind: Kind): Color {
  switch (kind) {
    case 'pipeline':
      return Color.fromCssColorString('#ffab40').withAlpha(0.85) // amber (HUD accent)
    case 'chokepoint':
      return Color.RED.withAlpha(0.85)
    case 'port':
    case 'refinery':
      return Color.ORANGE.withAlpha(0.8)
    case 'desalination':
      return Color.fromCssColorString('#4fc3f7').withAlpha(0.75)
    default:
      return Color.WHITE.withAlpha(0.6)
  }
}

const KIND_LABEL: Record<string, string> = {
  chokepoint: 'STRATEGIC CHOKEPOINT',
  pipeline: 'TRANSNATIONAL PIPELINE',
  port: 'STRATEGIC PORT',
  refinery: 'OIL REFINERY',
  desalination: 'DESALINATION PLANT',
}

export class GlobalInfraLayer {
  readonly ds = new CustomDataSource('global-infrastructure')
  count = 0

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
    this.ds.show = false // opt-in toggle; CRITICAL INFRA already covers the Gulf by default
    this.render()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  private render() {
    for (const feature of GLOBAL_INFRA.features) {
      const { name, kind } = feature.properties
      if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates as [number, number]
        this.ds.entities.add({
          id: `ginfra-${name}`,
          position: Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize: kind === 'chokepoint' ? 8 : 7,
            color: colorByKind(kind),
            outlineColor: Color.WHITE.withAlpha(0.3),
            outlineWidth: 1,
          },
          label: {
            text: name,
            font: '11px monospace',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK.withAlpha(0.7),
            outlineWidth: 2,
            pixelOffset: new Cartesian2(0, -12),
            showBackground: false,
          },
          description: `<strong>${KIND_LABEL[kind] || kind.toUpperCase()}</strong><br>${name}`,
        })
      } else {
        const positions = (feature.geometry.coordinates as [number, number][]).map((c) =>
          Cartesian3.fromDegrees(c[0], c[1]),
        )
        this.ds.entities.add({
          id: `ginfra-${name}`,
          polyline: new PolylineGraphics({
            positions,
            width: 3,
            material: colorByKind(kind),
            clampToGround: true,
          }),
          description: `<strong>${KIND_LABEL[kind] || kind.toUpperCase()}</strong><br>${name}`,
        })
      }
    }
    this.count = GLOBAL_INFRA.features.length
    this.onUpdate(this.count)
  }
}

export class SubmarineCableLayer {
  readonly ds = new CustomDataSource('submarine-cables')
  count = 0
  private loaded = false

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
    this.ds.show = false // filled on LOAD CABLES (715 cables / ~1900 segments — opt-in)
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  /** Fetch + render the TeleGeography cable set once. Returns a status string for the HUD. */
  async load(): Promise<string> {
    if (this.loaded) {
      this.ds.show = true
      return `SUBMARINE CABLES: ${this.count} SEGMENTS (CACHED)`
    }
    try {
      const res = await fetch('/feeds/cables')
      if (!res.ok) return `SUBMARINE CABLES: FEED ${res.status}`
      const segs = cableSegments(await res.json())
      const names = new Set<string>()
      for (const s of segs) {
        names.add(s.name)
        this.ds.entities.add({
          id: `cable-${s.id}`,
          // ponytail: no clampToGround — sea-level (h=0) chords over ~1900 segments render
          // far cheaper than ground primitives, and ocean cables sit at the surface anyway.
          polyline: {
            positions: Cartesian3.fromDegreesArray(s.path.flat()),
            width: 1,
            material: Color.fromCssColorString(s.color).withAlpha(0.55),
          },
          description: `<strong>SUBMARINE CABLE</strong><br>${s.name}`,
        })
      }
      this.count = segs.length
      this.loaded = true
      this.ds.show = true
      this.onUpdate(this.count)
      return `SUBMARINE CABLES: ${this.count} SEGMENTS ACROSS ${names.size} CABLES`
    } catch (e) {
      console.warn('submarine cables load failed:', e)
      return 'SUBMARINE CABLES: FEED UNREACHABLE'
    }
  }
}
