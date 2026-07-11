// Curated ground AOIs + imaging-satellite watchlist (CAP-12/CAP-29). Static; Iran/Hormuz theme.
export interface Aoi {
  name: string
  lat: number
  lon: number
}

export const AOI_LIST: Aoi[] = [
  { name: 'Natanz', lat: 33.7225, lon: 51.7269 },
  { name: 'Fordow', lat: 34.8847, lon: 50.9958 },
  { name: 'Bushehr', lat: 28.8296, lon: 50.888 },
  { name: 'Strait of Hormuz', lat: 26.566, lon: 56.25 },
  { name: 'Bandar Abbas', lat: 27.1833, lon: 56.2667 },
]

// CAP-29 named imaging birds; matched case-insensitively as name substrings against whatever
// the CelesTrak 'active' catalog actually contains.
export const IMAGING_WATCHLIST = ['PLEIADES', 'WORLDVIEW', 'SPOT', 'GAOFEN', 'CAPELLA', 'SKYSAT', 'ICEYE']
