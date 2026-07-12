// Pure helpers for the Windy Map-Forecast overlay panel (no DOM/Cesium).
// The panel iframes /feeds/windymap, a proxy-served page that boots Windy's
// Leaflet lib with the key injected server-side — these just build that URL.

/** Cesium camera height (m) -> Leaflet zoom for a roughly matching view. */
export function heightToZoom(height) {
  if (!Number.isFinite(height) || height <= 0) return 5
  return Math.min(11, Math.max(3, Math.round(Math.log2(60_000_000 / height))))
}

/** Same-origin URL for the keyed Windy map page centered on the given view. */
export function mapUrl(lat, lon, height, overlay = 'wind') {
  return `/feeds/windymap?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=${heightToZoom(height)}&overlay=${overlay}`
}
