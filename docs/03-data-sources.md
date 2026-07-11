# 03 — Data Sources (Feed Catalog)

Feed catalog for the godseye rebuild. One entry per data source ID (DS-xx, canonical — cross-referenced by `01-functional-spec.md` CAP-xx, `04-ui-spec.md` UI-xx, `02-architecture.md` STK-xx). Each entry states what the original app evidently used (with citation), and the recommended provider(s) for the rebuild (API shape, free-tier limits, key requirement, paid cost, fallback). Rebuild recommendations are **proposals** unless cited.

Legend: `key: none` = anonymous access. `[SPECULATIVE]` = not CONFIRMED in the evidence base. Items marked *(proposal)* are rebuild design decisions, not evidence.

---

## Summary table

| ID | Layer | Original app used (evidenced) | Rebuild primary | Key? |
|----|-------|-------------------------------|-----------------|------|
| DS-01 | 3D basemap | Google Photorealistic 3D Tiles | Google Map Tiles API → CesiumJS | yes |
| DS-02 | Commercial flights | OpenSky Network (named on-screen) | OpenSky REST `/states/all` | yes (OAuth2) |
| DS-03 | Military flights | adsb.lol (named on-screen) | adsb.lol `/v2/mil` | none |
| DS-04 | Satellites | CelesTrak (named on-screen) | CelesTrak GP API + satellite.js SGP4 | none |
| DS-05 | Maritime / AIS | AIS, provider never named | aisstream.io WebSocket | yes (free) |
| DS-06 | CCTV cameras | Austin TX public traffic cams | DOT open-data camera endpoints | mostly none |
| DS-07 | Street traffic geometry | OpenStreetMap (named on-screen) | OSM Overpass API | none |
| DS-08 | Earthquakes | USGS (named on-screen) | USGS FDSN GeoJSON feeds | none |
| DS-09 | Weather radar | NOAA NEXRAD (named on-screen) | IEM NEXRAD tiles (US) + RainViewer (global) | none |
| DS-10 | Bikeshare | GBFS (named on-screen) | GBFS city feeds | none |
| DS-11 | GPS jamming | Derived from ADS-B NIC/NACp | Derive from adsb.lol/airplanes.live `nic`/`nac_p` | none |
| DS-12 | Airspace closures | NOTAM-like, never named | Curated scene polygons (MVP); FAA NOTAM API (US) | varies |
| DS-13 | Internet outages | Never named (NetBlocks-style) | Cloudflare Radar API | yes (free) |
| DS-14 | Commercial SAR | Capella Space (named) | Capella Open Data + Sentinel-1 + Umbra open data | free acct |
| DS-15 | Commercial optical | Vantor (Mantis/Raptor), Planet (named) | Sentinel-2 + NASA GIBS | free acct / none |
| DS-16 | OSINT event DB (Ground Truth Cards) | Curated by AI agent swarm | Manual curation (MVP) + GDELT/ACLED/ReliefWeb | mixed |
| DS-17 | Oil futures prices | Never named | FRED `DCOILBRENTEU`/`DCOILWTICO` CSV (verified working) | none |
| DS-18 | Vessel registry | Never shown (registry join implied) | GFW Vessels API v3 + Equasis/GISIS deep links | yes (free) |
| DS-19 | News / wire | Reuters, BBC, Al Jazeera, ToI, WSJ etc. shown in-scene | GDELT + geocoded RSS + GDACS | none |
| DS-20 | Adtech geolocation | Concept only, never a shown layer | **Descoped** (no public/legal source) | — |
| DS-21 | Country boundaries | Never named | Natural Earth (static asset) | none |
| DS-22 | Fires / natural events | Not in original (roadmap) | NASA FIRMS + EONET | free key / none |
| DS-23 | AIS/track historical archive *(new)* | Self-recorded, record-first | Own day-chunk archiver; GFW 4Wings backfill | — |
| DS-24 | Street View imagery, CCTV fallback *(new)* | Google Street View (named as fallback on-screen) | Google Street View Static API | yes |

---

## DS-01 — 3D basemap / photorealistic globe

