// CONFLICT ZONES layer: translucent polygons over curated indicative conflict/dispute areas
// (ACTIVE red / CONTESTED amber / DISPUTED yellow). Static data, no network feed.
import { Cartesian3, ClassificationType, Color, CustomDataSource, Viewer } from 'cesium'
import { ZONES_DATA } from './zones-data.mjs'

type ZoneStatus = 'ACTIVE' | 'CONTESTED' | 'DISPUTED'
interface ConflictZone {
  id: string
  name: string
  status: ZoneStatus
  note: string
  asOf: string
  ring: [number, number][]
}
const ZONES = ZONES_DATA as ConflictZone[]

const STATUS_LABEL: Record<ZoneStatus, string> = {
  ACTIVE: 'ACTIVE CONFLICT',
  CONTESTED: 'CONTESTED',
  DISPUTED: 'DISPUTED',
}

function fillColor(status: ZoneStatus): Color {
  switch (status) {
    case 'ACTIVE':
      return Color.RED.withAlpha(0.18)
    case 'CONTESTED':
      return Color.fromCssColorString('#ffb300').withAlpha(0.15) // amber
    case 'DISPUTED':
      return Color.YELLOW.withAlpha(0.12)
  }
}

function outlineColor(status: ZoneStatus): Color {
  switch (status) {
    case 'ACTIVE':
      return Color.RED.withAlpha(0.9)
    case 'CONTESTED':
      return Color.fromCssColorString('#ffb300').withAlpha(0.85)
    case 'DISPUTED':
      return Color.YELLOW.withAlpha(0.8)
  }
}

export class ZonesLayer {
  readonly ds = new CustomDataSource('zones')
  count = 0

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
    this.render()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  private render() {
    this.ds.entities.removeAll()
    for (const z of ZONES) {
      const flat = z.ring.flatMap((p) => p)
      const fill = Cartesian3.fromDegreesArray(flat)
      const outline = Cartesian3.fromDegreesArray([...flat, z.ring[0][0], z.ring[0][1]]) // closed loop for the outline
      this.ds.entities.add({
        id: `zone-${z.id}`,
        // classificationType BOTH drapes the fill over terrain/3D tiles (no h=0 sinking under hills)
        polygon: { hierarchy: fill, material: fillColor(z.status), outline: false, classificationType: ClassificationType.BOTH },
        polyline: { positions: outline, width: 1.5, material: outlineColor(z.status), clampToGround: true },
        description: `<strong>${STATUS_LABEL[z.status]}</strong><br>${z.name}<br>${z.note}<br><em>as of ${z.asOf}</em>`,
      })
    }
    this.count = ZONES.length
    this.onUpdate(this.count)
  }

  /** entityId is `zone-<id>` from the global click handler: fly to the zone, return a status line. */
  select(id: string): string {
    const entity = this.ds.entities.getById(id)
    const z = ZONES.find((z) => `zone-${z.id}` === id)
    if (!entity || !z) return ''
    this.viewer.flyTo(entity)
    return `ZONE: ${z.name.toUpperCase()} · ${STATUS_LABEL[z.status]}`
  }
}
