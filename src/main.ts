import {
  Color,
  GeoJsonDataSource,
  ImageryLayer,
  Ion,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  WebMapServiceImageryProvider,
  defined,
} from 'cesium'
import { setBasemap, type BasemapMode } from './basemaps'
import { QuakeLayer } from './quakes'
import { AircraftLayer } from './aircraft'
import { SatelliteLayer } from './satellites'
import { addLayerRow } from './layer-panel'
import { PRESETS, StyleFx, type Preset } from './styles-fx'
import { CITIES, captureShot, flyToPoi, flyToShot, loadShots, makeOrbit } from './scenes'
import { initPlayback } from './playback'
import { initHud } from './hud'
import { initVoice } from './voice'
import { TrafficLayer } from './traffic'
import { ShipLayer } from './ships'
import { llmAsk, llmSummary } from './llm'
import { DarkVesselLayer } from './darkvessel'
import { GateLayer } from './gates'
import { InfraLayer } from './infra'
import { initOilPanel } from './oil'
import { GpsJamLayer } from './gpsjam'
import { AOILayer } from './aoi'
import { CctvLayer } from './cctv'
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
    urls: ['/feeds/opensky'], // proxied: OpenSky serves no CORS for third-party origins
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
    // airplanes.live serves CORS * -> direct from the browser (no proxy hop to trip bot
    // detection); adsb.lol/adsb.fi don't -> proxied fallbacks. All volunteer-run, all
    // 502 without warning (two went down during this build).
    urls: ['https://api.airplanes.live/v2/mil', '/feeds/mil', '/feeds/mil2'],
    normalize: normalizeAdsbMil,
    pollMs: 60_000,
    color: Color.ORANGE,
    labels: true,
  },
  (n) => setMilCount(n),
)
setMilCount = addLayerRow('MILITARY', military)
military.start()

// CelesTrak active catalog, SGP4 client-side (CAP-11). SPARSE by default; FULL = whole catalog.
let setSatCount: (n: number) => void
const sats = new SatelliteLayer(viewer, (n) => setSatCount(n))
setSatCount = addLayerRow('SATELLITES', sats)
const fullLabel = document.createElement('label')
const fullBox = document.createElement('input')
fullBox.type = 'checkbox'
fullLabel.append(fullBox, ' └ FULL SET')
document.getElementById('layers')!.appendChild(fullLabel)
fullBox.onchange = () => sats.setFull(fullBox.checked)
void sats.start()

// Country boundaries (CAP-24, DS-21): Natural Earth 110m, static GeoJSON.
void (async () => {
  try {
    const borders = await GeoJsonDataSource.load(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson',
      { stroke: Color.WHITE.withAlpha(0.25), fill: Color.TRANSPARENT, strokeWidth: 1 },
    )
    await viewer.dataSources.add(borders)
    const setBorderCount = addLayerRow('BOUNDARIES', {
      get shown() {
        return borders.show
      },
      set shown(v: boolean) {
        borders.show = v
      },
    })
    setBorderCount(borders.entities.values.length)
  } catch (e) {
    console.warn('boundaries load failed:', e)
  }
})()

// -- AIS ships (CAP-13, DS-05): aisstream WebSocket, Gulf default bbox -------
const status = document.getElementById('status')!
let setShipCount: (n: number) => void = () => {}
const ships = new ShipLayer(viewer, (n) => setShipCount(n))
if (ships.enabled) {
  setShipCount = addLayerRow('SHIPS', ships, { onDemand: true }) // WebSocket stream fills over ~60s
  setShipCount(0)
  const subBtn = document.createElement('button')
  subBtn.id = 'ships-sub'
  subBtn.textContent = '└ SUBSCRIBE VIEW'
  document.getElementById('layers')!.appendChild(subBtn)
  subBtn.onclick = () => (status.textContent = ships.subscribeView())
  ships.start()
}

// -- dark-vessel detection (CAP-14): AIS-gap analysis over recorded ship history ----------
const darkListEl = document.createElement('div')
darkListEl.id = 'dark-list'
let setDarkCount: (n: number) => void = () => {}
const darkvessel = new DarkVesselLayer(viewer, (n) => setDarkCount(n), darkListEl)
setDarkCount = addLayerRow('DARK VESSELS', darkvessel, { onDemand: true }) // filled by SCAN DARK
setDarkCount(0)
const darkScanBtn = document.createElement('button')
darkScanBtn.id = 'dark-scan'
darkScanBtn.textContent = '└ SCAN DARK'
document.getElementById('layers')!.append(darkScanBtn, darkListEl)
darkScanBtn.onclick = async () => {
  darkScanBtn.disabled = true
  status.textContent = 'DARK VESSELS: SCANNING 6H AIS HISTORY…'
  status.textContent = await darkvessel.scan()
  darkScanBtn.disabled = false
}