- **Original used:** Google Photorealistic 3D Tiles, streamed via Cesium ion into CesiumJS. Named by Sidhu (ex-Google Maps PM on that team); "GOOGLE 3D" basemap button in video; "Google Maps Data" attribution in repo hero. `vid_rXvU7bPJ8n4 [01:01][09:24]`, `vid_7HEUCLc7aL8 frame_11`, `repo-asset:god-view-hero-crt.jpg`, https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator, https://cesium.com/blog/2023/10/26/photorealistic-3d-tiles-in-cesium-ion/
- **Rebuild primary:** Google Map Tiles API — Photorealistic 3D Tiles. API shape: `GET https://tile.googleapis.com/v1/3dtiles/root.json?key=KEY`, consumed in CesiumJS via `createGooglePhotorealistic3DTileset()` (or via a Cesium ion asset). Renderer must keep Google attribution visible.
- **Free tier / key:** API key required. Google Maps Platform monthly free usage credit, then metered per root-tileset request/session (see current GMP pricing — do not hardcode; sessions are the cost driver on a globe app).
- **Paid:** Pay-as-you-go beyond the monthly credit.
- **Fallback:** Cesium World Terrain + Bing/Sentinel-2 imagery on the Cesium ion free tier (non-photorealistic); flat blue-marble + bathymetry texture for the non-3D tracking mode (original's texture source unattributed — [SPECULATIVE] which one; NASA Blue Marble is the free equivalent). *(proposal)*

## DS-02 — Commercial flights

- **Original used:** OpenSky Network. Named in narration ("use OpenSky to load in live flight data... 6.7K flights", `vid_rXvU7bPJ8n4 [03:15]`) and **on-screen** in the DATA LAYERS row subtitle "OpenSky Network · never" (4K re-extract, `vid_rXvU7bPJ8n4 frame_07 [02:32]`, `vid_CHLFl26p7Po [08:02]`; gap-finding gapfill-2). Article: "7,000+ live aircraft positions" (https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator).
- **Rebuild primary:** OpenSky REST. API shape: `GET https://opensky-network.org/api/states/all[?lamin&lomin&lamax&lomax]`, OAuth2 client-credentials token.
- **Free tier / key:** Free for non-commercial use; registration required. Credit system (verified: https://openskynetwork.github.io/opensky-api/rest.html): 4,000 credits/day standard, 8,000 if you run a feeder; global `/states/all` = 4 credits → ~1 poll/86 s sustained; bbox ≤ 25 sq° = 1 credit → ~21 s cadence. **History ceiling: 1 hour** (`t < now-3600` → HTTP 400). Deep history is institutional-researcher Trino access only.
- **Paid:** No self-serve paid tier; commercial use requires an OpenSky agreement.
- **Fallback:** adsb.lol `/v2` (no key, ODbL), airplanes.live `https://api.airplanes.live/v2/...` (no key), adsb.fi. *(proposal)*

## DS-03 — Military flights

- **Original used:** adsb.lol. Narrated as "this website called ADSB... crowdsourced data to track all the military planes" (`vid_rXvU7bPJ8n4 [04:30]`), resolved **on-screen** to lowercase "adsb.lol · never" in the DATA LAYERS subtitle (4K re-extract, `vid_rXvU7bPJ8n4 frame_07 [02:32]`, `vid_CHLFl26p7Po [08:02]`; gapfill-2). Rendered orange (`vid_rXvU7bPJ8n4 [04:39]`, video-only).
- **Rebuild primary:** adsb.lol military endpoint. API shape: `GET https://api.adsb.lol/v2/mil` (JSON aircraft array with hex, callsign, lat/lon, alt, `nic`/`nac_p`). No key. ODbL license — attribute.
- **Free tier / key:** Free, no key, fair-use rate limits (be a polite poller; ~1 poll/10–30 s is plenty for a global mil picture). *(proposal cadence)*
- **Paid:** ADS-B Exchange via RapidAPI (paid) — note ADSBx has had **no free API since 2023** (free only if you feed).
- **Fallback:** airplanes.live `/v2/mil`, adsb.fi. The worldview_oss community clone uses airplanes.live.

## DS-04 — Satellites / orbital catalog

- **Original used:** CelesTrak TLEs / NORAD catalog, propagated client-side. Narrated ("this is NORAD", "SL-3 R/B" rocket body, "180+ satellites", `vid_rXvU7bPJ8n4 [02:44][02:54]`) and **on-screen** subtitle "CelesTrak · just now", row count 180, toggle ON (4K re-extract, `vid_rXvU7bPJ8n4 frame_07/frame_08`, `vid_CHLFl26p7Po [08:02]`; gapfill-2). Coverage acknowledged incomplete for untracked spy sats (`vid_0p8o7AeHDzg [03:47]`).
- **Rebuild primary:** CelesTrak GP API. API shape: `GET https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json` (or per-group: `stations`, `gps-ops`, etc.; TLE or OMM JSON). Propagate in-browser with satellite.js (SGP4). Refresh TLEs at most a few times/day — element sets change slowly.
- **Free tier / key:** Free, no key. Respect CelesTrak's cache guidance (don't hammer; cache GP data ≥ 2 h). *(proposal cadence)*
- **Paid:** None needed.
- **Fallback:** Space-Track.org (free account, throttled), N2YO API (free key, hourly transaction caps). Code references: satvis (https://github.com/Flowm/satvis), keeptrack.space, StuffInSpace.

## DS-05 — Maritime / AIS

- **Original used:** AIS beacons (position/heading/speed/flag); **provider never named** on screen or in posts (MarineTraffic appears only in a reader comment; https://www.spatialintelligence.ai/p/one-chokepoint-controls-everything). Vessel dossiers at `vid_7HEUCLc7aL8 frame_02/03`, `vid_ccZzOGnT4Cg frame_05`. **Negative finding (gapfill-2):** the earlier WORLDVIEW DATA LAYERS panel has exactly 8 rows and **no AIS row** — the maritime layer only exists in the later Hormuz-era build; its provider is not recoverable from the panel.
- **Rebuild primary:** aisstream.io. API shape: WebSocket `wss://stream.aisstream.io/v0/stream`; send subscription JSON (API key + bounding boxes + optional MMSI/message-type filters) **within 3 s of connect** or the socket closes (verified: https://aisstream.io/documentation).
- **Free tier / key:** Free API key, non-commercial. **Realtime-only — zero backfill** (verified, gapfill-1): every dropped connection is a permanent archive gap → ingest worker needs auto-reconnect, MMSI+timestamp dedupe on overlap, and explicit gap-marker records so playback renders honest holes. See DS-23 for the archive.
- **Paid:** Datalastic (~€99/mo), MarineTraffic, Spire→Kpler (raw historical AIS).
- **Fallback:** AISHub (free if you feed), Global Fishing Watch (free, derived datasets — analytics, not smooth tracks). *(proposal)*

## DS-06 — CCTV cameras

- **Original used:** Public Austin, TX traffic cameras at ~1 frame/min; on-screen attribution "Austin Transportation & Public Works" (`vid_rXvU7bPJ8n4 [06:44][06:59] frame_16`; article confirms "real traffic camera feeds from Austin, geographically located"). On-screen layer subtitle reads "CCTV Mesh + Street View fallback · never" (gapfill-2) — the fallback mechanism is Street View imagery, see DS-24. Exact Austin endpoint never shown ([SPECULATIVE] data path).
- **Rebuild primary:** City/DOT open-data camera registries. API shape: Austin open data portal (Socrata JSON: traffic-camera dataset with lat/lon + snapshot/stream URL), Caltrans, NY511, WSDOT, FL511, Houston TranStar, UK National Highways — free JSON/XML registries pointing at MJPEG/HLS/still endpoints. Poll stills at the provider's stated refresh (1 frame/min matches the original).
- **Free tier / key:** Mostly no key (Socrata app token recommended for rate-limit headroom).
- **Paid:** None needed.
- **Fallback:** Windy Webcams API v3 for global coverage (free key, attribution + daily call caps). **Do not** use Insecam-style unsecured private cams — public DOT/municipal feeds only.

## DS-07 — Street traffic geometry

- **Original used:** OpenStreetMap road network queried to spawn a simulated traffic **particle system** (not live vehicle telemetry) — narrated (`vid_rXvU7bPJ8n4 [05:36]`), article-confirmed ("rendered as a particle system"), and **on-screen** subtitle "OpenStreetMap · never" (4K re-extract, gapfill-2).
- **Rebuild primary:** OSM Overpass API. API shape: `POST https://overpass-api.de/api/interpreter` with OverpassQL selecting `way[highway~"motorway|trunk|primary|..."]` in a bbox. Load in road-class order (motorway → arterial → residential) with a hard particle cap — the original crashed the browser before adding exactly this ordering (`vid_rXvU7bPJ8n4 [09:39]`).
- **Free tier / key:** Free, no key; fair-use limits (~2 concurrent queries, be gentle). Cache query results — geometry is static.
- **Paid:** None. Self-host Overpass or preprocess Geofabrik extracts if volume grows. *(proposal)*
- **Fallback:** Prebaked GeoJSON road bundles per scene AOI (build-time extraction). *(proposal)*

## DS-08 — Earthquakes

- **Original used:** USGS — "USGS feeds" in Sidhu's own credits and **on-screen** subtitle "USGS · never" (gapfill-2); "Earthquakes (24h)" layer row (`vid_rXvU7bPJ8n4 [08:02] frame_07`, `vid_CHLFl26p7Po [08:04]`).
- **Rebuild primary:** USGS real-time GeoJSON feeds. API shape: `GET https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` (also `all_hour`, `all_week`; https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php).
- **Free tier / key:** Free, no key. Feeds regenerate every minute — poll at ≥ 60 s.
- **Paid:** None.
- **Fallback:** USGS FDSN event query API (`/fdsnws/event/1/query`) for historical windows during playback. *(proposal)*

## DS-09 — Weather radar

- **Original used:** **NOAA NEXRAD** — named on-screen in the layer subtitle "NOAA NEXRAD (globe overlay) · never" (`vid_rXvU7bPJ8n4 frame_07/frame_08`, re-confirmed at 4K in gapfill-2; `vid_CHLFl26p7Po [08:04]`). Never demoed live.
- **Rebuild primary:** NOAA NEXRAD composite via Iowa Environmental Mesonet tile/WMS cache (`mesonet.agron.iastate.edu` `nexrad-n0q` tiles) draped on the globe — free, no key, US coverage, matches the original's named source. *(proposal for the serving path; NEXRAD itself is the evidenced product)*
- **Free tier / key:** Free, no key (IEM fair use; cache tiles, ~5-min radar refresh cadence).
- **Paid:** None needed.
- **Fallback (global coverage):** RainViewer radar tile API (free, no key), Open-Meteo (free non-commercial, no key), OpenWeatherMap tiles (free key tier; used by worldview_oss). *(proposal)*

## DS-10 — Bikeshare

- **Original used:** GBFS — on-screen subtitle "GBFS · never" (gapfill-2); layer row visible, never demoed (`vid_rXvU7bPJ8n4 frame_07/08`, `vid_CHLFl26p7Po [08:04]`).
- **Rebuild primary:** GBFS city feeds. API shape: per-system auto-discovery `gbfs.json` → `station_information.json` + `station_status.json`; system catalog at `https://github.com/MobilityData/gbfs` (systems.csv).
- **Free tier / key:** Free, no key (open standard; per-operator ToS on polling — honor each feed's `ttl` field).
- **Paid:** None.
- **Fallback:** None needed — GBFS is the universe.

## DS-11 — GPS jamming / interference

- **Original used:** Derived from ADS-B navigation-integrity fields (the gpsjam.org method), **not a paid feed** — article: "Every commercial aircraft broadcasts its GPS confidence level... you can map where active GPS interference is happening" (`vid_0p8o7AeHDzg [01:14][01:32] frame_04`, https://www.spatialintelligence.ai/p/the-intelligence-monopoly-is-over). NIC/NACp field naming is analyst gloss, not on the page.
- **Rebuild primary:** Compute it: read `nic` / `nac_p` per aircraft from adsb.lol / airplanes.live `/v2` responses (both expose these; OpenSky's `/states/all` does not), hex-bin (H3 res ~4) the share of low-integrity reports per bin per time window, color bins above threshold. *(proposal — algorithm; tunables: window, NIC threshold, min-samples per bin)*
- **Free tier / key:** Same as DS-03 — free, no key.
- **Paid:** None.
- **Fallback:** gpsjam.org publishes daily maps only (no realtime API) — usable as a validation reference, not a feed.

## DS-12 — Airspace closures / restrictions

- **Original used:** "X AIRSPACE CLOSED" banners + red restriction polygons; NOTAM-like source implied, **never named** (`vid_0p8o7AeHDzg [05:23] frame_16`, `vid_7HEUCLc7aL8 frame_22`, `vid_ccZzOGnT4Cg frame_14`). [SPECULATIVE] whether the original consumed any live NOTAM source at all — critic gap notes the FAA API cannot produce the Iran/Qatar/UAE polygons demonstrated; hand-curation per scene is plausible.
- **Rebuild primary (MVP):** Hand-curated closure polygons in the scene manifest (Natural Earth country/FIR polygons + closure flag + effective time range). *(proposal — explicitly the honest MVP path)*
- **Rebuild later:** FAA NOTAM API (free, registration; US only), ICAO API Data Service NOTAM endpoint (evaluate — registration, quota-limited), OpenAIP for airspace geometry (free key). No single free global NOTAM API exists.
- **Free tier / key:** FAA — free w/ registration; ICAO — free tier w/ key; OpenAIP — free key.
- **Paid:** Commercial aeronautical-data vendors (Jeppesen etc.) — out of scope.
- **Fallback:** Scene-manifest curation is the permanent fallback.

## DS-13 — Internet blackout / outage

- **Original used:** Internet disruption rendered as INFRASTRUCTURE event card + red region ("Tehran's in internet blackouts", `vid_0p8o7AeHDzg [03:39] frame_09`); source implied NetBlocks-style, **never named**.
- **Rebuild primary:** Cloudflare Radar API. API shape: `GET https://api.cloudflare.com/client/v4/radar/annotations/outages?...` (Bearer token; also traffic-anomaly endpoints; https://developers.cloudflare.com/radar/).
- **Free tier / key:** Free API token (Cloudflare account), generous limits.
- **Paid:** None needed.
- **Fallback:** IODA (free API, near-real-time outage detection, by country/ASN/region). NetBlocks has **no API** — do not scrape.

## DS-14 — Commercial SAR imagery

- **Original used:** Capella Space SAR named for the Iran/"Epic Fury" reconstruction (`vid_CHLFl26p7Po [12:57][05:50]`, https://www.spatialintelligence.ai/p/the-intelligence-monopoly-is-over). Iceye mentioned but not found on the cited page — [SPECULATIVE].
- **Rebuild primary:** Free SAR stack: Capella Open Data Gallery (free event imagery, STAC/S3), Copernicus Data Space Sentinel-1 (free account, STAC/OData API), Umbra open data (CC-BY, AWS Open Data STAC). Serve as draped image overlays / ground-projected quads on the globe.
- **Free tier / key:** Capella open data — free; Copernicus — free account; Umbra — free, no key.
- **Paid:** Capella/ICEYE tasking, Sentinel Hub (processing API subscription).
- **Fallback:** NASA GIBS WMTS (VIIRS/MODIS daily, no key) when no SAR exists for the AOI/date.

## DS-15 — Commercial optical imagery / BDA

- **Original used:** Vantor (Mantis/Raptor) and Planet Labs named; before/after strike imagery shown with a **2-week commercial release hold** noted (`vid_CHLFl26p7Po [09:41][07:41]`, `vid_ccZzOGnT4Cg [12:26][12:46]`).
- **Rebuild primary:** Copernicus Sentinel-2 (free account, 10 m, ~5-day revisit) + NASA GIBS WMTS (free, no key, daily global) for before/after pairs. Design the layer as generic "georeferenced image overlay + date" so any source drops in.
- **Free tier / key:** Free account (Copernicus) / none (GIBS).
- **Paid:** Planet, Maxar/Vantor — enterprise contracts; out of MVP scope.
- **Fallback:** Skip the layer for AOIs with no free coverage; render the Ground Truth Card media instead (DS-16).

## DS-16 — OSINT strike/event database (Ground Truth Cards)

- **Original used:** Curated OSINT events with verification grading chips (VERIFIED / GEO-OSINT / SOURCE-REPORTED) and attached media from public outlets/social, harvested by an AI agent swarm "before the caches cleared" (`vid_0p8o7AeHDzg [00:29][08:00] frame_08/11`, `vid_7HEUCLc7aL8 frame_16 [09:01]`, `vid_ccZzOGnT4Cg frame_14/16`). Manual-vs-auto curation unstated — [SPECULATIVE].
- **Rebuild primary (MVP):** Manual curation into a JSON event store (schema: id, category, utc, title, lat/lon, precision, attacker/target, provenance grade, damage, media[]) — auto-ingest is unevidenced and the grading implies human review. *(proposal)*
- **Rebuild later (candidate feeds):** GDELT DOC/GEO 2.0 (free, no key, 15-min updates, geocoded news; https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/), ACLED (free key, request caps, **restrictive redistribution license** — display-only), ReliefWeb API (free), GDACS (free).
- **Free tier / key:** GDELT none; ACLED free key; ReliefWeb none.
- **Paid:** None planned. Liveuamap has **no public API** — do not scrape.
- **Fallback:** Manual curation is the fallback and the MVP.

## DS-17 — Oil futures prices

- **Original used:** "OIL RISK MATRIX" tile — daily Brent, WTI, and derived Brent−WTI spread, each with day-over-day delta, time-synced to playback (`vid_7HEUCLc7aL8 [03:16][04:21] frame_07/08`, `vid_ccZzOGnT4Cg [02:26] frame_04`). Price source **never named** — [SPECULATIVE] which feed the original used. Panel values step per playback date → daily closes suffice.
- **Rebuild primary:** FRED daily crude series — **verified working, keyless** (gapfill-3, live-fetched 2026-07-11): `GET https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU,DCOILWTICO` → CSV `observation_date,DCOILBRENTEU,DCOILWTICO`, history to 1986. Spread = Brent − WTI, computed client-side. Forward-fill blank holiday cells. Publication lag ~3–5 business days — irrelevant for playback of historical windows.
- **Free tier / key:** Free, no key (CSV endpoint); official FRED API (free key) if JSON preferred.
- **Paid:** None needed.
- **Fallback:** EIA Open Data API (free key; series `PET.RBRTE.D` / `PET.RWTC.D` — the upstream source FRED mirrors). Rejected: stooq CSV (blocked by JS anti-bot challenge, unverifiable — gapfill-3).

## DS-18 — Vessel registry / particulars

- **Original used:** Dossier fields flag, type, tonnage, deadweight, draught, dimensions, build year, ownership with per-field "Unknown" fallback (`vid_7HEUCLc7aL8 frame_02/03`, `vid_ccZzOGnT4Cg frame_05/09`). Registry source never shown. Gapfill-4 proves the split: route/draught/dimensions/ETA come from AIS message 5 (fully populated for YEKTA II, `vid_ccZzOGnT4Cg crop_f11_right`), while **tonnage/deadweight/owner were "Unknown" on every vessel inspected** — the original likely had **no registry join wired at all**. [SPECULATIVE] that any external registry was used.
- **Rebuild primary:** 3-stage enrichment *(proposal, gapfill-4)*:
  - **Stage A (MMSI→IMO):** self-reported IMO from AIS msg 5 when present; else `GET https://gateway.api.globalfishingwatch.org/v3/vessels/search?query=<MMSI>&datasets[0]=public-global-vessel-identity:latest` (free registration token). MMSI = mutable track key; IMO = permanent dossier key.
  - **Stage B (IMO→particulars, automated):** GFW `registryInfo` + `OWNERSHIP` includes → gross tonnage, built year, length/depth, owner. Cache per-IMO, ~30-day TTL. Attribution required per GFW ToS.
  - **Stage C (manual):** dossier footer deep links — Equasis ship page and IMO GISIS `gisis.imo.org/Public/SHIPS/ShipDetails.aspx?IMONumber=<7-digit>`. **Deep links only:** Equasis ToS forbids bulk harvesting/API reuse (20-ship export cap); GISIS has no API. Never scrape either.
- **Rendering rule (evidenced):** every field independently falls back to literal `Unknown`; dimensions fall back to `?m x ?m`; never blank/zero/hidden (`vid_ccZzOGnT4Cg frame_09 [05:42]`). Zero-match vessels tagged `UNKNOWN VESSEL` / `FLAG UNKNOWN` → dark-vessel lane.
- **Free tier / key:** GFW — free token; Equasis/GISIS — free web accounts (manual only).
- **Paid:** S&P Global / Lloyd's List Intelligence / Clarkson — only if GFW merchant-tonnage coverage proves insufficient.
- **Fallback:** Flag decode from MMSI MID digits works with zero providers.

## DS-19 — News / wire articles

- **Original used:** Reuters, The Times of India, BBC, Al Jazeera, WSJ, Fortune, moneycontrol surfaced as in-scene cards/overlays; a "MEDIA-EVENTS" layer feeds the map (`vid_7HEUCLc7aL8 frame_04/09 montage_016`, `vid_ccZzOGnT4Cg montage_014 r1c6, montage_002 r2c4`). Ingestion path unshown — [SPECULATIVE].
- **Rebuild primary:** GDELT DOC 2.0 API (`GET https://api.gdeltproject.org/api/v2/doc/doc?query=...&format=json` — free, no key, 15-min cadence) + GEO 2.0 for geocoded placement; geocoded RSS from BBC/Al Jazeera/France24 for card content (link + headline + thumbnail only — link out, don't republish full text).
- **Free tier / key:** Free, no key.
- **Paid:** None needed.
- **Fallback:** GDACS alerts for disaster-type events. *(proposal)*

## DS-20 — Adtech geolocation (concept — descoped)

- **Original used:** Described conceptually only ("advertising intelligence... Candy Crush cluster" defeating AIS masking, `vid_CHLFl26p7Po [08:40][08:49]`); never a shown layer.
- **Rebuild:** **Descoped.** Commercial adtech/mobility data is enterprise-priced and privacy-hostile; there is no public/open-data equivalent, and building it would violate this project's public-data-only rule. Document the concept in the analysis docs; build nothing.

## DS-21 — Country boundaries geodata

- **Original used:** "Country Boundaries" toggle + faint admin outlines; source never named (`vid_CHLFl26p7Po [10:16]`, `vid_7HEUCLc7aL8 frame_11/06`) — [SPECULATIVE] which dataset.
- **Rebuild primary:** Natural Earth admin-0 (public domain, static GeoJSON/shapefile bundled at build time — no API, no key, no polling).
- **Free tier / key:** Free, no key, no runtime dependency.
- **Paid:** None.
- **Fallback:** geoBoundaries or OSM admin relations via Overpass if higher-resolution/disputed-boundary variants are needed. *(proposal)*

## DS-22 — Fires / natural events (roadmap — not in original)

- **Original used:** Nothing — self-labeled roadmap addition, not evidenced in Sidhu's app.
- **Rebuild primary:** NASA FIRMS area API (`GET https://firms.modaps.eosdis.nasa.gov/api/area/csv/<MAP_KEY>/VIIRS_SNPP_NRT/<bbox>/<days>` — free MAP_KEY, VIIRS 375 m, ~3 h latency; https://firms.modaps.eosdis.nasa.gov/api/).
- **Free tier / key:** Free MAP_KEY, transaction limits per 10-min window.
- **Paid:** None.
- **Fallback:** NASA EONET (free, no key, curated natural-event GeoJSON — used by worldview_oss).

## DS-23 — AIS/track historical archive + backfill *(new row, from gap findings)*

- **Original used:** **Self-recorded, record-first archive** — "I've recorded all the vessel tracking data from February 25th to present day" (`vid_ccZzOGnT4Cg [01:14]`); AI agent swarm capturing "every open-source signal... before the caches cleared" (`vid_0p8o7AeHDzg [00:29]`). Storage is day-partitioned chunks lazily fetched by the client — status line "8 CACHED DAY CHUNKS" across a 38-day timeline (`vid_7HEUCLc7aL8 frame_15`, `vid_ccZzOGnT4Cg crop_f05_timeline`); playback at up to 6 h/s with 500 ms playhead resolution implies pre-downsampled position keyframes (1–5 min), not raw message logs (gapfill-1).
- **Rebuild primary:** Own always-on archiver (STK-10): one worker per source (aisstream WebSocket, OpenSky poller at credit-sustainable cadence, adsb.lol mil poller, event captures) writing UTC-day chunk files of per-entity keyframes + per-day aggregate sidecars (crossing counts, active-vessel counts). **Record-first is mandatory** — verified hard constraint: OpenSky free history = 1 h max, aisstream = zero backfill (gapfill-1).
- **Free tier / key:** Uses the DS-02/03/05 credentials; storage is yours.
- **Paid backfill (recovery path only):** Spire→Kpler / MarineTraffic / exactEarth raw historical AIS.
- **Fallback (partial, free):** Global Fishing Watch 4Wings API — derived AIS products (vessel presence, AIS-off events, encounters) 2017 → ~now-5d; backfills analytics layers, **not** smooth per-vessel playback (verified: https://globalfishingwatch.org/our-apis/).

## DS-24 — Street View imagery, CCTV fallback *(new row, from gap findings)*

- **Original used:** Named on-screen: DATA LAYERS subtitle "CCTV Mesh + Street View fallback · never" (4K re-extract, `vid_rXvU7bPJ8n4 frame_07/08`, `vid_CHLFl26p7Po [08:02]`; gapfill-2) — Street View imagery stands in where no live camera exists. Mechanism only; never demoed — [SPECULATIVE] how it was rendered.
- **Rebuild primary:** Google Street View Static API. API shape: `GET https://maps.googleapis.com/maps/api/streetview?size=640x640&location=<lat,lon>&heading=<h>&key=KEY` (+ metadata endpoint to check coverage before billing a fetch).
- **Free tier / key:** API key required; metered per image beyond the Google Maps Platform monthly free credit (metadata requests are free — always precheck).
- **Paid:** Pay-as-you-go per static image.
- **Fallback:** Mapillary imagery API (free token, crowdsourced street-level images, CC-BY-SA). *(proposal)*

---

## Integration priority

| Phase | Feeds | Rationale |
|-------|-------|-----------|
| **P0 — MVP globe** | DS-01 (basemap), DS-02 (flights), DS-03 (mil flights), DS-04 (satellites), DS-08 (quakes), DS-21 (boundaries) | Matches the original's first demo (`vid_rXvU7bPJ8n4`); all free/no-key except DS-01/02 keys; no backend required — pure client polling. |
| **P1 — record + playback** | DS-23 (archiver — **start it before you need history**), DS-05 (AIS), DS-18 (registry enrich), DS-17 (oil panel), DS-11 (GPS jamming derive) | Unlocks the 4D timeline + maritime episode. DS-23 first: every day not recorded is unrecoverable for free. |
| **P2 — situational layers** | DS-09 (weather), DS-06 (CCTV), DS-24 (Street View fallback), DS-07 (street traffic), DS-16 (Ground Truth Cards, manual), DS-19 (news), DS-13 (outages) | Each independent; add in any order. |
| **P3 — later** | DS-12 (NOTAM automation; curated polygons ship in P1 scene manifests), DS-14/DS-15 (SAR/optical overlays), DS-10 (bikeshare), DS-22 (fires) | Low coupling, imagery layers depend on AOI coverage. |
| **Descoped** | DS-20 (adtech geolocation) | No public/legal source; concept documentation only. |

## Compliance note

All feeds in this catalog are public/open data. Binding rules for the build:

1. **Public data only.** No unsecured private cameras (Insecam-class), no adtech/mobility location data (DS-20 descoped), no credentialed-content bypass.
2. **ToS-respecting polling.** Honor each provider's stated cadence and quota: OpenSky credit math (DS-02), Overpass fair use (DS-07), USGS 1-min feed regen (DS-08), GBFS `ttl` (DS-10), FIRMS transaction windows (DS-22). Back off on 429/403; never rotate keys/IPs to evade limits.
3. **No scraping where an API is refused.** Equasis and GISIS are deep-link-only (Equasis ToS explicitly forbids bulk harvest, DS-18); NetBlocks (DS-13) and Liveuamap (DS-16) have no API — link, don't scrape.
4. **Attribution.** Google (DS-01/24, on-canvas attribution required), OpenSky non-commercial terms (DS-02), ODbL for adsb.lol/OSM (DS-03/07), GFW attribution (DS-18), Windy (DS-06), ACLED display-only redistribution (DS-16).
5. **Non-commercial tiers flagged.** OpenSky, aisstream.io, Open-Meteo free tiers are non-commercial — re-license before any commercial deployment.
6. **News content:** headline + link + thumbnail only (DS-19); no full-text republication.
