// Ground coverage wedge for a camera (CAP-20 COVERAGE control): apex at the
// camera, arc swept across the field of view out to rangeM. Local
// equirectangular offset (meters -> deg).
// ponytail: flat-earth approx — fine at city scale (<~50km); swap for a
// geodesic destination-point if a cam ever needs a continent-wide footprint.
const M_PER_DEG_LAT = 111320

/** [lon,lat] displaced `north`/`east` metres from (lat,lon). */
export function offsetMeters(lat, lon, north, east) {
  const dLat = north / M_PER_DEG_LAT
  const dLon = east / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return [lon + dLon, lat + dLat]
}

/**
 * Coverage polygon ring: apex + arc across the FOV + back to apex.
 * heading 0 = due north, +90 = due east. Returns [lon,lat] pairs, ring closed.
 */
export function footprintWedge(lat, lon, headingDeg, fovDeg, rangeM, segments = 24) {
  const apex = [lon, lat]
  const ring = [apex]
  const half = fovDeg / 2
  const n = Math.max(2, segments)
  for (let i = 0; i <= n; i++) {
    const bearing = headingDeg - half + (fovDeg * i) / n
    const rad = (bearing * Math.PI) / 180
    ring.push(offsetMeters(lat, lon, Math.cos(rad) * rangeM, Math.sin(rad) * rangeM))
  }
  ring.push(apex) // close back to apex
  return ring
}
