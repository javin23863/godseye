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
import { addNightLights, bootSplash, initReticle, initScene } from './visuals'
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
import { WindyCamLayer } from './windy'
import { initWeather } from './weather'
import { initWindyMap } from './windy-map'
import { TripwireLayer } from './tripwires'
import { TRIPWIRE_PRESETS } from './tripwire-core.mjs'
import { FusionLayer } from './fusion'
import { PolLayer } from './pol'
import { initShare } from './share'
import { init as initBoards } from './boards'
import { initGibs } from './gibs'
import { PassScheduler } from './passes'
import { NewsLayer } from './news'
import { NewsFeedPanel } from './newsfeed'
import { ZonesLayer } from './zones'
import { FiresLayer } from './fires'
import { AlertsLayer } from './alerts'
import { OutagesLayer } from './outages'
import { FinStressLayer } from './finstress'
import { RegionIntel } from './regionintel'
import { ZONES_DATA } from './zones-data.mjs'
import { setupKiosk } from './kiosk'
import { GlobalInfraLayer, SubmarineCableLayer } from './global-infra'
import { init as initBrief } from './brief'
import { init as initAnalyst, type Candidate } from './analyst'
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
  shadows: true, // sun shadows on 3D tiles/entities, sun tracks the 4D clock
})
viewer.scene.globe.baseColor = viewer.scene.backgroundColor
initScene(viewer) // lighting/terminator, HDR, MSAA, soft shadows, mild bloom
bootSplash()
const reticle = initReticle(viewer)
const nightLights = addNightLights(viewer)
;(window as { __viewer?: Viewer } & Window).__viewer = viewer // verify-scripts / devtools hook

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
addLayerRow(
  'NIGHT LIGHTS',
  {
    get shown() {
      return nightLights.show
    },
    set shown(v: boolean) {
      nightLights.show = v
    },
  },
  { noCount: true }, // imagery overlay — fades in on the dark side of the terminator
)

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
    trails: true, // 60s cadence is dense enough for altitude-colored glow trails
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

// -- global critical infra + submarine cables (worldwide, beyond the Gulf) ----
let setGinfraCount: (n: number) => void = () => {}
const ginfra = new GlobalInfraLayer(viewer, (n) => setGinfraCount(n))
setGinfraCount = addLayerRow('GLOBAL INFRA', ginfra) // opt-in: constructor rendered but ds hidden
setGinfraCount(ginfra.count)
let setCableCount: (n: number) => void = () => {}
const cables = new SubmarineCableLayer(viewer, (n) => setCableCount(n))
setCableCount = addLayerRow('SUBMARINE CABLES', cables, { onDemand: true }) // ~1900 segments, filled by LOAD
setCableCount(0)
const cableBtn = document.createElement('button')
cableBtn.id = 'cable-load'
cableBtn.textContent = '└ LOAD CABLES'
document.getElementById('layers')!.appendChild(cableBtn)
cableBtn.onclick = async () => {
  cableBtn.disabled = true
  status.textContent = 'CABLES: LOADING TELEGEOGRAPHY SET…'
  status.textContent = await cables.load()
  cableBtn.disabled = false
}

// -- oil futures panel (DS-17): Brent/WTI sparklines from FRED, load-once ----
void initOilPanel()

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
const bloomBox = document.getElementById('fx-bloom') as HTMLInputElement
bloomBox.checked = true // initScene enables mild bloom by default
bloomBox.onchange = (e) => fx.setBloom((e.target as HTMLInputElement).checked)
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

// -- recent satellite imagery (NASA GIBS): true color / fires / cloud + date --
initGibs(viewer)

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
// AUTO-SCAN (CAP-21 temporal): opt-in periodic re-scan so the 4D timeline accumulates
// jam-cell evolution. Off by default — each tick spends one airplanes.live point query.
const jamAuto = document.createElement('button')
jamAuto.id = 'jam-auto'
jamAuto.textContent = '└ AUTO-SCAN'
document.getElementById('layers')!.appendChild(jamAuto)
jamAuto.onclick = () => {
  const on = !jamAuto.classList.contains('active')
  jamAuto.classList.toggle('active', on)
  status.textContent = gpsjam.setAuto(on)
}

