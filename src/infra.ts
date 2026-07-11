// Critical infrastructure layer (CAP-25): Gulf chokepoints, pipelines, refineries, desalination.
// Static GeoJSON data; styled by kind (amber pipelines, red chokepoints, orange ports/refineries, cyan desalination).
import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  PolylineGraphics,
  PropertyBag,
  Viewer,
} from 'cesium'
import { INFRA_DATA, type InfraFeature } from './infra-data'

export class InfraLayer {
  readonly ds = new CustomDataSource('infrastructure')
  count = 0
  playback = false

  constructor(private viewer: Viewer, private onUpdate: (count: number) => void) {
    viewer.dataSources.add(this.ds)
    this.renderItems()
  }

  get shown() {
    return this.ds.show
  }
  set shown(v: boolean) {
    this.ds.show = v
  }

  private renderItems() {
    this.ds.entities.removeAll()

    for (const feature of INFRA_DATA.features) {
      const props = feature.properties
      const kind = props.kind

      if (feature.geometry.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates as [number, number]
        const entity = this.ds.entities.add({
          id: `infra-${props.name}`,
          position: Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize:
              kind === 'chokepoint'
                ? 8
                : kind === 'refinery' || kind === 'port'
                  ? 7
                  : 6,
            color: this.colorByKind(kind),
            outlineColor: Color.WHITE.withAlpha(0.3),
            outlineWidth: 1,
          },
          label: {
            text: props.name,
            font: '11px monospace',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK.withAlpha(0.7),
            outlineWidth: 2,
            pixelOffset: new Cartesian2(0, -12),
            showBackground: false,
          },
          description: this.descriptionByKind(props.name, kind),
        })
        // ponytail: click-to-inspect hook reuses 'id' prefix pattern
        if (kind === 'chokepoint' || kind === 'refinery' || kind === 'port') {
          entity.properties = new PropertyBag({ type: 'infra-strategic', subtype: kind })
        }
      } else if (feature.geometry.type === 'LineString') {
        const points = (feature.geometry.coordinates as [number, number][]).map((c) =>
          Cartesian3.fromDegrees(c[0], c[1]),
        )
        this.ds.entities.add({
          id: `infra-${props.name}`,
          polyline: new PolylineGraphics({
            positions: points,
            width: kind === 'pipeline' ? 3 : 2,
            material: this.colorByKind(kind),
            clampToGround: true,
          }),
          description: this.descriptionByKind(props.name, kind),
        })
      }
    }

    this.count = INFRA_DATA.features.length
    this.onUpdate(this.count)
  }

  private colorByKind(kind: InfraFeature['properties']['kind']): Color {
    // ponytail: color convention (amber=transit, red=choke, orange=strategic, cyan=sustain)
    switch (kind) {
      case 'pipeline':
        return Color.fromCssColorString('#ffb74d').withAlpha(0.8) // amber
      case 'chokepoint':
        return Color.RED.withAlpha(0.85) // red
      case 'port':
      case 'refinery':
        return Color.ORANGE.withAlpha(0.8) // orange
      case 'desalination':
        return Color.fromCssColorString('#4fc3f7').withAlpha(0.75) // cyan
      default:
        return Color.WHITE.withAlpha(0.6)
    }
  }

  private descriptionByKind(name: string, kind: InfraFeature['properties']['kind']): string {
    const labels: Record<string, string> = {
      chokepoint: 'STRATEGIC CHOKEPOINT',
      pipeline: 'CRUDE OIL PIPELINE',
      port: 'MARITIME PORT',
      refinery: 'OIL REFINERY',
      desalination: 'DESALINATION PLANT',
    }
    return `<strong>${labels[kind] || kind.toUpperCase()}</strong><br>${name}`
  }
}
