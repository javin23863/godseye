// Pure normalizers for aircraft feeds — plain .mjs so `node --test` runs them directly.

/**
 * OpenSky /states/all (DS-02). State vector array indices per
 * https://openskynetwork.github.io/opensky-api/rest.html
 * @param {{states?: Array<any[]> | null}} body
 * @returns {Array<{id: string, callsign: string, lon: number, lat: number, altM: number, heading: number}>}
 */
export function normalizeOpenSky(body) {
  const out = []
  for (const s of body.states ?? []) {
    const [icao24, callsign, , , , lon, lat, baroAlt, onGround, , trueTrack, , , geoAlt] = s
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || onGround) continue
    out.push({
      id: `os-${icao24}`,
      callsign: (callsign ?? '').trim() || String(icao24).toUpperCase(),
      lon,
      lat,
      altM: Number.isFinite(geoAlt) ? geoAlt : Number.isFinite(baroAlt) ? baroAlt : 0,
      heading: Number.isFinite(trueTrack) ? trueTrack : 0,
    })
  }
  return out
}

/**
 * adsb.lol /v2/mil (DS-03). alt_baro may be the string "ground".
 * @param {{ac?: Array<{hex?: string, flight?: string, r?: string, lat?: number, lon?: number, alt_baro?: number|string, alt_geom?: number, track?: number}>}} body
 * @returns {Array<{id: string, callsign: string, lon: number, lat: number, altM: number, heading: number}>}
 */
export function normalizeAdsbMil(body) {
  const out = []
  for (const a of body.ac ?? []) {
    if (!Number.isFinite(a.lon) || !Number.isFinite(a.lat) || a.alt_baro === 'ground') continue
    const altFt = Number.isFinite(a.alt_geom) ? a.alt_geom : Number.isFinite(a.alt_baro) ? a.alt_baro : 0
    out.push({
      id: `mil-${a.hex ?? `${a.lon},${a.lat}`}`,
      callsign: (a.flight ?? '').trim() || (a.r ?? '').trim() || (a.hex ?? '').toUpperCase(),
      lon: a.lon,
      lat: a.lat,
      altM: altFt * 0.3048,
      heading: Number.isFinite(a.track) ? a.track : 0,
    })
  }
  return out
}
