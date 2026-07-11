# godseye

Spec, documentation, and roadmap for rebuilding **God's Eye View** — Bilawal Sidhu's browser-based geospatial OSINT command center (CesiumJS + Google Photorealistic 3D Tiles globe, live OSINT layers, 4D timeline playback, sensor-style shaders, voice + AI analysis).

The original repo ([bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)) is a placeholder with no code (release targeted July 2026), so the entire spec was reverse-engineered from his 5 YouTube videos (frames + transcripts), repo assets, and a web sweep — then adversarially verified (122/125 claims CONFIRMED).

## Build status

Milestones M0–M5 have working keyless slices ([06-roadmap](docs/06-roadmap.md)):

- **Globe** — CesiumJS; basemap switch GOOGLE 3D / AERIAL + LBL / ROAD. Runs keyless (Esri/OSM 2D fallback); add a Google Map Tiles key or Cesium ion token in `.env` (copy `.env.example`) for photorealistic 3D tiles.
- **Live layers** — flights (OpenSky, 15-min anonymous budget), military (airplanes.live direct + adsb.lol/adsb.fi proxied mirrors), satellites (CelesTrak TLEs + SGP4, sparse/full, click = orbit track + class readout), earthquakes (USGS), country boundaries, NEXRAD weather overlay. 8000-entity cap per aircraft layer.
- **Style** — CRT / NVG / FLIR / ANIME / NOIR post-process presets (keys 1–6), bloom/sharpen/pixelate, clean-UI (H).
- **Scenes** — 6 cities × 5 POI chips (Q/W/E/R/T), shot planner, orbit camera, Nominatim search.
- **4D playback** — every live refresh records to IndexedDB; PLAYBACK mode scrubs the archive at 1×–6h/s; satellites re-propagate at the playback instant.
- **Voice + HUD** — Web Speech commands (show/hide layers, styles, "fly to …"), DMS/alt/REC telemetry, five-word SUMMARY caption.

Still keyed/blocked: Google 3D tiles (needs key), AIS ships + dark-vessel analytics (needs aisstream.io key), CCTV projection, LLM analysis (needs API key). See [07-session-notes](docs/07-session-notes.md) gaps.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # feed-normalize + TLE parser unit tests
npm run build && npm run preview
node scripts/verify-m0.mjs        # headless smoke: every layer populated + screenshot
node scripts/verify-styles.mjs    # cycles all six style presets
node scripts/verify-playback.mjs  # records 75s, scrubs + plays the archive
```

Feed proxying: OpenSky and two military mirrors lack third-party CORS, so the app calls same-origin `/feeds/*`, proxied by vite dev/preview. A production host must provide the same routes (thin proxy per [02-architecture](docs/02-architecture.md)).

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