// -- Hormuz gate crossing analytics (CAP-15, on-demand over recorded ships) ----
const gate = new GateLayer(viewer)
const setGateCount = addLayerRow('HORMUZ GATE', gate, { onDemand: true })
setGateCount(0)
const gateScan = document.createElement('button')
gateScan.id = 'gate-scan'
gateScan.textContent = '└ SCAN 24H'
document.getElementById('layers')!.appendChild(gateScan)
gateScan.onclick = async () => {
  gateScan.disabled = true
  status.textContent = 'GATE: REPLAYING 24H OF SHIP TRACKS…'
  status.textContent = await gate.analyze()
  setGateCount(gate.count)
  gateScan.disabled = false
}
const gateSet = document.createElement('button')
gateSet.id = 'gate-set'
gateSet.textContent = '└ SET GATE (2 CLICKS)'
document.getElementById('layers')!.appendChild(gateSet)
gateSet.onclick = () => gate.armSetGate((t) => (status.textContent = t))

// -- critical infrastructure (CAP-25): pipelines, chokepoints, ports, desalination
let setInfraCount: (n: number) => void = () => {}
const infra = new InfraLayer(viewer, (n) => setInfraCount(n))
setInfraCount = addLayerRow('CRITICAL INFRA', infra)
setInfraCount(infra.count) // constructor already rendered; show its count now the row exists

// -- oil futures panel (DS-17): Brent/WTI sparklines from FRED, load-once ----
void initOilPanel()

// -- 4D playback (M3): record-first, scrub recorded snapshots ---------------
initPlayback({ flights, military, quakes, sats, ships, onStatus: (t) => (status.textContent = t) })

// -- style presets + effect controls (CAP-04 / CAP-05 / CAP-06) ------------
const fx = new StyleFx(viewer)
const styleName = document.getElementById('style-name')!
const presetsDiv = document.getElementById('style-presets')!
function setPreset(p: Preset) {
  fx.setPreset(p)
  styleName.textContent = p
  for (const b of presetsDiv.querySelectorAll('button')) b.classList.toggle('active', b.textContent === p)
}
PRESETS.forEach((p, i) => {
  const btn = document.createElement('button')
  btn.textContent = p
  btn.title = `key ${i + 1}`
  btn.onclick = () => setPreset(p)
  presetsDiv.appendChild(btn)
})
setPreset('NORMAL')
;(document.getElementById('fx-bloom') as HTMLInputElement).onchange = (e) =>
  fx.setBloom((e.target as HTMLInputElement).checked)
;(document.getElementById('fx-sharpen') as HTMLInputElement).oninput = (e) => {
  fx.sharpen = Number((e.target as HTMLInputElement).value) / 100
  fx.refresh()
}
;(document.getElementById('fx-pixelate') as HTMLInputElement).oninput = (e) => {
  fx.pixelate = Number((e.target as HTMLInputElement).value) / 100
  fx.refresh()
}

// -- scenes: city POIs + QWERT jumps (CAP-43/44/47) -------------------------
const citySelect = document.getElementById('city-select') as HTMLSelectElement
const poiChips = document.getElementById('poi-chips')!
for (const c of CITIES) {
  const opt = document.createElement('option')
  opt.textContent = c.name
  citySelect.appendChild(opt)
}
function renderPois() {
  const city = CITIES[citySelect.selectedIndex]
  poiChips.innerHTML = ''
  city.pois.forEach((poi, i) => {
    const btn = document.createElement('button')
    btn.textContent = `${'QWERT'[i] ?? ''} ${poi.name}`
    btn.onclick = () => flyToPoi(viewer, poi)
    poiChips.appendChild(btn)
  })
}
citySelect.onchange = renderPois
renderPois()

// -- shot planner (CAP-45) ---------------------------------------------------
const shotChips = document.getElementById('shot-chips')!
function renderShots() {
  shotChips.innerHTML = ''
  loadShots().forEach((_, i) => {
    const btn = document.createElement('button')
    btn.textContent = `${i + 1}`
    btn.onclick = () => flyToShot(viewer, i)
    shotChips.appendChild(btn)
  })
}
;(document.getElementById('shot-capture') as HTMLButtonElement).onclick = () => {
  captureShot(viewer)
  renderShots()
}
renderShots()

// -- cinematic orbit (CAP-46) -------------------------------------------------
const orbit = makeOrbit(viewer)
const orbitBtn = document.getElementById('orbit-toggle') as HTMLButtonElement
orbitBtn.onclick = () => orbitBtn.classList.toggle('active', orbit.toggle())

