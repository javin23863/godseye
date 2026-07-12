// Cinematic base-scene pass: sun lighting/terminator (follows the 4D clock), soft
// shadows, HDR + MSAA, VIIRS night lights fading in on the dark side, pick reticle,
// boot splash. Stylized sensor looks stay in styles-fx.ts — this is the ground truth look.
import {
  CallbackProperty,
  Cartesian3,
  Color,
  Entity,
  ImageryLayer,
  Viewer,
  WebMapTileServiceImageryProvider,
  WebMercatorTilingScheme,
} from 'cesium'
import type { PositionProperty, Property } from 'cesium'

export function initScene(viewer: Viewer) {
  const scene = viewer.scene
  // ponytail: terminator + night lights only show on AERIAL/ROAD — Google 3D tiles are
  // pre-lit photogrammetry that covers the globe; relighting them is a projective ceiling.
  scene.globe.enableLighting = true // day/night terminator; sun tracks viewer.clock (4D playback moves it)
  scene.globe.dynamicAtmosphereLighting = true
  // default fade kills lighting below ~6500km camera distance — keep night dark down to
  // Black-Marble-viewing altitude, restore full imagery below 500km for close work
  scene.globe.lightingFadeOutDistance = 5e5
  scene.globe.lightingFadeInDistance = 1.5e6
  scene.highDynamicRange = true
  scene.msaaSamples = 4
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2) // ponytail: cap 2x, 4K laptops melt above
  viewer.shadowMap.softShadows = true
  viewer.shadowMap.size = 4096
  // mild default bloom so glow trails + night lights bleed light; checkbox still controls it
  const bloom = scene.postProcessStages.bloom
  bloom.enabled = true
  bloom.uniforms.brightness = -0.55
  bloom.uniforms.glowOnly = false
}

/** NASA Black Marble city lights, visible only on the night side (needs enableLighting). */
export function addNightLights(viewer: Viewer): ImageryLayer {
  const provider = new WebMapTileServiceImageryProvider({
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/{Time}/GoogleMapsCompatible_Level8/{TileMatrix}/{TileRow}/{TileCol}.png',
    layer: 'VIIRS_Black_Marble',
    style: 'default',
    tileMatrixSetID: 'GoogleMapsCompatible_Level8',
    maximumLevel: 7,
    format: 'image/png',
    tilingScheme: new WebMercatorTilingScheme(),
    dimensions: { Time: 'default' }, // Black Marble is a single annual composite
    credit: 'NASA EOSDIS GIBS Black Marble',
  })
  const layer = new ImageryLayer(provider, { dayAlpha: 0, nightAlpha: 1 })
  viewer.imageryLayers.add(layer)
  return layer
}

// -- pick reticle: pulsing target-lock ring that rides the selected entity ----
const RETICLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
  '<g fill="none" stroke="#fff" stroke-width="2">' +
  '<circle cx="32" cy="32" r="22" opacity="0.85"/>' +
  '<path d="M32 2v12M32 50v12M2 32h12M50 32h12"/>' +
  '</g></svg>'

export function initReticle(viewer: Viewer) {
  let target: Entity | null = null
  const reticle = viewer.entities.add({
    show: false,
    position: new CallbackProperty(
      () => target?.position?.getValue(viewer.clock.currentTime) ?? Cartesian3.ZERO,
      false,
    ) as unknown as PositionProperty,
    billboard: {
      image: 'data:image/svg+xml,' + encodeURIComponent(RETICLE_SVG),
      color: Color.CYAN.withAlpha(0.9),
      scale: new CallbackProperty(() => 0.75 + 0.12 * Math.sin(performance.now() / 220), false) as unknown as Property,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  return {
    // ponytail: the ring itself is pickable — clicking its center hits the reticle and
    // falls to the clear branch; click the target again to re-lock. Fine for a HUD.
    lock(e: Entity | undefined) {
      target = e ?? null
      reticle.show = !!e
    },
  }
}

// -- boot splash: typewriter status lines, fades out ---------------------------
export function bootSplash() {
  const el = document.createElement('div')
  el.id = 'boot'
  const pre = document.createElement('pre')
  el.appendChild(pre)
  document.body.appendChild(el)
  const lines = [
    "GOD'S EYE // ORBITAL COMMAND",
    'INIT RENDER CORE ............ OK',
    'TASKING LIVE FEEDS .......... OK',
    'ALL LAYERS ONLINE',
  ]
  let i = 0
  const t = window.setInterval(() => {
    pre.textContent = lines.slice(0, ++i).join('\n')
    if (i >= lines.length) {
      window.clearInterval(t)
      el.classList.add('done')
      window.setTimeout(() => el.remove(), 900)
    }
  }, 380)
}
