// PURE core for the IODA net-outages layer (outages.ts): turn an IODA
// /outages/summary response into map pins [{id,name,score,lat,lon}].
//
// Source: IODA (Internet Outage Detection & Analysis, Georgia Tech) v2 API,
// keyless. GET /v2/outages/summary?entityType=country&from=<epoch>&until=<epoch>
// returns `data: [{ scores: {..., overall}, event_cnt, entity: {code,name,type} }]`
// already sorted desc by `scores.overall` (verified by curl 2026-07-13). We map
// entity.code -> a hand-maintained lat/lon centroid (IODA has no coordinates in
// this response); countries missing from the centroid map are skipped.

/**
 * @typedef {Object} IodaEntry
 * @property {{overall?: number}} [scores]
 * @property {{code?: string, name?: string}} [entity]
 */
/**
 * @typedef {Object} OutagePin
 * @property {string} id      // ISO2 country code
 * @property {string} name
 * @property {number} score   // scores.overall
 * @property {number} lat
 * @property {number} lon
 */

const MAX_PINS = 60

/** ISO2 -> [lat, lon] centroid, ~60 outage-prone / high-population countries. */
export const COUNTRY_CENTROIDS = {
  IR: [32.4279, 53.688], SY: [34.8021, 38.9968], SD: [12.8628, 30.2176],
  SS: [6.877, 31.307], MM: [21.9162, 95.956], ET: [9.145, 40.4897],
  YE: [15.5527, 48.5164], UA: [48.3794, 31.1656], RU: [61.524, 105.3188],
  CN: [35.8617, 104.1954], IN: [20.5937, 78.9629], PK: [30.3753, 69.3451],
  IQ: [33.2232, 43.6793], LY: [26.3351, 17.2283], VE: [6.4238, -66.5897],
  CU: [21.5218, -77.7812], KP: [40.3399, 127.5101], AF: [33.9391, 67.71],
  SO: [5.1521, 46.1996], CF: [6.6111, 20.9394], TD: [15.4542, 18.7322],
  NE: [17.6078, 8.0817], ML: [17.5707, -3.9962], BF: [12.2383, -1.5616],
  CM: [7.3697, 12.3547], CD: [-4.0383, 21.7587], CG: [-0.228, 15.8277],
  NG: [9.082, 8.6753], EG: [26.8206, 30.8025], DZ: [28.0339, 1.6596],
  MA: [31.7917, -7.0926], TN: [33.8869, 9.5375], SA: [23.8859, 45.0792],
  JO: [30.5852, 36.2384], LB: [33.8547, 35.8623], IL: [31.0461, 34.8516],
  PS: [31.9522, 35.2332], TR: [38.9637, 35.2433], AZ: [40.1431, 47.5769],
  BY: [53.7098, 27.9534], KZ: [48.0196, 66.9237], UZ: [41.3775, 64.5853],
  TM: [38.9697, 59.5563], TJ: [38.861, 71.2761], KG: [41.2044, 74.7661],
  BD: [23.685, 90.3563], LK: [7.8731, 80.7718], NP: [28.3949, 84.124],
  TH: [15.87, 100.9925], KH: [12.5657, 104.991], LA: [19.8563, 102.4955],
  VN: [14.0583, 108.2772], PH: [12.8797, 121.774], ID: [-0.7893, 113.9213],
  MZ: [-18.6657, 35.5296], ZW: [-19.0154, 29.1549], ZM: [-13.1339, 27.8493],
  AO: [-11.2027, 17.8739], GN: [9.9456, -9.6966], HT: [18.9712, -72.2852],
}

/**
 * Turn an IODA outages/summary payload into sorted, centroid-joined pins.
 * Malformed input (no data array, missing code/score, unknown country) is
 * skipped, never thrown.
 *
 * @param {{data?: IodaEntry[]}} summaryJson
 * @param {Record<string, [number, number]>} [centroids]
 * @returns {OutagePin[]} pins sorted by score desc, capped at 60
 */
export function normalizeIoda(summaryJson, centroids = COUNTRY_CENTROIDS) {
  const rows = summaryJson && Array.isArray(summaryJson.data) ? summaryJson.data : []
  /** @type {OutagePin[]} */
  const pins = []

  for (const row of rows) {
    const code = row && row.entity && row.entity.code
    const name = row && row.entity && row.entity.name
    const score = row && row.scores && row.scores.overall
    if (!code || !name || !Number.isFinite(score)) continue
    const centroid = centroids[code]
    if (!centroid) continue
    const [lat, lon] = centroid
    pins.push({ id: code, name, score, lat, lon })
  }

  return pins.sort((a, b) => b.score - a.score).slice(0, MAX_PINS)
}