// -- GDELT news hotspots (feeds -> narrative): last-15min geocoded mentions ---
let setNewsCount: (n: number) => void = () => {}
const news = new NewsLayer(viewer, (n) => setNewsCount(n))
setNewsCount = addLayerRow('NEWS HOTSPOTS', news, { onDemand: true }) // filled by SCAN NEWS
setNewsCount(0)
const newsQuery = document.createElement('input')
newsQuery.id = 'news-query'
newsQuery.type = 'text'
newsQuery.placeholder = 'war conflict strike…' // blank = module's default conflict query
const newsBtn = document.createElement('button')
newsBtn.id = 'news-scan'
newsBtn.textContent = '└ SCAN NEWS'
document.getElementById('layers')!.append(newsBtn, newsQuery)
newsBtn.onclick = async () => {
  newsBtn.disabled = true
  status.textContent = 'NEWS: PULLING GDELT FEED…'
  status.textContent = await news.scan(newsQuery.value)
  newsBtn.disabled = false
}

// -- LIVE NEWS FEED panel: GDELT DOC 2.0 + Google News RSS, 90s poll, corroboration chips --
// Feed items carry no coordinates (artlist has none) — click just surfaces the story in the
// status line; the NEWS HOTSPOTS pins remain the geographic view of the same picture.
const newsfeed = new NewsFeedPanel((item) => {
  status.textContent = `FEED: [${item.chip}] ${item.title.toUpperCase().slice(0, 90)} · ${item.domain}`
})
newsfeed.setVisible(false)
const feedBtn = document.createElement('button')
feedBtn.id = 'newsfeed-toggle'
feedBtn.textContent = '└ LIVE FEED'
document.getElementById('layers')!.appendChild(feedBtn)
feedBtn.onclick = () => {
  const on = !feedBtn.classList.contains('active')
  feedBtn.classList.toggle('active', on)
  newsfeed.setVisible(on)
  if (on) newsfeed.start()
  else newsfeed.stop()
  status.textContent = on ? 'NEWS FEED: LIVE (GDELT+RSS, 90S POLL)' : 'NEWS FEED: OFF'
}

// -- conflict zones: curated indicative polygons (active/contested/disputed) --
let setZonesCount: (n: number) => void = () => {}
const zones = new ZonesLayer(viewer, (n) => setZonesCount(n))
setZonesCount = addLayerRow('CONFLICT ZONES', zones)
setZonesCount(zones.count) // constructor already rendered the polygons
zones.shown = false // opt-in — indicative shading, not operational data

// -- active fires (NASA FIRMS VIIRS 24h, on-demand) ---------------------------
let setFiresCount: (n: number) => void = () => {}
const fires = new FiresLayer(viewer, (n) => setFiresCount(n))
setFiresCount = addLayerRow('ACTIVE FIRES', fires, { onDemand: true })
setFiresCount(0)
const firesBtn = document.createElement('button')
firesBtn.id = 'fires-scan'
firesBtn.textContent = '└ SCAN FIRES'
document.getElementById('layers')!.appendChild(firesBtn)
firesBtn.onclick = async () => {
  firesBtn.disabled = true
  status.textContent = 'FIRES: PULLING FIRMS VIIRS 24H…'
  status.textContent = await fires.scan()
  firesBtn.disabled = false
}

// -- weather alerts (NWS active, US-only) -------------------------------------
let setAlertsCount: (n: number) => void = () => {}
const wxAlerts = new AlertsLayer(viewer, (n) => setAlertsCount(n))
setAlertsCount = addLayerRow('WX ALERTS (US)', wxAlerts, { onDemand: true })
setAlertsCount(0)
const alertsBtn = document.createElement('button')
alertsBtn.id = 'alerts-scan'
alertsBtn.textContent = '└ SCAN ALERTS'
document.getElementById('layers')!.appendChild(alertsBtn)
alertsBtn.onclick = async () => {
  alertsBtn.disabled = true
  status.textContent = 'WX: PULLING NWS ACTIVE ALERTS…'
  status.textContent = await wxAlerts.scan()
  alertsBtn.disabled = false
}

// -- net outages (IODA country-level, last 24h) -------------------------------
let setOutagesCount: (n: number) => void = () => {}
const outages = new OutagesLayer(viewer, (n) => setOutagesCount(n))
setOutagesCount = addLayerRow('NET OUTAGES', outages, { onDemand: true })
setOutagesCount(0)
const outagesBtn = document.createElement('button')
outagesBtn.id = 'outages-scan'
outagesBtn.textContent = '└ SCAN OUTAGES'
document.getElementById('layers')!.appendChild(outagesBtn)
outagesBtn.onclick = async () => {
  outagesBtn.disabled = true
  status.textContent = 'OUTAGES: PULLING IODA 24H SUMMARY…'
  status.textContent = await outages.scan()
  outagesBtn.disabled = false
}

