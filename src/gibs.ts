// MODULE: recent-imagery overlays via NASA GIBS (keyless, CORS `*`, EPSG:3857).
// Three date-driven WMTS raster layers (true color / thermal-fires / cloud), each a
// {noCount} panel toggle, plus a DATE control (defaults yesterday UTC — today's tiles
// are often still partial). URL/date/matrix math lives in gibs-core.mjs (tested).
import { ImageryLayer, Viewer, WebMapTileServiceImageryProvider, WebMercatorTilingScheme } from 'cesium'
import { addLayerRow } from './layer-panel'
import { GIBS_LAYERS, gibsTemplate, maxLevel, utcDay } from './gibs-core.mjs'

type GibsDef = { id: string; label: string; matrixSet: string; format: string; ext: string }

function makeProvider(def: GibsDef, date: string): WebMapTileServiceImageryProvider {
  return new WebMapTileServiceImageryProvider({
    url: gibsTemplate(def),
    layer: def.id,
    style: 'default',
    tileMatrixSetID: def.matrixSet,
    maximumLevel: maxLevel(def.matrixSet),
    format: def.format,
    // GIBS GoogleMapsCompatible = web mercator; Cesium WMTS defaults to geographic — must override.
    tilingScheme: new WebMercatorTilingScheme(),
    dimensions: { Time: date }, // Cesium substitutes {Time} in the template
    credit: 'NASA EOSDIS GIBS',
  })
}

/** Build the three GIBS overlays + rows + date input, appended to #layers. */
export function initGibs(viewer: Viewer): void {
  const imagery = viewer.imageryLayers
  const shown = GIBS_LAYERS.map(() => false)
  const layers: (ImageryLayer | null)[] = GIBS_LAYERS.map(() => null)

  // Rebuild every layer for a new date: WMTS providers are immutable, so swap instances
  // while preserving each row's show state. New layers land on top of the imagery stack.
  function rebuild(date: string): void {
    GIBS_LAYERS.forEach((def, i) => {
      if (layers[i]) imagery.remove(layers[i]!, true)
      const layer = new ImageryLayer(makeProvider(def, date), { alpha: 0.7, show: shown[i] })
      imagery.add(layer)
      layers[i] = layer
    })
  }

  const startDate = utcDay(-1) // yesterday UTC
  rebuild(startDate)

  GIBS_LAYERS.forEach((def, i) => {
    addLayerRow(
      def.label,
      {
        get shown() {
          return shown[i]
        },
        set shown(v: boolean) {
          shown[i] = v
          if (layers[i]) layers[i]!.show = v
        },
      },
      { noCount: true }, // imagery overlay — no entity count
    )
  })

  // DATE control (native input[type=date]) appended under the GIBS rows.
  const row = document.createElement('label')
  row.className = 'gibs-date'
  const input = document.createElement('input')
  input.type = 'date'
  input.value = startDate
  input.max = utcDay(0) // today UTC — no future imagery
  // ponytail: inline dark-HUD styling since style.css is off-limits to this module
  input.style.cssText =
    'font:inherit;font-size:10px;color:#4fc3f7;background:rgba(0,0,0,0.4);border:1px solid #263238;border-radius:3px;padding:1px 3px;margin-left:6px'
  row.style.cssText = 'display:block;padding:4px 2px;font-size:10px;letter-spacing:1px;color:#78909c;margin-left:14px'
  row.append(' └ GIBS DATE', input)
  document.getElementById('layers')!.appendChild(row)
  input.onchange = () => {
    if (input.value) rebuild(input.value)
  }
}
