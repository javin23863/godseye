// Curated PUBLIC DOT traffic cameras (CAP-20, DS-06). Snapshot stills only —
// documented public/open endpoints, no auth, no private streams. Each serves a
// plain .jpg refreshed ~1/min (matches L-03: "1 frame/minute, not real-time").
//
// HONEST CAVEAT: these are volunteer/agency endpoints that rotate IDs and go
// down without notice — any individual URL MAY 404. The layer degrades to a
// "NO FEED / STREET VIEW FALLBACK" placeholder per cam; nothing is fabricated.
export interface Cam {
  id: string
  name: string
  lat: number
  lon: number
  headingDeg: number // 0 = north, 90 = east (approx bearing the cam looks)
  fovDeg: number
  rangeM: number
  snapshotUrl: string // hotlinkable still .jpg
}

// Austin / TxDOT (demoed city, DS-06) via the City of Austin open CCTV image
// service (cctv.austinmobility.io/image/<id>.jpg), plus WSDOT Seattle stills
// (images.wsdot.wa.gov) which are long-lived public jpgs. Headings/FOV are
// hand-estimated framing hints — tune with the pose sliders (auto-cal is WIP).
export const CAMS: Cam[] = [
  {
    id: 'atx-congress',
    name: 'AUSTIN · CONGRESS AVE BRIDGE',
    lat: 30.2622,
    lon: -97.7452,
    headingDeg: 0,
    fovDeg: 55,
    rangeM: 350,
    snapshotUrl: 'https://cctv.austinmobility.io/image/272.jpg',
  },
  {
    id: 'atx-mopac',
    name: 'AUSTIN · MOPAC @ CESAR CHAVEZ',
    lat: 30.2743,
    lon: -97.7714,
    headingDeg: 20,
    fovDeg: 50,
    rangeM: 500,
    snapshotUrl: 'https://cctv.austinmobility.io/image/113.jpg',
  },
  {
    id: 'atx-i35',
    name: 'AUSTIN · I-35 @ 15TH ST',
    lat: 30.2758,
    lon: -97.7331,
    headingDeg: 200,
    fovDeg: 45,
    rangeM: 450,
    snapshotUrl: 'https://cctv.austinmobility.io/image/58.jpg',
  },
  {
    id: 'sea-i5-yale',
    name: 'SEATTLE · I-5 @ YALE AVE',
    lat: 47.6205,
    lon: -122.3277,
    headingDeg: 180,
    fovDeg: 40,
    rangeM: 600,
    snapshotUrl: 'https://images.wsdot.wa.gov/nw/005vc16811.jpg',
  },
  {
    id: 'sea-520',
    name: 'SEATTLE · SR-520 @ MONTLAKE',
    lat: 47.6448,
    lon: -122.3045,
    headingDeg: 90,
    fovDeg: 45,
    rangeM: 550,
    snapshotUrl: 'https://images.wsdot.wa.gov/nw/520vc00120.jpg',
  },
  {
    id: 'sea-i90',
    name: 'SEATTLE · I-90 @ RAINIER AVE',
    lat: 47.5905,
    lon: -122.3,
    headingDeg: 100,
    fovDeg: 50,
    rangeM: 500,
    snapshotUrl: 'https://images.wsdot.wa.gov/nw/090vc00468.jpg',
  },
]