// -- fin. stress board: FRED multi-instrument stress panel + hub markers ------
let setFinCount: (n: number) => void = () => {}
const finstress = new FinStressLayer(viewer, (n) => setFinCount(n))
setFinCount = addLayerRow('FIN. STRESS', finstress, { onDemand: true })
setFinCount(0)
finstress.shown = false // panel + markers hidden until first SCAN FRED
const finBtn = document.createElement('button')
finBtn.id = 'finstress-scan'
finBtn.textContent = '└ SCAN FRED'
document.getElementById('layers')!.appendChild(finBtn)
finBtn.onclick = async () => {
  finBtn.disabled = true
  finstress.shown = true
  status.textContent = 'FIN: PULLING FRED SERIES…'
  await finstress.scan()
  status.textContent = `FIN: ${finstress.count}/5 INSTRUMENTS LIVE`
  finBtn.disabled = false
}

// -- region intel: arm INTEL, click the globe -> LLM assessment from own-layer evidence --
const zoneCentroids = ZONES_DATA.map((z: { name: string; status: string; ring: [number, number][] }) => ({
  name: z.name,
  status: z.status,
  lat: z.ring.reduce((s, p) => s + p[1], 0) / z.ring.length,
  lon: z.ring.reduce((s, p) => s + p[0], 0) / z.ring.length,
}))
const regionIntel = new RegionIntel(viewer, () => ({
  newsItems: news.items,
  quakes: quakes.items,
  fires: fires.items,
  outages: outages.items,
  zones: zoneCentroids,
  flightsCount: flights.count,
}))
const intelBtn = document.createElement('button')
intelBtn.id = 'intel-arm'
intelBtn.textContent = '└ REGION INTEL (CLICK)'
document.getElementById('layers')!.appendChild(intelBtn)
intelBtn.onclick = () => {
  if (regionIntel.armed) {
    regionIntel.disarm()
    intelBtn.classList.remove('active')
    status.textContent = 'REGION INTEL: DISARMED'
  } else {
    regionIntel.arm()
    intelBtn.classList.add('active')
    status.textContent = 'REGION INTEL: CLICK A TARGET ON THE GLOBE'
  }
}

// -- tripwires + sentinel (turn the viewer into a watchstander) --------------
// Arm an AOI + condition; a ~20s timer folds the latest recorded snapshot of every live
// layer into the rules engine and, on any rising-edge fire, raises a desktop notification +
// flies to the AOI + captions it. Evaluation runs whenever rules are armed, independent of
// the row's show toggle (that only hides the rings) — arm it and walk away.
const twListEl = document.createElement('div')
twListEl.id = 'tripwire-list'
let setTwCount: (n: number) => void = () => {}
const tripwires = new TripwireLayer(
  viewer,
  (t) => (status.textContent = t),
  (n) => setTwCount(n),
  twListEl,
)
setTwCount = addLayerRow('TRIPWIRES', tripwires, { onDemand: true }) // populated by ARM+ADD
setTwCount(0)
const twArm = document.createElement('button')
twArm.id = 'tw-arm'
twArm.textContent = '└ ARM AOI (2 CLICKS)'
const twPreset = document.createElement('select')
twPreset.id = 'tw-preset'
for (const p of TRIPWIRE_PRESETS) {
  const o = document.createElement('option')
  o.value = p.id
  o.textContent = p.label
  twPreset.appendChild(o)
}
const twAdd = document.createElement('button')
twAdd.id = 'tw-add'
twAdd.textContent = '└ ADD TRIPWIRE'
document.getElementById('layers')!.append(twArm, twPreset, twAdd, twListEl)
twArm.onclick = () => tripwires.armAoi((t) => (status.textContent = t))
twAdd.onclick = () => tripwires.addTripwire(twPreset.value, (t) => (status.textContent = t))

// -- 4D playback (M3): record-first, scrub recorded snapshots (incl. GPS-jam evolution) ----
// After all recording layers (incl. gpsjam) exist, so the playhead can replay every one.
initPlayback({ flights, military, quakes, sats, ships, gpsjam, onStatus: (t) => (status.textContent = t) })

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

