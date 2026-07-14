// Provenance registry (foundation for the sourced brief + credibility badges):
// per-layer source, freshness, and known-limits, keyed by the layer ids the app
// records/renders. Pure data — no DOM, no cesium. Facts are lifted verbatim from
// docs/03-data-sources.md + README.md (do not invent providers/limits here).

export interface Source {
  /** Human label for the layer (matches the DATA LAYERS panel row). */
  label: string
  /** Named provider / derivation. */
  provider: string
  /** Docs / API landing URL. */
  url: string
  /** Cadence + recency character, e.g. "live WS", "~90s poll", "24h window". */
  freshness: string
  /** Known free-tier / coverage caveats an operator should see on the badge. */
  limits: string
}

/** A source badge for the UI — the registry record minus the docs url. */
export type SourceBadge = Omit<Source, 'url'>

// Keyed by the layer ids used across recorder.record()/addLayerRow() (DS-xx in
// docs/03-data-sources.md). gpsjam + aoi are derived layers (no direct feed).
export const SOURCES: Record<string, Source> = {
  flights: {
    label: 'FLIGHTS',
    provider: 'OpenSky Network',
    url: 'https://opensky-network.org/',
    freshness: '~90s poll (credit-limited /states/all)',
    limits: 'Free non-commercial, OAuth2; 4,000 credits/day; history ceiling 1h',
  },
  military: {
    label: 'MILITARY',
    provider: 'adsb.lol / airplanes.live (mil mirrors)',
    url: 'https://api.adsb.lol/v2/mil',
    freshness: '~10–30s poll',
    limits: 'Free, no key, ODbL fair-use; ADS-B Exchange has no free API since 2023',
  },
  satellites: {
    label: 'SATELLITES',
    provider: 'CelesTrak GP + satellite.js SGP4',
    url: 'https://celestrak.org/NORAD/elements/',
    freshness: 'TLEs refreshed a few times/day, propagated client-side',
    limits: 'Free, no key; cache GP data ≥ 2h (CelesTrak throttle); untracked sats missing',
  },
  earthquakes: {
    label: 'EARTHQUAKES 24H',
    provider: 'USGS FDSN GeoJSON feeds',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/',
    freshness: '24h window, feed regenerates every minute',
    limits: 'Free, no key; poll ≥ 60s',
  },
  ships: {
    label: 'SHIPS',
    provider: 'aisstream.io (AIS WebSocket)',
    url: 'https://aisstream.io/documentation',
    freshness: 'live WS (realtime-only)',
    limits: 'Free key, non-commercial; zero backfill — dropped connections are permanent gaps; no Gulf receiver guarantee',
  },
  gpsjam: {
    label: 'GPS JAMMING',
    provider: 'Derived from airplanes.live NIC/NACp (gpsjam.org method)',
    url: 'https://gpsjam.org/',
    freshness: 'on-demand scan (opt-in 3-min auto-scan)',
    limits: 'Derived, no feed; needs nic/nac_p (OpenSky lacks them); gpsjam.org publishes daily maps only, no realtime API',
  },
  oil: {
    label: 'OIL RISK MATRIX',
    provider: 'FRED daily Brent (DCOILBRENTEU) / WTI (DCOILWTICO)',
    url: 'https://fred.stlouisfed.org/',
    freshness: 'daily closes, ~3–5 business-day publication lag',
    limits: 'Free, no key (CSV); forward-fill holiday blanks; spread computed client-side',
  },
  weather: {
    label: 'NEXRAD WEATHER',
    provider: 'NOAA NEXRAD via Iowa Env. Mesonet tiles',
    url: 'https://mesonet.agron.iastate.edu/',
    freshness: '~5-min radar refresh',
    limits: 'Free, no key (IEM fair use); US coverage only — RainViewer for global',
  },
  traffic: {
    label: 'STREET TRAFFIC',
    provider: 'OpenStreetMap Overpass (roads → particle system)',
    url: 'https://overpass-api.de/',
    freshness: 'static geometry, cached (on-demand scan)',
    limits: 'Free, no key; Overpass fair use (~2 concurrent); hard particle cap to avoid browser crash',
  },
  boundaries: {
    label: 'BOUNDARIES',
    provider: 'Natural Earth admin-0',
    url: 'https://www.naturalearthdata.com/',
    freshness: 'static bundled asset (no polling)',
    limits: 'Free, no key, public domain; no runtime dependency',
  },
  darkvessel: {
    label: 'DARK VESSELS',
    provider: 'Derived from recorded AIS gaps (ships history)',
    url: 'https://aisstream.io/documentation',
    freshness: 'on-demand scan over the last 6h of recorded ships',
    limits: 'Derived, no feed; only as complete as the AIS recording — receiver gaps read as false "dark" events',
  },
  gate: {
    label: 'HORMUZ GATE',
    provider: 'Derived (geometric crossing tripwire × ships history)',
    url: 'https://github.com/javin23863/godseye',
    freshness: 'on-demand replay over recorded ship tracks',
    limits: 'Derived geometry, no feed; crossing tally bounded by AIS coverage of the recorded window',
  },
  infra: {
    label: 'CRITICAL INFRA',
    provider: 'Curated (godseye scene manifest)',
    url: 'https://github.com/javin23863/godseye',
    freshness: 'static curated dataset',
    limits: 'Hand-curated MVP (Gulf pipelines/chokepoints/refineries/desalination); not a live feed',
  },
  cctv: {
    label: 'CCTV MESH',
    provider: 'City/DOT open-data camera registries (Austin, Caltrans, …)',
    url: 'https://data.austintexas.gov/',
    freshness: '~1 frame/min stills',
    limits: 'Mostly no key; public DOT/municipal cams only (no private cams); many serve no CORS image',
  },
  aoi: {
    label: 'SAT AOI LINES',
    provider: 'Derived (CelesTrak TLEs × curated AOIs)',
    url: 'https://celestrak.org/NORAD/elements/',
    freshness: 'recomputed per satellite pass (intermittent)',
    limits: 'Derived geometry, no feed; fan lines only when a watchlist bird clears the elevation mask',
  },
}

/** Registry lookup by layer id; undefined for unknown/unregistered layers. */
export function sourceFor(key: string): Source | undefined {
  return SOURCES[key]
}

/** Badges for the active layers, in the given order; unknown keys are skipped. */
export function describeSources(activeKeys: string[]): SourceBadge[] {
  const badges: SourceBadge[] = []
  for (const key of activeKeys) {
    const s = SOURCES[key]
    if (s) badges.push({ label: s.label, provider: s.provider, freshness: s.freshness, limits: s.limits })
  }
  return badges
}
