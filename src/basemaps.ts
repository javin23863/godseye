// Basemap modes per CAP-03 (Google 3D / aerial+labels / road) with the M0
// graceful-fallback rule: no key or tile failure -> 2D aerial, app keeps running.
import {
  Cesium3DTileset,
  EllipsoidTerrainProvider,
  ImageryProvider,
  ImageryLayer,
  OpenStreetMapImageryProvider,
  Terrain,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
  buildModuleUrl,
  createGooglePhotorealistic3DTileset,
  IonResource,
} from 'cesium'

export type BasemapMode = 'google3d' | 'aerial' | 'road'

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_TILES_KEY as string | undefined
const ION_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined

// ponytail: Esri World Imagery as keyless aerial; swap for Bing/ion imagery when a token lands.
const AERIAL = () =>
  new UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Esri, Maxar, Earthstar Geographics',
    maximumLevel: 19,
  })
const LABELS = () =>
  new UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    credit: 'Esri',
    maximumLevel: 19,
  })
const ROAD = () => new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })

let google3d: Cesium3DTileset | null = null
let ownLayers: ImageryLayer[] = [] // only remove what we added — overlays (e.g. weather) live in the same collection
let worldTerrain: Terrain | null = null
const bundledEarthLayers = new WeakSet<ImageryLayer>()
const basemapLabelLayers = new WeakSet<ImageryLayer>()

export function isBundledEarthLayer(layer: ImageryLayer): boolean {
  return bundledEarthLayers.has(layer)
}

export function isBasemapLabelLayer(layer: ImageryLayer): boolean {
  return basemapLabelLayers.has(layer)
}

function addRemoteLayer(viewer: Viewer, provider: ImageryProvider, index: number): ImageryLayer {
  const layer = new ImageryLayer(provider)
  viewer.imageryLayers.add(layer, index)
  ownLayers.push(layer)
  provider.errorEvent.addEventListener((error) => {
    error.retry = error.timesRetried < 2
  })
  return layer
}

/** Real relief under draped imagery; flat ellipsoid under Google 3D (tiles carry their own geometry). */
function applyTerrain(viewer: Viewer, relief: boolean) {
  if (relief && ION_TOKEN) {
    worldTerrain ??= Terrain.fromWorldTerrain()
    viewer.scene.setTerrain(worldTerrain)
  } else {
    viewer.scene.globe.terrainProvider = new EllipsoidTerrainProvider()
  }
}

async function loadGoogle3d(viewer: Viewer): Promise<Cesium3DTileset | null> {
  if (google3d) return google3d
  try {
    if (GOOGLE_KEY) {
      google3d = await createGooglePhotorealistic3DTileset({ key: GOOGLE_KEY })
    } else if (ION_TOKEN) {
      // Google Photorealistic 3D Tiles as Cesium ion asset (DS-01).
      google3d = await Cesium3DTileset.fromUrl(await IonResource.fromAssetId(2275207))
    } else {
      return null
    }
    viewer.scene.primitives.add(google3d)
    return google3d
  } catch (e) {
    console.warn('google3d unavailable, falling back to aerial:', e)
    google3d = null
    return null
  }
}

/** Switch basemap without reload. Returns the mode actually applied (google3d falls back to aerial). */
export async function setBasemap(viewer: Viewer, mode: BasemapMode): Promise<BasemapMode> {
  const layers = viewer.imageryLayers
  for (const l of ownLayers) layers.remove(l, true)
  ownLayers = []
  if (google3d) google3d.show = false

  // Always keep a bundled Earth under remote imagery/tiles. It is the fail-closed
  // Story fallback and prevents network availability from becoming a blank globe.
  const offline = new ImageryLayer(await TileMapServiceImageryProvider.fromUrl(
    buildModuleUrl('Assets/Textures/NaturalEarthII'),
  ))
  layers.add(offline, 0)
  ownLayers.push(offline)
  bundledEarthLayers.add(offline)

  if (mode === 'google3d') {
    const tiles = await loadGoogle3d(viewer)
    if (tiles) {
      tiles.show = true
      applyTerrain(viewer, false)
      return 'google3d'
    }
    mode = 'aerial' // graceful fallback (roadmap risk R1)
  }
  applyTerrain(viewer, true)
  addRemoteLayer(viewer, mode === 'road' ? ROAD() : AERIAL(), 1)
  if (mode === 'aerial') {
    basemapLabelLayers.add(addRemoteLayer(viewer, LABELS(), 2))
  }
  return mode
}
