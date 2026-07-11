// Scenes: city POI jumps (CAP-43/44/47), shot planner (CAP-45), orbit camera (CAP-46).
// ponytail: POIs are hand-curated centers; the Overpass OSM-volume centering upgrade
// (query building footprint, aim at its centroid) slots in behind poiCamera() later.
import { Cartesian3, Math as CMath, Viewer } from 'cesium'

export interface Poi {
  name: string
  lon: number
  lat: number
  range: number // camera distance meters
}
export interface City {
  name: string
  pois: Poi[]
}

export const CITIES: City[] = [
  {
    name: 'SAN FRANCISCO',
    pois: [
      { name: 'Golden Gate Bridge', lon: -122.4783, lat: 37.8199, range: 2500 },
      { name: 'Alcatraz', lon: -122.4229, lat: 37.8267, range: 1800 },
      { name: 'Salesforce Tower', lon: -122.3969, lat: 37.7897, range: 1500 },
      { name: 'Ferry Building', lon: -122.3937, lat: 37.7955, range: 1200 },
      { name: 'Sutro Tower', lon: -122.4527, lat: 37.7552, range: 2000 },
    ],
  },
  {
    name: 'NEW YORK',
    pois: [
      { name: 'Statue of Liberty', lon: -74.0445, lat: 40.6892, range: 1500 },
      { name: 'Empire State Building', lon: -73.9857, lat: 40.7484, range: 1500 },
      { name: 'One World Trade', lon: -74.0134, lat: 40.7127, range: 1800 },
      { name: 'Brooklyn Bridge', lon: -73.9969, lat: 40.7061, range: 1500 },
      { name: 'Central Park', lon: -73.9654, lat: 40.7829, range: 4000 },
    ],
  },
  {
    name: 'LONDON',
    pois: [
      { name: 'Tower Bridge', lon: -0.0754, lat: 51.5055, range: 1500 },
      { name: 'Big Ben', lon: -0.1246, lat: 51.5007, range: 1200 },
      { name: 'The Shard', lon: -0.0865, lat: 51.5045, range: 1500 },
      { name: 'Buckingham Palace', lon: -0.1419, lat: 51.5014, range: 1500 },
      { name: 'London Eye', lon: -0.1196, lat: 51.5033, range: 1200 },
    ],
  },
  {
    name: 'DUBAI',
    pois: [
      { name: 'Burj Khalifa', lon: 55.2744, lat: 25.1972, range: 2500 },
      { name: 'Palm Jumeirah', lon: 55.1381, lat: 25.1124, range: 8000 },
      { name: 'Burj Al Arab', lon: 55.1853, lat: 25.1412, range: 2000 },
      { name: 'Dubai Marina', lon: 55.1403, lat: 25.0805, range: 3000 },
      { name: 'Dubai Airport', lon: 55.3644, lat: 25.2532, range: 6000 },
    ],
  },
  {
    name: 'WASHINGTON DC',
    pois: [
      { name: 'White House', lon: -77.0365, lat: 38.8977, range: 1200 },
      { name: 'US Capitol', lon: -77.0091, lat: 38.8899, range: 1500 },
      { name: 'Pentagon', lon: -77.0563, lat: 38.8719, range: 2500 },
      { name: 'Washington Monument', lon: -77.0353, lat: 38.8895, range: 1500 },
      { name: 'Lincoln Memorial', lon: -77.0502, lat: 38.8893, range: 1200 },
    ],
  },
  {
    name: 'AUSTIN',
    pois: [
      { name: 'Texas Capitol', lon: -97.7404, lat: 30.2747, range: 1500 },
      { name: 'UT Tower', lon: -97.7394, lat: 30.2862, range: 1500 },
      { name: 'Congress Ave Bridge', lon: -97.7452, lat: 30.2616, range: 1500 },
      { name: 'Zilker Park', lon: -97.7726, lat: 30.267, range: 3000 },
      { name: 'Austin Airport', lon: -97.6664, lat: 30.1975, range: 6000 },
    ],
  },
]

export function flyToPoi(viewer: Viewer, poi: Poi) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(poi.lon, poi.lat, poi.range),
    orientation: { heading: 0, pitch: CMath.toRadians(-45), roll: 0 },
    duration: 2.5,
  })
}

// -- shot planner (CAP-45): camera states persisted in localStorage ---------
interface Shot {
  dest: [number, number, number]
  heading: number
  pitch: number
  roll: number
}
const SHOTS_KEY = 'godseye-shots'

export function captureShot(viewer: Viewer): number {
  const shots = loadShots()
  const c = viewer.camera
  shots.push({
    dest: [c.positionWC.x, c.positionWC.y, c.positionWC.z],
    heading: c.heading,
    pitch: c.pitch,
    roll: c.roll,
  })
  localStorage.setItem(SHOTS_KEY, JSON.stringify(shots))
  return shots.length
}

export function flyToShot(viewer: Viewer, index: number): boolean {
  const s = loadShots()[index]
  if (!s) return false
  viewer.camera.flyTo({
    destination: new Cartesian3(...s.dest),
    orientation: { heading: s.heading, pitch: s.pitch, roll: s.roll },
    duration: 2,
  })
  return true
}

export function loadShots(): Shot[] {
  try {
    return JSON.parse(localStorage.getItem(SHOTS_KEY) ?? '[]') as Shot[]
  } catch {
    return []
  }
}

export function clearShots() {
  localStorage.removeItem(SHOTS_KEY)
}

// -- cinematic orbit (CAP-46): rotate around current view center ------------
export function makeOrbit(viewer: Viewer) {
  let remover: (() => void) | null = null
  return {
    get active() {
      return remover !== null
    },
    toggle(degPerSec = 2) {
      if (remover) {
        remover()
        remover = null
        return false
      }
      const rate = CMath.toRadians(degPerSec)
      let last = performance.now()
      remover = viewer.clock.onTick.addEventListener(() => {
        const now = performance.now()
        viewer.scene.camera.rotateRight(rate * ((now - last) / 1000))
        last = now
      })
      return true
    },
  }
}
