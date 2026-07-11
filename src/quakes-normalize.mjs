// Pure normalize for USGS FDSN GeoJSON (DS-08) — plain .mjs so `node --test` runs it directly.
/**
 * @param {{features?: Array<{id?: string, geometry?: {coordinates?: number[]}, properties?: {mag?: number|null, place?: string|null, time?: number}}>}} geojson
 * @returns {Array<{id: string, lon: number, lat: number, depthKm: number, mag: number, place: string, time: number}>}
 */
export function normalizeQuakes(geojson) {
  const out = []
  for (const f of geojson.features ?? []) {
    const c = f.geometry?.coordinates
    if (!c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue
    out.push({
      id: f.id ?? `${c[0]},${c[1]},${f.properties?.time ?? 0}`,
      lon: c[0],
      lat: c[1],
      depthKm: Number.isFinite(c[2]) ? c[2] : 0,
      mag: f.properties?.mag ?? 0,
      place: f.properties?.place ?? 'unknown',
      time: f.properties?.time ?? 0,
    })
  }
  return out
}
