# godseye

Spec, documentation, and roadmap for rebuilding **God's Eye View** — Bilawal Sidhu's browser-based geospatial OSINT command center (CesiumJS + Google Photorealistic 3D Tiles globe, live OSINT layers, 4D timeline playback, sensor-style shaders, voice + AI analysis).

The original repo ([bilawalsidhu/gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view)) is a placeholder with no code (release targeted July 2026), so the entire spec was reverse-engineered from his 5 YouTube videos (frames + transcripts), repo assets, and a web sweep — then adversarially verified (122/125 claims CONFIRMED).

## Build status

**M0 (skeleton) done** — CesiumJS globe, basemap switching (GOOGLE 3D / AERIAL + LBL / ROAD), USGS earthquakes layer end-to-end with 1-min refresh. Runs keyless (2D fallback); add a Google Map Tiles key or Cesium ion token in `.env` (copy `.env.example`) for photorealistic 3D tiles. Next: M1 per [06-roadmap](docs/06-roadmap.md).

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # feed-normalize unit tests
npm run build && npm run preview
node scripts/verify-m0.mjs   # headless Edge smoke: basemap active + quakes rendered + screenshot
```

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
