// Pure kiosk/ops-wall tour logic (no cesium, no DOM): flatten CITIES -> a flat
// POI tour and format the on-screen cycle ticker. Cesium flyTo + fullscreen live
// in kiosk.ts; this stays testable.
/**
 * @typedef {{ name: string, lon: number, lat: number, range: number }} Poi
 * @typedef {{ name: string, pois: Poi[] }} City
 * @typedef {{ city: string, name: string, lon: number, lat: number, range: number }} Stop
 */

/**
 * Flatten every POI across cities into one ordered tour, tagged with its city.
 * @param {City[]} cities
 * @returns {Stop[]}
 */
export function buildTour(cities) {
  return cities.flatMap((c) =>
    c.pois.map((p) => ({ city: c.name, name: p.name, lon: p.lon, lat: p.lat, range: p.range })),
  )
}

/**
 * Minimal ticker text for the Nth (0-based, wrapping, negatives tolerated) stop.
 * @param {Stop[]} tour
 * @param {number} idx
 * @returns {string}
 */
export function tourLabel(tour, idx) {
  const n = tour.length
  if (n === 0) return 'OPS-WALL'
  const i = ((idx % n) + n) % n
  const s = tour[i]
  return `OPS-WALL   ${s.city} · ${s.name}   [${i + 1}/${n}]`
}
