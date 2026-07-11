import { Color, Ion, Viewer } from 'cesium'
import { setBasemap, type BasemapMode } from './basemaps'
import { QuakeLayer } from './quakes'
import { AircraftLayer } from './aircraft'
import { addLayerRow } from './layer-panel'
import { normalizeOpenSky, normalizeAdsbMil } from './flights-normalize.mjs'
import './style.css'

const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
if (ION_TOKEN) Ion.defaultAccessToken = ION_TOKEN

const viewer = new Viewer('cesiumContainer', {
  // ponytail: bare globe, no ion-gated widgets — everything HUD-like comes in M2 per 04-ui-spec.
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  baseLayer: false,
})
viewer.scene.globe.baseColor = viewer.scene.backgroundColor

// -- basemap switcher (CAP-03) --------------------------------------------
const MODES: { mode: BasemapMode; label: string }[] = [
  { mode: 'google3d', label: 'GOOGLE 3D' },
  { mode: 'aerial', label: 'AERIAL + LBL' },
  { mode: 'road', label: 'ROAD' },
]
const basemapDiv = document.getElementById('basemaps')!
for (const { mode, label } of MODES) {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.dataset.mode = mode
  btn.onclick = async () => {
    const applied = await setBasemap(viewer, mode)
    for (const b of basemapDiv.querySelectorAll('button'))
      b.classList.toggle('active', b.dataset.mode === applied)
  }
  basemapDiv.appendChild(btn)
}
// boot: try google3d, falls back to aerial when keyless
;(basemapDiv.querySelector('button[data-mode="google3d"]') as HTMLButtonElement).click()

// -- data layers (CAP-07 / CAP-08 / CAP-09 / CAP-17) ----------------------
let setQuakeCount: (n: number) => void
const quakes = new QuakeLayer(viewer, (n) => setQuakeCount(n))
setQuakeCount = addLayerRow('EARTHQUAKES 24H', quakes)
quakes.start()

// OpenSky anonymous: ~400 credits/day, global /states/all = 4 credits -> 15-min poll
// stays inside budget (DS-02). OAuth2 client upgrade unlocks faster polling later.
let setFlightCount: (n: number) => void
const flights = new AircraftLayer(
  viewer,
  'flights',
  {
    url: '/feeds/opensky', // proxied: OpenSky serves no CORS for third-party origins
    normalize: normalizeOpenSky,
    pollMs: 15 * 60_000,
    color: Color.CYAN,
  },
  (n) => setFlightCount(n),
)
setFlightCount = addLayerRow('FLIGHTS', flights)
flights.start()

// adsb.lol /v2/mil: keyless, crowdsourced military traffic (DS-03) — orange per CAP-09.
let setMilCount: (n: number) => void
const military = new AircraftLayer(
  viewer,
  'military',
  {
    url: '/feeds/mil', // proxied: adsb.lol serves no CORS headers
    normalize: normalizeAdsbMil,
    pollMs: 60_000,
    color: Color.ORANGE,
    labels: true,
  },
  (n) => setMilCount(n),
)
setMilCount = addLayerRow('MILITARY', military)
military.start()
