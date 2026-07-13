// Curated CONFLICT ZONES: indicative shaded areas (not precise front lines), sourced from
// public conflict tracking (ACLED/CFR-style trackers). Static data, no network feed.
// asOf marks when each zone's status/note was last checked against public reporting.
//
// ponytail: data lives in plain .mjs (not .ts) so tests/zones-data.test.mjs can `node --test`
// import it directly — matches how tests/*.test.mjs exercise every other data-shaped module in
// this repo (see tests/aoi-geom.test.mjs, tests/global-infra.test.mjs). zones.ts imports this
// file straight and casts to a local TS type; no separate zones-data.ts re-export wrapper.

/** @typedef {'ACTIVE'|'CONTESTED'|'DISPUTED'} ZoneStatus */
/**
 * @typedef {Object} ConflictZone
 * @property {string} id
 * @property {string} name
 * @property {ZoneStatus} status
 * @property {string} note
 * @property {string} asOf
 * @property {[number, number][]} ring
 */

/** @type {ConflictZone[]} */
export const ZONES_DATA = [
  // -- ACTIVE CONFLICT ---------------------------------------------------------
  {
    id: 'ukraine-east',
    name: 'Ukraine Eastern Front',
    status: 'ACTIVE',
    note: 'Grinding front-line combat across Donetsk/Luhansk oblasts in the Russia-Ukraine war.',
    asOf: '2026-07',
    ring: [[36.0, 49.5], [38.5, 50.2], [40.0, 49.0], [39.5, 47.5], [37.5, 47.0], [36.0, 48.0]],
  },
  {
    id: 'gaza',
    name: 'Gaza',
    status: 'ACTIVE',
    note: 'Israel-Hamas war: active combat and blockade conditions across the Gaza Strip.',
    asOf: '2026-07',
    ring: [[34.2, 31.6], [34.55, 31.58], [34.55, 31.4], [34.5, 31.25], [34.22, 31.3]],
  },
  {
    id: 'sudan',
    name: 'Sudan',
    status: 'ACTIVE',
    note: 'Sudanese Armed Forces vs. Rapid Support Forces civil war, mass displacement.',
    asOf: '2026-07',
    ring: [[22.0, 19.0], [30.0, 19.0], [36.0, 15.0], [34.0, 10.0], [26.0, 8.0], [22.0, 12.0]],
  },
  {
    id: 'myanmar',
    name: 'Myanmar',
    status: 'ACTIVE',
    note: 'Civil war between the military junta and allied ethnic/resistance armed forces.',
    asOf: '2026-07',
    ring: [[92.0, 26.0], [98.0, 25.0], [99.0, 20.0], [97.0, 16.0], [93.0, 17.0], [92.0, 21.0]],
  },
  {
    id: 'drc-east',
    name: 'Eastern DRC',
    status: 'ACTIVE',
    note: 'M23 and allied militia offensives against Congolese forces in North/South Kivu.',
    asOf: '2026-07',
    ring: [[27.0, 1.0], [29.5, 0.5], [30.0, -2.0], [28.5, -3.0], [27.0, -1.5]],
  },
  {
    id: 'sahel-tri-border',
    name: 'Sahel Tri-Border (Mali/Burkina Faso/Niger)',
    status: 'ACTIVE',
    note: 'Jihadist insurgency (JNIM/ISGS) and military juntas across the tri-border area.',
    asOf: '2026-07',
    ring: [[-4.0, 17.0], [1.0, 16.5], [3.0, 13.0], [0.0, 12.0], [-3.0, 13.5]],
  },
  {
    id: 'red-sea-corridor',
    name: 'Red Sea / Bab-el-Mandeb Shipping Corridor',
    status: 'ACTIVE',
    note: 'Houthi missile/drone attacks on commercial shipping transiting Bab-el-Mandeb.',
    asOf: '2026-07',
    ring: [[34.0, 20.0], [38.0, 19.0], [43.5, 13.0], [43.0, 12.0], [40.0, 15.0], [35.0, 18.0]],
  },
  {
    id: 'hormuz-tension',
    name: 'Strait of Hormuz Tension Zone',
    status: 'ACTIVE',
    note: 'Elevated Iran-linked tanker seizures and naval tension following the 2026 Iran crisis.',
    asOf: '2026-07',
    ring: [[54.5, 27.2], [57.0, 27.5], [58.0, 26.0], [57.0, 25.0], [55.0, 25.2], [54.0, 26.3]],
  },
  {
    id: 'somalia-south-central',
    name: 'Somalia (South-Central)',
    status: 'ACTIVE',
    note: 'Al-Shabaab insurgency and offensive operations across south-central Somalia.',
    asOf: '2026-07',
    ring: [[41.0, 5.0], [46.0, 4.5], [47.0, 1.0], [45.0, -1.0], [42.0, 0.0], [41.0, 2.5]],
  },
  {
    id: 'haiti-portauprince',
    name: 'Haiti (Port-au-Prince)',
    status: 'ACTIVE',
    note: 'Gang warfare and collapse of state authority in and around Port-au-Prince.',
    asOf: '2026-07',
    ring: [[-72.6, 18.65], [-72.2, 18.7], [-72.1, 18.45], [-72.4, 18.35], [-72.6, 18.45]],
  },

  // -- CONTESTED ----------------------------------------------------------------
  {
    id: 'taiwan-strait',
    name: 'Taiwan Strait',
    status: 'CONTESTED',
    note: 'PLA military pressure, incursions, and blockade-style exercises around Taiwan.',
    asOf: '2026-07',
    ring: [[117.0, 26.0], [121.0, 25.5], [122.0, 23.0], [120.0, 22.0], [117.5, 23.5]],
  },
  {
    id: 'south-china-sea-spratlys',
    name: 'South China Sea (Spratly Islands)',
    status: 'CONTESTED',
    note: 'Overlapping sovereignty claims and naval standoffs around the Spratly Islands.',
    asOf: '2026-07',
    ring: [[111.0, 12.0], [115.0, 11.0], [117.0, 8.0], [115.0, 6.0], [112.0, 7.0], [111.0, 9.5]],
  },
  {
    id: 'kashmir-loc',
    name: 'Kashmir Line of Control',
    status: 'CONTESTED',
    note: 'India-Pakistan Line of Control ceasefire violations and cross-border shelling.',
    asOf: '2026-07',
    ring: [[73.5, 36.0], [77.0, 35.5], [78.0, 33.0], [76.0, 32.0], [74.0, 33.0], [73.0, 34.5]],
  },

  // -- DISPUTED -------------------------------------------------------------------
  {
    id: 'western-sahara',
    name: 'Western Sahara',
    status: 'DISPUTED',
    note: 'Morocco-Polisario Front territorial dispute over Western Sahara sovereignty.',
    asOf: '2026-07',
    ring: [[-17.0, 27.5], [-11.0, 27.5], [-8.0, 24.0], [-9.0, 20.5], [-14.0, 21.0], [-17.0, 24.0]],
  },
  {
    id: 'essequibo',
    name: 'Essequibo',
    status: 'DISPUTED',
    note: 'Venezuela-Guyana dispute over the oil-rich Essequibo region.',
    asOf: '2026-07',
    ring: [[-61.0, 8.0], [-57.5, 8.0], [-57.0, 5.0], [-58.5, 1.5], [-60.5, 2.0], [-61.5, 5.0]],
  },
  {
    id: 'golan-heights',
    name: 'Golan Heights',
    status: 'DISPUTED',
    note: 'Israeli-occupied Golan Heights, disputed under international law amid Syria border tension.',
    asOf: '2026-07',
    ring: [[35.65, 33.3], [35.95, 33.15], [35.9, 32.65], [35.65, 32.75], [35.6, 33.0]],
  },
]