// -- imaging-pass scheduler (CAP-12/29): next passes over the cached TLE set --
// Rides the same localStorage TLE cache the SAT AOI LINES scan fills — no network.
const passList = document.createElement('div')
passList.id = 'pass-list'
const passBtn = document.createElement('button')
passBtn.id = 'pass-scan'
passBtn.textContent = '└ NEXT PASSES'
document.getElementById('layers')!.append(passBtn, passList)
const passes = new PassScheduler(viewer, passList)
passBtn.onclick = () => (status.textContent = passes.scan())

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

// -- global public webcams (Windy): CCTV coverage worldwide, on-demand per view ----
// Public opt-in cams near the view center via the key-injected /feeds/windy proxy.
// Degrades honestly to "NO WINDY KEY" when WINDY_API_KEY isn't set in .env.
let setWebcamCount: (n: number) => void = () => {}
const webcams = new WindyCamLayer(viewer, (n) => setWebcamCount(n))
setWebcamCount = addLayerRow('PUBLIC WEBCAMS', webcams, { onDemand: true }) // filled by SCAN VIEW
setWebcamCount(0)
const webcamBtn = document.createElement('button')
webcamBtn.id = 'webcam-scan'
webcamBtn.textContent = '└ SCAN VIEW'
document.getElementById('layers')!.appendChild(webcamBtn)
webcamBtn.onclick = async () => {
  webcamBtn.disabled = true
  status.textContent = 'WEBCAMS: QUERYING WINDY NEAR VIEW…'
  status.textContent = await webcams.scan()
  webcamBtn.disabled = false
}

// -- point weather (Windy GFS point-forecast): on-demand forecast at the view center ----
initWeather(viewer, (t) => (status.textContent = t))

// -- animated weather map (Windy Map-Forecast): iframe panel synced to the view --------
initWindyMap(viewer, (t) => (status.textContent = t))

// -- cross-layer fusion: co-located multi-INT composite indicators -----------
// On-demand SCAN. Reads recorded military/quake/gpsjam frames + darkvessel loss points,
// clusters co-located events spanning >=2 layers, scores them, click = fly-to + LLM "why".
// After darkvessel + gpsjam exist (it takes the darkvessel ref for AIS-loss points).
const fusionListEl = document.createElement('div')
fusionListEl.id = 'fusion-list'
let setFusionCount: (n: number) => void = () => {}
const fusion = new FusionLayer(
  viewer,
  (n) => setFusionCount(n),
  (t) => (status.textContent = t),
  fusionListEl,
  darkvessel,
)
setFusionCount = addLayerRow('FUSION', fusion, { onDemand: true }) // filled by SCAN FUSION
setFusionCount(0)
const fusionScan = document.createElement('button')
fusionScan.id = 'fusion-scan'
fusionScan.textContent = '└ SCAN FUSION'
document.getElementById('layers')!.append(fusionScan, fusionListEl)
fusionScan.onclick = async () => {
  fusionScan.disabled = true
  status.textContent = 'FUSION: CORRELATING LAYERS…'
  status.textContent = await fusion.scan()
  fusionScan.disabled = false
}

// -- pattern-of-life: click a tracked entity (os-/mil-/ship-) or an AOI marker to profile
// its last-24h track (UTC-hour sparkline + routine + LLM narrative). Self-injects #pol-panel.
const pol = new PolLayer(viewer)

// -- shareable moments: deep-link restore + SHARE link + REC CLIP (growth loop) ------
// Restore is camera + layer toggles (time/AOI restore is a documented ceiling). Only steady
// non-scan layers are shareable — an on-demand layer's `shown` is empty until its scan runs.
const SHAREABLE: Record<string, { shown: boolean }> = { flights, military, satellites: sats, earthquakes: quakes, ships, cctv, infra }
const shareOpts = {
  activeLayers: () => Object.keys(SHAREABLE).filter((k) => SHAREABLE[k].shown),
  applyLayers: (names: string[]) => {
    const on = new Set(names)
    for (const [k, layer] of Object.entries(SHAREABLE)) layer.shown = on.has(k)
  },
}
initShare(viewer, shareOpts)

// -- saved boards: named camera+layer views, load / share-link / delete -------
initBoards({ ...shareOpts, viewer })

// -- ops-wall kiosk mode: fullscreen auto-cycle through the city tour (K) -----
setupKiosk(viewer)

