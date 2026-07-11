import { Ion, Viewer } from 'cesium'
import { setBasemap, type BasemapMode } from './basemaps'
import { QuakeLayer } from './quakes'
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

// -- earthquakes layer (CAP-17) -------------------------------------------
const layersDiv = document.getElementById('layers')!
const label = document.createElement('label')
const box = document.createElement('input')
box.type = 'checkbox'
box.checked = true
const countSpan = document.createElement('span')
countSpan.className = 'count'
label.append(box, ' EARTHQUAKES 24H ', countSpan)
layersDiv.appendChild(label)

const quakes = new QuakeLayer(viewer, (n) => (countSpan.textContent = String(n)))
box.onchange = () => (quakes.shown = box.checked)
quakes.start()
