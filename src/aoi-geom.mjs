// Pure geometry for satellite-to-ground topocentric elevation angle (CAP-12/AC-05).
// ponytail: WGS84 sphere approximation (R=6371km), not the full ellipsoid — plenty accurate
// for a 20deg-mask visibility check; upgrade to ellipsoidal geodesy if sub-degree matters later.
const R_EARTH_KM = 6371

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/**
 * lat/lon (degrees) + radius (km, default Earth's) -> ECEF [x,y,z] km, spherical Earth.
 * @param {number} lat
 * @param {number} lon
 * @param {number} [radius]
 * @returns {[number, number, number]}
 */
export function llToEcefKm(lat, lon, radius = R_EARTH_KM) {
  const la = toRad(lat)
  const lo = toRad(lon)
  return [radius * Math.cos(la) * Math.cos(lo), radius * Math.cos(la) * Math.sin(lo), radius * Math.sin(la)]
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function norm(a) {
  return Math.sqrt(dot(a, a))
}
function unit(a) {
  const n = norm(a)
  return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n]
}

/**
 * Topocentric elevation angle (degrees) of a satellite above the local horizon at a ground point.
 * Negative = below horizon. 90 = directly overhead.
 * @param {[number, number, number]} satEcefKm satellite position, ECEF km
 * @param {number} groundLat degrees
 * @param {number} groundLon degrees
 * @returns {number} degrees
 */
export function elevationAngle(satEcefKm, groundLat, groundLon) {
  const ground = llToEcefKm(groundLat, groundLon)
  const up = unit(ground) // sphere: local normal == radial direction from Earth's center
  const los = unit(sub(satEcefKm, ground))
  const sinEl = Math.max(-1, Math.min(1, dot(los, up)))
  return (Math.asin(sinEl) * 180) / Math.PI
}