// -- one-click SOURCED BRIEF: LLM (or template) situation report + credibility badges --------
initBrief({
  picture() {
    const on = (key: string, label: string, l: { shown: boolean; count: number }) =>
      l.shown && l.count > 0 ? [{ key, label, count: l.count }] : []
    const activeLayers = [
      ...on('flights', 'FLIGHTS', flights),
      ...on('military', 'MILITARY', military),
      ...on('satellites', 'SATELLITES', sats),
      ...on('earthquakes', 'EARTHQUAKES 24H', quakes),
      ...(ships.enabled && ships.shown && ships.count > 0 ? [{ key: 'ships', label: 'SHIPS', count: ships.count }] : []),
      ...on('gpsjam', 'GPS JAMMING', gpsjam),
      ...on('darkvessel', 'DARK VESSELS', darkvessel),
    ]
    const events: { kind: string; text: string }[] = []
    if (darkvessel.count > 0) events.push({ kind: 'dark-vessel', text: `${darkvessel.count} vessels currently dark` })
    if (fusion.count > 0) events.push({ kind: 'fusion', text: `${fusion.count} multi-INT composite(s)` })
    if (tripwires.count > 0) events.push({ kind: 'tripwire', text: `${tripwires.count} tripwire(s) armed` })
    for (const q of quakes.topByMag(3)) events.push({ kind: 'quake', text: `M${q.mag} · ${q.place}` })
    return { activeLayers, events, windowLabel: 'LAST 6H' }
  },
})

// -- AI-as-analyst: "what needs attention" (top-3 fly-to chips) + natural-language geo-query --
function analystCandidates(): Candidate[] {
  const out: Candidate[] = []
  for (const e of darkvessel.events)
    out.push({ kind: 'dark vessel', lat: e.lastSeen.lat, lon: e.lastSeen.lon, score: e.gapMin, text: `${e.name} DARK ${e.gapMin}M` })
  for (const c of fusion.composites)
    out.push({ kind: 'fusion', lat: c.lat, lon: c.lon, score: c.score * 3, text: c.layers.join('+').toUpperCase() })
  for (const q of quakes.items) if (q.mag >= 4) out.push({ kind: 'quake', lat: q.lat, lon: q.lon, score: q.mag, text: `M${q.mag} ${q.place}` })
  return out
}
initAnalyst({ candidates: analystCandidates, viewer })

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
  if (typeof id === 'string' && id.endsWith('-trail')) return // glow trails aren't inspectable
  // pulsing target-lock reticle on anything inspectable
  const RETICLE_PREFIXES = ['sat-', 'os-', 'mil-', 'ship-', 'cctv-', 'news-', 'wcam-', 'fx-', 'zone-', 'fires-', 'alerts-', 'outage-', 'finstress-']
  reticle.lock(typeof id === 'string' && RETICLE_PREFIXES.some((p) => id.startsWith(p)) ? picked.id : undefined)
  // pattern-of-life (additive): profile any tracked entity / AOI marker alongside its normal action
  if (PolLayer.handles(id)) void pol.inspect(picked.id)
  else pol.hide()
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
  } else if (id?.startsWith('tw-')) {
    // tripwire AOI ring: recenter on that watch box
    status.textContent = tripwires.inspect(id)
  } else if (id?.startsWith('fx-')) {
    // composite indicator: fly to it + LLM explains why the co-location matters
    status.textContent = fusion.select(id)
  } else if (id?.startsWith('news-')) {
    // news hotspot pin: fly to it + report name/mention count
    status.textContent = news.select(id)
  } else if (id?.startsWith('wcam-')) {
    // Windy public webcam: fly to it + open the preview PiP
    status.textContent = webcams.select(id)
  } else if (id?.startsWith('zone-')) {
    status.textContent = zones.select(id)
  } else if (id?.startsWith('fires-')) {
    status.textContent = fires.select(id)
  } else if (id?.startsWith('alerts-')) {
    status.textContent = wxAlerts.select(id.replace(/-poly$/, ''))
  } else if (id?.startsWith('outage-')) {
    status.textContent = outages.select(id)
  } else if (id?.startsWith('finstress-')) {
    status.textContent = finstress.select(id)
  } else {
    sats.clearOrbit()
    viewer.trackedEntity = undefined
    status.textContent = ''
  }
}, ScreenSpaceEventType.LEFT_CLICK)
