# godseye

Spec, documentation, and roadmap for rebuilding **God's Eye View** — Bilawal Sidhu's browser-based geospatial OSINT command center (CesiumJS + Google Photorealistic 3D Tiles globe, live OSINT layers, 4D timeline playback, sensor-style shaders, voice + AI analysis).

The original repo ([bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)) is a placeholder with no code (release targeted July 2026), so the entire spec was reverse-engineered from his 5 YouTube videos (frames + transcripts), repo assets, and a web sweep — then adversarially verified (122/125 claims CONFIRMED).

## Build status

Working app, milestones M0–M5 plus the Hormuz analytics suite ([06-roadmap](docs/06-roadmap.md)):

- **Globe** — CesiumJS; basemap switch GOOGLE 3D / AERIAL + LBL / ROAD. Runs keyless (Esri/OSM 2D fallback); with a Google Map Tiles key or Cesium ion token the photorealistic 3D tiles are the default.
- **Live layers** — flights (OpenSky), military (airplanes.live + adsb.lol/adsb.fi mirrors), satellites (CelesTrak TLEs + SGP4, click = orbit track), earthquakes (USGS), boundaries, NEXRAD weather, **AIS ships** (aisstream WebSocket, moving/stationary split, click dossier), **street traffic** (Overpass roads + animated vehicles). 8000-entity cap per aircraft layer; per-layer SOLO isolation.
- **Hormuz analytics** — **dark-vessel detection** (AIS-gap over recorded history), **chokepoint gate** crossing tally (preset or 2-click gate), **oil futures** panel (FRED Brent/WTI sparklines), **critical-infrastructure** layer (Gulf pipelines, chokepoints, refineries, desalination).
- **GPS jamming** (CAP-21) — SCAN VIEW hex-bins low nav-integrity (NIC/NACp) ADS-B reports from airplanes.live into red degraded-GPS cells (the gpsjam.org method — zero new feeds).
- **Satellite AOI access lines** (CAP-12) — fan lines from imaging-satellite watchlist (Pleiades/WorldView/SkySat/Capella/ICEYE…) down to curated Iran/Hormuz AOIs whenever a bird is above the tunable elevation mask.
- **CCTV mesh + ground projection** (CAP-20) — public DOT still-cams; click a camera → fly to a framing pose + live-snapshot picture-in-picture (1 frame/min); COVERAGE footprint wedge, ALIGN-DRAPE outline/fill, manual pose sliders (auto-cal is WIP, matching the original).
- **Style** — CRT / NVG / FLIR / ANIME / NOIR presets (keys 1–6), bloom/sharpen/pixelate, clean-UI (H).
- **Scenes** — 6 cities × 5 POI chips (Q/W/E/R/T), shot planner, orbit camera, Nominatim search.
- **4D playback** — every live refresh records to IndexedDB; PLAYBACK scrubs the archive at 1×–6h/s; satellites re-propagate at the playback instant.
- **Voice + AI** — Web Speech commands + free-text Q&A, DMS/alt/REC telemetry, LLM SUMMARY caption (Ollama `minimax-m3:cloud`, falls back to a template).

Keys (all free-tier, in gitignored `.env` — copy `.env.example`): `VITE_GOOGLE_TILES_KEY` (3D tiles), `VITE_AISSTREAM_KEY` (ships), `OLLAMA_API_KEY` (AI caption/Q&A, injected server-side by the proxy). None required — the app degrades gracefully without each.

Remaining backlog: worker-thread parsing/clustering (a performance hardening — deferred until the entity load actually janks), true projective-texture CCTV drape onto the 3D tileset, and temporal GPS-jam evolution across the 4D timeline. See [07-session-notes](docs/07-session-notes.md).

```sh
npm install
cp .env.example .env   # optional: add keys
npm run dev            # http://localhost:5173
npm test               # 41 pure-logic unit tests
npm run build && npm run preview
node scripts/verify-m0.mjs        # headless smoke: every auto-layer populated + screenshot
node scripts/verify-styles.mjs    # cycles all six style presets
node scripts/verify-playback.mjs  # records, scrubs + plays the 4D archive
node scripts/verify-keyed.mjs     # (keys set) Google 3D + AIS stream + LLM caption
node scripts/verify-hormuz.mjs    # dark-vessel / gate / oil / infra modules
node scripts/verify-backlog.mjs   # GPS-jamming / satellite AOI lines / CCTV mesh
```

Feed proxying: OpenSky, the military mirrors, FRED oil, and the LLM lack third-party CORS (or hold secrets), so the app calls same-origin `/feeds/*`, proxied by vite dev/preview. A production host must provide the same routes (thin proxy per [02-architecture](docs/02-architecture.md)); the LLM route injects `OLLAMA_API_KEY` so it never reaches the bundle.

## Docs

| Doc | What |
|-----|------|
| [00-overview](docs/00-overview.md) | Program overview, evidence base, doc map, citation format |
| [01-functional-spec](docs/01-functional-spec.md) | Capability matrix — 57 capabilities (CAP-01..57) with citations + acceptance criteria |
| [02-architecture](docs/02-architecture.md) | Evidenced original stack (13 STK conclusions) + proposed rebuild architecture |
| [03-data-sources](docs/03-data-sources.md) | Feed catalog — 24 data sources with providers, free tiers, rate limits, fallbacks |
| [04-ui-spec](docs/04-ui-spec.md) | Interface spec — layout, HUD readouts, label conventions, style presets, interactions |
| [05-improvements](docs/05-improvements.md) | Improvement backlog beyond parity — 25 ranked items |
| [06-roadmap](docs/06-roadmap.md) | Milestoned build plan M0–M6+ with exit criteria and risk register |
| [07-session-notes](docs/07-session-notes.md) | Evidence log — methodology, per-video notes, verification results, open gaps |

Scope note: all feeds are public/open data (OSINT visualization). No scraping of private data, no auth bypass.
