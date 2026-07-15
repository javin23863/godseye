# Godseye

Working implementation, evidence, and build history for **Godseye** — an independently owned browser-based geospatial OSINT command center (CesiumJS + Google Photorealistic 3D Tiles globe, live OSINT layers, 4D timeline playback, sensor-style shaders, voice + AI analysis).

The upstream inspiration ([bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)) was a placeholder when this work began. This independent implementation was reverse-engineered from five public videos (frames + transcripts), repo assets, and a web sweep; the documents preserve that evidence and provenance.

## Build status

Working app, milestones M0–M5, the Hormuz analytics suite, and the final Temporal Evidence Story cutaway ([08-temporal-evidence-story-mode](docs/08-temporal-evidence-story-mode.md)):

- **Temporal Evidence Story mode** — TraderCockpit-ready 6–15 second **Signal → Exposure → Proof** cutaway on the existing Cesium viewer. It isolates one primary event plus at most three explicitly ordered supporting sources, hides Analyst chrome and map-label clutter, waits for rendered/crop-safe/contrast-valid frames, shows one readiness-gated source-lock pulse, preserves all evidence under reduced motion, returns scene-state v2 + evidence-packet/v1, and restores the prior Analyst state after success or failure. `window.godseyeAutomationV1` remains the only supported integration boundary.

- **Globe** — CesiumJS; basemap switch GOOGLE 3D / AERIAL + LBL / ROAD. Runs keyless (Esri/OSM 2D fallback); with a Google Map Tiles key or Cesium ion token the photorealistic 3D tiles are the default.
- **Live layers** — flights (OpenSky), military (airplanes.live + adsb.lol/adsb.fi mirrors), satellites (CelesTrak TLEs + SGP4, click = orbit track), earthquakes (USGS), boundaries, NEXRAD weather, **AIS ships** (aisstream WebSocket, moving/stationary split, click dossier), **street traffic** (Overpass roads + animated vehicles). 8000-entity cap per aircraft layer; per-layer SOLO isolation.
- **Hormuz analytics** — **dark-vessel detection** (AIS-gap over recorded history), **chokepoint gate** crossing tally (preset or 2-click gate), **oil futures** panel (FRED Brent/WTI sparklines), **critical-infrastructure** layer (Gulf pipelines, chokepoints, refineries, desalination).
- **GPS jamming** (CAP-21) — SCAN VIEW hex-bins low nav-integrity (NIC/NACp) ADS-B reports from airplanes.live into red degraded-GPS cells (the gpsjam.org method — zero new feeds). Each scan records to the 4D archive and the playhead replays it, so jamming intensity evolves along the timeline; an opt-in AUTO-SCAN samples every 3 min to accumulate that evolution.
- **Satellite AOI access lines** (CAP-12) — fan lines from imaging-satellite watchlist (Pleiades/WorldView/SkySat/Capella/ICEYE…) down to curated Iran/Hormuz AOIs whenever a bird is above the tunable elevation mask.
- **CCTV mesh + ground projection** (CAP-20) — public DOT still-cams; click a camera → fly to a framing pose + live-snapshot picture-in-picture (1 frame/min); COVERAGE footprint wedge, ALIGN-DRAPE outline/fill, manual pose sliders (auto-cal is WIP, matching the original).
- **Style** — CRT / NVG / FLIR / ANIME / NOIR presets (keys 1–6), bloom/sharpen/pixelate, clean-UI (H).
- **Scenes** — 6 cities × 5 POI chips (Q/W/E/R/T), shot planner, orbit camera, Nominatim search.
- **4D playback** — every live refresh records to IndexedDB; PLAYBACK scrubs the archive at 1×–6h/s; satellites re-propagate at the playback instant.
- **Voice + AI** — Web Speech commands + free-text Q&A, DMS/alt/REC telemetry, LLM SUMMARY caption (Ollama `minimax-m3:cloud`, falls back to a template).
- **News-intel wave (2026-07-13, video-gap parity)** — **LIVE NEWS FEED** panel (GDELT DOC 2.0 + Google News RSS, 90s poll, distinct-domain corroboration chips CONFIRMED/LIKELY/PLAUSIBLE, category/source filters), **CONFLICT ZONES** (16 curated indicative polygons: active/contested/disputed), **ACTIVE FIRES** (NASA FIRMS VIIRS 24h, keyless), **WX ALERTS (US)** (NWS active alerts, severity-drawn polygons), **NET OUTAGES** (IODA country-level 24h signals), **FIN. STRESS** board (FRED WTI/Brent/NatGas/VIX/GVZ gold-vol with hub markers colored by 5d change), **REGION INTEL** (arm + click anywhere → LLM assessment grounded only in own-layer evidence within 800 km, template fallback, 20s LLM deadline). Verify: `node scripts/verify-newsint.mjs`.

Keys (all free-tier, in gitignored `.env` — copy `.env.example`): `VITE_GOOGLE_TILES_KEY` (3D tiles), `VITE_AISSTREAM_KEY` (ships), `OLLAMA_API_KEY` (AI caption/Q&A, injected server-side by the proxy). None required — the app degrades gracefully without each.

Godseye v1 capability and visual-language expansion is now frozen. Worker parsing/clustering, SAR, new feeds/viewers/frameworks, archive infrastructure, true projective-texture CCTV drape, and CCTV PnP auto-calibration are M6+ deferred work. Editorial framing, captions, market consequence, audio, publishing, and post-release clip comparisons belong to TraderCockpit. See [08-temporal-evidence-story-mode](docs/08-temporal-evidence-story-mode.md).

```sh
npm install
cp .env.example .env   # optional: add keys
npm run dev            # http://localhost:5173
npm test               # 182 pure-logic unit tests
npm run build && npm run preview
npm run verify:story -- http://127.0.0.1:4321  # 3 archetypes × 2 aspects; ffprobe enforces 6-15s and ≥30fps
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
| [06-roadmap](docs/06-roadmap.md) | Historical milestone plan plus current backlog and risk register |
| [07-session-notes](docs/07-session-notes.md) | Evidence log — methodology, per-video notes, verification results, open gaps |
| [08-temporal-evidence-story-mode](docs/08-temporal-evidence-story-mode.md) | Final Story cutaway contract, visual language, verification receipts, and frozen/deferred boundary |

Scope note: all feeds are public/open data (OSINT visualization). No scraping of private data, no auth bypass.