// -- search box: Nominatim fly-to (CAP-53) ------------------------------------
const searchBox = document.getElementById('search-box') as HTMLInputElement
searchBox.onkeydown = async (e) => {
  if (e.key !== 'Enter' || !searchBox.value.trim()) return
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchBox.value)}`,
    )
    const [hit] = (await res.json()) as { boundingbox: [string, string, string, string] }[]
    if (!hit) {
      status.textContent = 'NO MATCH'
      return
    }
    const [s, n, w, ee] = hit.boundingbox.map(Number)
    viewer.camera.flyTo({ destination: Rectangle.fromDegrees(w, s, ee, n), duration: 2.5 })
  } catch (err) {
    console.warn('search failed:', err)
  }
}

// hotkeys: 1..6 style presets, Q/W/E/R/T city POIs (CAP-44), H = clean UI (CAP-06)
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
  const n = Number(e.key)
  if (n >= 1 && n <= PRESETS.length) setPreset(PRESETS[n - 1])
  const poiIdx = 'qwert'.indexOf(e.key.toLowerCase())
  if (poiIdx >= 0) {
    const poi = CITIES[citySelect.selectedIndex].pois[poiIdx]
    if (poi) flyToPoi(viewer, poi)
  }
  if (e.key === 'h' || e.key === 'H') document.body.classList.toggle('clean-ui')
})

// -- weather radar (M5, DS-09 NOAA NEXRAD via Iowa Mesonet WMS, CONUS) -------
const nexrad = new ImageryLayer(
  new WebMapServiceImageryProvider({
    url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi',
    layers: 'nexrad-n0r',
    parameters: { transparent: true, format: 'image/png' },
    credit: 'NOAA NEXRAD via Iowa Environmental Mesonet',
  }),
  { alpha: 0.6 },
)
nexrad.show = false
viewer.imageryLayers.add(nexrad)
addLayerRow(
  'WEATHER RADAR',
  {
    get shown() {
      return nexrad.show
    },
    set shown(v: boolean) {
      nexrad.show = v
    },
  },
  { noCount: true }, // imagery overlay — no entity count
)

// -- street traffic particles (CAP-16, on-demand per view) -------------------
let setTrafficCount: (n: number) => void
const traffic = new TrafficLayer(viewer, (n) => setTrafficCount(n))
setTrafficCount = addLayerRow('STREET TRAFFIC', traffic, { onDemand: true }) // manual SCAN VIEW
setTrafficCount(0)
const trafficBtn = document.createElement('button')
trafficBtn.id = 'traffic-scan'
trafficBtn.textContent = '└ SCAN VIEW'
document.getElementById('layers')!.appendChild(trafficBtn)
trafficBtn.onclick = async () => {
  trafficBtn.disabled = true
  status.textContent = 'TRAFFIC: QUERYING ROAD NETWORK…'
  status.textContent = await traffic.activate()
  trafficBtn.disabled = false
}

// -- GPS jamming (CAP-21, on-demand per view) ---------------------------------
// gpsjam.org method: hex-bin low nav-integrity (NIC/NACp) ADS-B reports; a cluster
// of degraded reports = an active jamming cell. Keyless airplanes.live point query.
let setJamCount: (n: number) => void
const gpsjam = new GpsJamLayer(viewer, (n) => setJamCount(n))
setJamCount = addLayerRow('GPS JAMMING', gpsjam, { onDemand: true }) // manual SCAN VIEW
setJamCount(0)
const jamBtn = document.createElement('button')
jamBtn.id = 'jam-scan'
jamBtn.textContent = '└ SCAN VIEW'
document.getElementById('layers')!.appendChild(jamBtn)
jamBtn.onclick = async () => {
  jamBtn.disabled = true
  status.textContent = 'GPS JAM: QUERYING ADS-B INTEGRITY…'
  status.textContent = await gpsjam.scan()
  jamBtn.disabled = false
}

// -- satellite-to-ground AOI access lines (CAP-12, AC-05; imaging watchlist CAP-29) --
// Line drawn sat->AOI whenever an imaging bird is above the elevation mask over a target.
let setAoiCount: (n: number) => void
const aoiLines = new AOILayer(viewer, (n) => setAoiCount(n))
setAoiCount = addLayerRow('SAT AOI LINES', aoiLines, { onDemand: true }) // imaging passes are intermittent -> 0 is honest
setAoiCount(0)
const maskLabel = document.createElement('label')
const maskInput = document.createElement('input')
maskInput.type = 'range'
maskInput.min = '5'
maskInput.max = '60'
maskInput.value = '20'
maskLabel.append(' └ MASK ', maskInput, '°')
document.getElementById('layers')!.appendChild(maskLabel)
maskInput.oninput = () => aoiLines.setMask(Number(maskInput.value))

// -- live CCTV mesh + ground projection (CAP-20, AC-04) ---------------------
// Public DOT still-cams: marker per cam, click -> fly to a framing pose looking
// along the cam heading + PiP live snapshot (1 frame/min). COVERAGE draws the
// ground footprint wedge; ALIGN-DRAPE toggles outline (PROJECTION) vs filled
// (DRAPE). Pose sliders live in the PiP (auto-cal is WIP per the author).
let setCctvCount: (n: number) => void = () => {}
const cctv = new CctvLayer(viewer, (n) => setCctvCount(n))
setCctvCount = addLayerRow('CCTV MESH', cctv)
setCctvCount(cctv.count) // constructor already rendered the markers
const cctvCov = document.createElement('button')
cctvCov.id = 'cctv-coverage'
cctvCov.textContent = '└ COVERAGE'
document.getElementById('layers')!.appendChild(cctvCov)
cctvCov.onclick = () => {
  const on = !cctvCov.classList.contains('active')
  cctvCov.classList.toggle('active', on)
  status.textContent = cctv.setCoverage(on)
}
const cctvDrape = document.createElement('button')
cctvDrape.id = 'cctv-drape'
cctvDrape.textContent = '└ ALIGN-DRAPE'
document.getElementById('layers')!.appendChild(cctvDrape)
cctvDrape.onclick = () => {
  const on = !cctvDrape.classList.contains('active')
  cctvDrape.classList.toggle('active', on)
  status.textContent = cctv.setDrape(on)
}

// -- HUD telemetry + voice + AI caption (M4/M5 keyless slices) ---------------
initHud(viewer)
const summary = document.getElementById('hud-summary')!
function pictureContext(): string {
  const parts = [
    flights.shown && flights.count > 0 ? `${flights.count} commercial flights` : '',
    military.shown && military.count > 0 ? `${military.count} military aircraft` : '',
    sats.shown && sats.count > 0 ? `${sats.count} satellites` : '',
    quakes.shown && quakes.count > 0 ? `${quakes.count} earthquakes (24h)` : '',
    ships.enabled && ships.shown && ships.count > 0 ? `${ships.count} AIS vessels` : '',
  ].filter(Boolean)
  return `Style ${fx.preset}. Layers live: ${parts.join(', ') || 'none yet'}.`
}
function templateSummary() {
  const active = [
    flights.shown && flights.count > 0 ? 'FLIGHTS' : '',
    military.shown && military.count > 0 ? 'MILITARY' : '',
    sats.shown && sats.count > 0 ? 'SATELLITES' : '',
    quakes.shown && quakes.count > 0 ? 'SEISMIC' : '',
  ].filter(Boolean)
  summary.textContent = `SUMMARY: ${fx.preset} GLOBAL ${active.slice(0, 3).join(' ') || 'STANDBY'}`
}
window.setInterval(templateSummary, 5_000)
// LLM caption upgrade (CAP-49): overwrite the template once a minute when the key is live
window.setInterval(async () => {
  const line = await llmSummary(pictureContext())
  if (line) summary.textContent = `SUMMARY: ${line}`
}, 60_000)

initVoice(
  {
    setLayer(name, on) {
      const map: Record<string, { shown: boolean }> = {
        flights,
        military,
        satellites: sats,
        earthquakes: quakes,
      }
      const layer = map[name]
      if (!layer) return false
      layer.shown = on
      return true
    },
    setStyle(name) {
      const p = PRESETS.find((x) => x.toLowerCase() === name)
      if (!p) return false
      setPreset(p)
      return true
    },
    goTo(place) {
      searchBox.value = place
      searchBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    },
    async ask(text) {
      const answer = await llmAsk(text, pictureContext())
      if (answer) status.textContent = answer
    },
  },
  (state) => (status.textContent = state),
)

// -- click-to-inspect (satellite orbit draw, CAP-11) -----------------------
new ScreenSpaceEventHandler(viewer.scene.canvas).setInputAction((click: { position: import('cesium').Cartesian2 }) => {
  const picked = viewer.scene.pick(click.position)
  const id: string | undefined = defined(picked) ? picked.id?.id : undefined
  if (id?.startsWith('sat-')) {
    const info = sats.showOrbit(id)
    if (info) status.textContent = info
  } else if (id?.startsWith('os-') || id?.startsWith('mil-')) {
    // click-to-track aircraft (CAP-10): camera locks and follows; click empty space to untrack
    viewer.trackedEntity = picked.id
    status.textContent = `TRACKING ${String(picked.id.name ?? id).toUpperCase()}`
  } else if (id?.startsWith('ship-')) {
    const info = ships.dossier(id)
    if (info) status.textContent = info
  } else if (id?.startsWith('cctv-')) {
    // CCTV cam (CAP-20): fly to framing pose + open the live-snapshot PiP
    status.textContent = cctv.select(id)
  } else {
    sats.clearOrbit()
    viewer.trackedEntity = undefined
    status.textContent = ''
  }
}, ScreenSpaceEventType.LEFT_CLICK)
