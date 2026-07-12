// PURE normalize for the Windy Webcams API v3 response (no cesium/DOM/network here).
// v3 shape (with include=location,images,urls): { total, webcams: [{ webcamId, title,
// status, viewCount, location:{latitude,longitude,city,country}, images:{current:{preview,thumbnail}},
// urls:{detail} }] }. We keep only ACTIVE cams that carry real coordinates + a preview image.

/**
 * @typedef {{ id:number, title:string, lat:number, lon:number, city:string, country:string,
 *   preview:string, thumb:string, detail:string, views:number }} WindyCam
 */

/** @param {any} json v3 webcams response @returns {WindyCam[]} */
export function normalizeWebcams(json) {
  const list = Array.isArray(json?.webcams) ? json.webcams : []
  const out = []
  for (const w of list) {
    if (w?.status && w.status !== 'active') continue // skip offline cams
    const loc = w?.location
    const lat = Number(loc?.latitude)
    const lon = Number(loc?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue // no map pin without coords
    const img = w?.images?.current ?? {}
    out.push({
      id: Number(w.webcamId),
      title: typeof w.title === 'string' ? w.title : 'webcam',
      lat,
      lon,
      city: loc?.city ?? '',
      country: loc?.country ?? '',
      preview: img.preview ?? img.thumbnail ?? '', // preview = larger still; thumbnail fallback
      thumb: img.thumbnail ?? img.preview ?? '',
      detail: w?.urls?.detail ?? '', // public windy.com page (these cams are opt-in/public)
      views: Number(w?.viewCount) || 0,
    })
  }
  return out
}
// self-check lives in tests/windy-core.test.mjs (no Node-only __main__ block — this
// module is browser-bundled, where `process` is undefined and would crash app init).
