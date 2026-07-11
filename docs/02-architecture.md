# 02 — Architecture

Rebuild architecture for **godseye**, a browser-based geospatial OSINT command center modeled on Bilawal Sidhu's "God's Eye View" (formerly WorldView). Section 1 records what is *evidenced* about the original. Sections 2–5 are **proposals** for the rebuild — marked as such, no citation required, grounded in the evidence where noted.

Cross-references: capabilities `CAP-xx` (01-functional-spec.md), data sources `DS-xx` (03-data-sources.md), UI `UI-xx` (04-ui-spec.md), stack conclusions `STK-xx` (this doc, table below).

---

## 1. Evidenced original stack

Everything in this table is about *Sidhu's* build, with citations. His source code is unreleased (placeholder repo targeting July 2026 — `STK-09`, https://github.com/bilawalsidhu/gods-eye-view), so anything beyond the table is inference.

| ID | Component | Evidenced conclusion | Key citations |
|----|-----------|---------------------|---------------|
| STK-01 | Globe engine | CesiumJS via Cesium ion (Cesium ion logo + Google Maps Data credit bar in repo hero; community replicas use CesiumJS). Never named on camera. | repo-asset:god-view-hero-crt.jpg; https://github.com/noaRoblesLevy/GodsEye |
| STK-02 | 3D tiles | Google Photorealistic 3D Tiles ("the same technology that powers Google Earth's volumetric city models"); on-screen GOOGLE 3D basemap button. | https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator; vid_7HEUCLc7aL8 frame_11; vid_ccZzOGnT4Cg frame_14 |
| STK-03 | AI build models | Gemini 3.1 (Pro, spatial reasoning) + Claude 4.6 (logic/coding) + Codex 5.2/5.3, described as interchangeable. Corroborated by on-screen tweets, a Grok summary, and Sidhu's newsletter/Threads. | vid_rXvU7bPJ8n4 [08:29]–[08:35], montage_002 tile 1,4; vid_CHLFl26p7Po [14:41] [14:44]; vid_0p8o7AeHDzg frame_01, frame_20; https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator; https://www.threads.com/@bilawal.ai/post/DU9ofKCCDqf |
| STK-05 | Runtime | Browser-based, real-time shader post-processing (custom CRT/NVG/FLIR/anime filters over the photoreal globe); BLOOM/SHARPEN toggles + PERF readout. Article fetch surfaced "WebGPU"; exact GPU API [SPECULATIVE] — CesiumJS is WebGL2 today. | vid_rXvU7bPJ8n4 [01:19] [04:02] [09:18]; https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator |
| STK-06 | Frameworks | NOT disclosed. The Next.js 16 + Tailwind + Zustand stack circulating online is the community clone `worldview_oss`, not the original. | https://github.com/jedijamez567/worldview_oss |
| STK-04 | Build process | Vibe-coded, zero hand-written code: voice notes + screenshots → up to 8 terminal CLI agents in parallel, one per subsystem (satellite tracker / CCTV / shader pipeline). | vid_rXvU7bPJ8n4 [08:40]–[09:07]; https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator |
| STK-10 | Ingest | "AI agent swarm" scrapes/snapshots public feeds *before caches clear*, time-aligning them into a scrubbable 4D dataset. Record-first, separate from the viewer. | vid_0p8o7AeHDzg [00:27]; https://substack.com/@bilawalsidhu/note/c-221732625 |
| STK-12 | Playback storage | AIS playback served from day-partitioned cached chunks with client-side caching ("N ACTIVE VESSELS · 8 CACHED DAY CHUNKS"). | vid_7HEUCLc7aL8 frame_15; vid_ccZzOGnT4Cg frame_05 |
| STK-07 | Branding | Two coordinated surfaces: "WORLDVIEW" / "GOD'S EYE VIEW" 3D globe + "MAPTHEWORLD.AI" 2D maritime dashboard. One-codebase-vs-two [SPECULATIVE]. | vid_ccZzOGnT4Cg frame_04, frame_14 |
| STK-08 | Build timeline / author | Built in ~3 days (a weekend) by one person; author is an ex-Google Maps/XR PM (6 years — Immersive View, ARCore Geospatial API, worked on the 3D Tiles dataset). "The tools have democratized the prototype. They haven't democratized the judgment to ship it." | vid_rXvU7bPJ8n4 [00:33] [09:21] [09:24]; vid_0p8o7AeHDzg [08:34] [08:43]; vid_ccZzOGnT4Cg [13:05]; https://www.linkedin.com/posts/bilawalsidhu_i-built-worldview-in-three-days-but-i-also-activity-7432079812619550720-O3Gb |
| STK-09 | Hosting | Runs locally in a browser tab; no public hosted instance. | https://github.com/bilawalsidhu/gods-eye-view |
| STK-11 | Argus perception stack | Personal-surface pipeline: Meta Segment Anything (SAM 2) segments camera feeds → Claude or Gemini infers context and writes a natural-language alert; local/edge ambition implied by frustration with cloud-dependent Ring. | vid_CHLFl26p7Po [13:29] [13:53] [14:00], montage_039 tile 3,1, montage_040 tile 1,1 |
| STK-13 | Vector search | UBOS.tech claims a Chroma DB layer; no primary source. [SPECULATIVE] — excluded from this architecture. | https://ubos.tech/news/spy-satellite-simulator-a-new-frontier-in-geospatial-intelligence/ |

Two evidenced hard constraints drive everything below (gapfill-1, verified live 2026-07-11):

1. **OpenSky free API serves at most 1 h of history** (`t < now-3600` → 400; 4,000 credits/day; global `/states/all` = 4 credits → one global snapshot per ~86 s, or ~21 s for a ≤25 sq° AOI at 1 credit). https://openskynetwork.github.io/opensky-api/rest.html
2. **aisstream.io is realtime-only** (WebSocket, bbox subscription within 3 s of connect, zero backfill). https://aisstream.io/documentation

Multi-week playback like the Feb 25 → Apr 3, 2026 window shown on screen (vid_ccZzOGnT4Cg [01:14]; vid_7HEUCLc7aL8 frame_15) is therefore **impossible to reconstruct after the fact from free sources**. Record-first is mandatory, exactly as the original did it (STK-10).

---

## 2. Proposed rebuild architecture

**Everything in this section is a proposal.**

```
┌────────────────────────── Browser (frontend) ──────────────────────────┐
│  CesiumJS viewer (Google Photorealistic 3D Tiles via Cesium ion)       │
│  ├─ Layer Manager        (registry: id, source, renderer, toggle)      │
│  ├─ Time Engine          (LIVE | PLAYBACK clock, speed presets)        │
│  ├─ Post-Processing      (CesiumJS PostProcessStage GLSL: CRT/NVG/FLIR)│
│  ├─ Entity renderers     (planes, sats via satellite.js SGP4, vessels, │
│  │                        hex bins, polygons, event cards)             │
│  └─ AI/Voice panel       (Web Speech API → intent → camera/layer ops)  │
└───────────────┬────────────────────────────────────────────────────────┘
                │ HTTPS/WS (same origin)
┌───────────────▼───────────── Thin backend (Node/Python, single svc) ───┐
│  /live/*      key-holding proxy + short-TTL cache per feed             │
│  /chunks/*    static day-partitioned playback chunks (file store/S3)   │
│  /scenes/*    curated scene manifests (JSON)                           │
│  /ai/*        LLM summary + voice-intent routing (server holds keys)   │
└───────────────┬────────────────────────────────────────────────────────┘
                │
┌───────────────▼───────────── Recorder swarm (always-on daemons) ───────┐
│  one poller/streamer per DS: OpenSky, adsb.lol, aisstream WS, CelesTrak│
│  USGS, NOAA NEXRAD, Cloudflare Radar, FRED oil, CCTV snapshots, GBFS…  │
│  → append to day-partitioned chunk store + per-day aggregate sidecars  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Frontend (browser app)

Proposal: **CesiumJS + TypeScript + Vite, no meta-framework.** The app is one full-screen canvas plus HUD panels; Next.js/React SSR buys nothing here (the clone's Next.js stack is clone-only, STK-06). Plain TS modules + a small reactive store. Add React later only if HUD complexity demands it.

| Module | Responsibility | Grounding |
|--------|---------------|-----------|
| `viewer` | Cesium Viewer bootstrap, Google 3D Tiles via Cesium ion, basemap switcher (Google 3D / Aerial+Lbl / Road) | STK-01/02, CAP-01, CAP-03 |
| `layers` | Layer registry: `{ id, dsRef, fetcher, renderer, enabled, count, lastUpdated }`. Left DATA LAYERS panel + bottom chip bar bind to it. Filtering/isolation (CAP-30), panoptic stacking (CAP-31). | CAP-07, UI panel = 8 rows in original (gapfill-2) |
| `time` | Single authoritative clock: mode `LIVE \| PLAYBACK`, playhead (ms resolution; original shows 500 ms — vid_7HEUCLc7aL8 frame_15), speed presets 30M/S…1D/S (CAP-39), day-chunk prefetch as playhead crosses UTC-day boundaries, LRU chunk cache (STK-12). Every layer renderer reads the clock; nothing keeps its own time. | CAP-38/39/40/41 |
| `postfx` | CesiumJS `PostProcessStage` GLSL chain: preset selector (Normal/CRT/NVG/FLIR/Anime/Noir) + per-effect uniforms (bloom, sharpen, pixelation, distortion, instability). Number-key cycling. WebGL2 — treat the WebGPU mention as aspirational (STK-05 caveat). | CAP-04/05/44 |
| `entities` | Per-class renderers: aircraft billboards + callsign labels; satellites propagated client-side with satellite.js SGP4 from CelesTrak GP data (DS-04) incl. click-to-track orbit lines (CAP-11) and AOI access lines (CAP-12); vessel arrows + trails + dossier panel (CAP-13, UI-14 per-field "Unknown" fallback, gapfill-4); hex density (CAP-32); extruded restriction polygons (CAP-22); geo-anchored event cards with leader lines (CAP-33/34). | listed |
| `camera` | POI chips w/ OSM-volume centering (CAP-43), Q/W/E/R/T hotkeys (CAP-44), shot planner (CAP-45), cinematic orbit/spiral/FOV rig (CAP-46), saved locations (CAP-47). | listed |
| `analytics` | Client-side derived views over chunk aggregates: gate-crossing counts IN/OUT (CAP-15), pre/post KPI tiles (CAP-37), oil risk matrix synced to playhead (CAP-36), dark-transit watch list (CAP-14). | listed |
| `hud` | Layout themes ("Tactical"), CLEAR UI declutter, LIVE/PLAYBACK pill, scene dropdown, telemetry strip. | CAP-06, CAP-40, CAP-42 |

### 2.2 Data plane (recorder swarm + serving)

Proposal, directly modeled on the evidenced STK-10/STK-12 design:

- **Recorder swarm** — one small always-on daemon per data source (the "agent swarm" made boring: a supervised set of pollers/stream consumers, no LLM needed to copy JSON). Per source:
  - `opensky` poller: credit-sustainable cadence (~86 s global, ~21 s per AOI bbox; run a feeder account for 8,000 credits/day) — DS-02.
  - `adsb-mil` poller: adsb.lol `/v2` (named on-screen in the original's layer subtitle, gapfill-2) — DS-03.
  - `ais` streamer: aisstream.io WebSocket, bbox-subscribed to AOIs, **auto-reconnect + MMSI/timestamp dedupe + explicit gap-marker records** so playback renders honest data holes — DS-05.
  - `celestrak` fetcher: GP/TLE daily; propagation happens client-side — DS-04.
  - Low-rate fetchers: USGS quakes (DS-08), NOAA NEXRAD tiles (DS-09 — the UI-named provider), Cloudflare Radar outages (DS-13), FRED `DCOILBRENTEU,DCOILWTICO` daily CSV keyless (DS-17, verified working, gapfill-3), GBFS (DS-10), OSM Overpass road geometry cached per city (DS-07), CCTV frame snapshots at source cadence (~1 frame/min, DS-06), GPS-jamming derived from ADS-B NIC/NACp fields hex-binned (DS-11 — a derivation, not a feed).
- **Rate-limit handling**: per-source token bucket honoring published limits; on 429/ban, exponential backoff and a gap marker — never rotate keys/IPs to evade limits (this is a public-data project; see §5).
- **Enrichment** (DS-18, gapfill-4): MMSI→IMO via AIS msg 5 else Global Fishing Watch `/v3/vessels/search` (free token); IMO→particulars from GFW registryInfo, per-IMO cache ~30-day TTL; Equasis + IMO GISIS rendered as analyst **deep links only** (their ToS forbid bulk harvesting).
- **Serving**: the thin backend exposes (a) `/live/<ds>` = proxied, short-TTL-cached current state; (b) `/chunks/<ds>/<yyyy-mm-dd>.json(.br)` = static files, CDN-cacheable; (c) `/scenes/<id>.json` = curated scene manifests (name, description, date_range, camera preset, layer toggles, event-set ref, gates, speed presets — all fields visible in CAP-42 UI).

### 2.3 AI layer

Proposal — thin, provider-agnostic, all keys server-side:

- **Scene summary** (CAP-49): backend endpoint takes current camera pose + visible layer states → one LLM call → short caption. Cheap model, debounced.
- **Voice command** (CAP-48 — single-image evidence, so this is mostly design): browser Web Speech API for STT (free, no key), transcript posted to `/ai/intent`, LLM returns a constrained JSON intent (`fly_to | toggle_layer | set_style | set_time | track_entity | ask`), frontend executes. `ask` falls through to a summary answer. No agent loop, no tool-use framework — one call, one JSON schema.
- **Anomaly surfacing** (CAP-50 — roadmap in the original, roadmap here): deferred; the decide-layer is post-MVP (backlog, 05-improvements.md).
- **Ground Truth Card curation** (DS-16): MVP = manual JSON authoring of event records (category, UTC, title, attacker/target, precision, provenance, damage, media[]); auto-ingest from GDELT is a later work package. Auto-curation by the original is unevidenced.

### 2.4 Storage (4D playback datasets)

Proposal, matching the evidenced on-screen storage model (STK-12, gapfill-1):

- **Chunk = one file per data source per UTC day**: per-entity downsampled position keyframes (1–5 min resolution — at the demonstrated 6 H/S playback speed a full day renders in 4 s, so raw message logs are useless; the client interpolates between keyframes).
- **Aggregate sidecars per day**: gate-crossing events w/ direction, active-entity counts, dark-transit events (AIS gap > N min inside corridor, N tunable), daily oil closes — these feed the analytics panels (CAP-15/36/37) without the client re-scanning tracks.
- **Format**: brotli-compressed JSON to start; columnar (Parquet/Arrow) only if chunk sizes demand it. `# ponytail: JSON day chunks; switch to Arrow when a day chunk exceeds ~10 MB compressed.`
- **Store**: local filesystem behind the backend for dev; any S3-compatible bucket for durability. No database required for playback — chunks are immutable after their day closes.
- **Media** (event-card photos/videos): stored alongside chunks, referenced by relative path from event records.

---

## 3. Key design decisions (proposals, with rationale)

| # | Decision | Rationale | Tradeoff accepted |
|---|----------|-----------|-------------------|
| D1 | **Thin backend proxy, not client-only** | (a) API keys (Google Map Tiles, Cesium ion default token, aisstream, GFW, Cloudflare Radar) never ship to the browser; (b) recording is mandatory anyway (§1 hard constraints) so a server exists regardless; (c) one shared cache respects upstream rate limits across all viewers; (d) CORS: several feeds are not browser-fetchable. | Lose "just open index.html" single-file deployability the original demoed locally (STK-09). Mitigation: backend is one process with a `docker compose up`; a demo mode can run the viewer against pre-recorded chunks with only the (referrer-restricted) tiles key exposed. |
| D2 | **Record-first archiver from day one** | Verified: no free backfill exists for air (OpenSky ≤1 h) or AIS (aisstream = 0). History starts the day the recorder starts — same conclusion the original reached ("before the caches cleared", STK-10). | Storage/ops cost of always-on daemons; paid backfill (Kpler/Spire raw AIS) is the only recovery path for gaps. |
| D3 | **CesiumJS, WebGL2** | Only engine with first-class Google Photorealistic 3D Tiles + time-dynamic entities + built-in `PostProcessStage`; matches the evidenced original (STK-01/02/05). deck.gl/Three.js would mean hand-rolling 3D Tiles streaming and the time engine. | Cesium bundle weight; ion dependency for tile streaming (can point at Google's tiles endpoint directly if needed). |
| D4 | **No meta-framework; plain TS + small store** | The app is one canvas + HUD; SSR/routing are dead weight. Evidence: original framework undisclosed (STK-06); Next.js belongs to the clone. | Team familiarity; revisit if HUD grows past ~20 stateful panels. |
| D5 | **Single time engine owning LIVE/PLAYBACK** | Every demonstrated analytic (crossing counts, oil matrix, KPI tiles, playback lens) is a pure function of the playhead (CAP-36/37/41). One clock prevents the classic desync bugs. | Layers can't run private clocks (e.g. satellite "now" must be playhead-now too). |
| D6 | **LLM calls server-side, single constrained-JSON intent schema** | Keys off the client; voice/AI is swappable across providers; no agent framework for what is one call per utterance. | No multi-step tool-use reasoning at MVP; add if intents prove insufficient. |
| D7 | **Descope Argus** (CAP-51/STK-11) | Personal-camera perception is a second product; build status of the original's Argus is itself unresolved (possibly a mockup — sec_gaps open question). | None for this program. |
| D8 | **Chroma/vector search excluded** | STK-13 is uncorroborated secondhand. Nothing in the 57 capabilities needs embeddings. | Re-evaluate if the July 2026 code drop proves otherwise. |
| D9 | **Immutable day chunks + sidecar aggregates** | Matches the evidenced "8 CACHED DAY CHUNKS" model (STK-12); immutability makes CDN caching and client LRU trivial; aggregates make analytics O(days) not O(messages). | Late-arriving data within a closed day requires chunk re-emit (acceptable: recorder writes the current day to a `-partial` file, finalizes at UTC rollover). |

---

## 4. Module breakdown — work packages

Proposal. Each package is independently buildable and testable by one dev agent; dependency edges noted. IDs are `WP-nn`.

| WP | Name | Scope | Depends on | Delivers CAPs |
|----|------|-------|-----------|---------------|
| WP-01 | Viewer core | Cesium bootstrap, Google 3D Tiles, basemap switcher, camera controls, POI fly-to | — | CAP-01/02/03/43 |
| WP-02 | Backend skeleton | HTTP service, `/live` proxy w/ per-source TTL cache + token buckets, key vault via env, `/chunks` static serving | — | (infra) |
| WP-03 | Layer manager + HUD | Layer registry, DATA LAYERS panel, chip bar, isolation/panoptic, layout themes, CLEAR UI | WP-01 | CAP-06/07/30/31 |
| WP-04 | Time engine | LIVE/PLAYBACK modes, playhead, speed presets, day-chunk prefetch + LRU, playback lens HUD | WP-01, WP-02 | CAP-38/39/40/41 |
| WP-05 | Recorder swarm | Per-source daemons (§2.2), day-chunk writer, gap markers, aggregate sidecars, supervision | WP-02 | (enables all playback) |
| WP-06 | Air layers | OpenSky live + recorded aircraft, adsb.lol military layer, click-to-track, GPS-jamming hex derivation | WP-03/04/05 | CAP-08/09/10/21 |
| WP-07 | Maritime | AIS vessel rendering, trails, dossier w/ GFW enrichment + per-field Unknown fallback, dark-transit detection, gate-crossing analytics | WP-03/04/05 | CAP-13/14/15, DS-18 |
| WP-08 | Satellites | CelesTrak GP fetch, satellite.js SGP4 client propagation, orbit draw, imaging-sat layer, AOI access lines (elevation-mask rule, tunable — inferred, [SPECULATIVE] in original) | WP-03/04 | CAP-11/12/29 |
| WP-09 | Static/low-rate layers | Quakes, NEXRAD, bikeshare GBFS, country boundaries, pipelines, infrastructure, internet outages, airspace polygons (hand-curated per scene where no free NOTAM source — DS-12 gap) | WP-03 | CAP-17/18/19/22/23/24/27/28 |
| WP-10 | Post-processing | GLSL preset chain (CRT/NVG/FLIR/Anime/Noir), per-effect controls, hotkeys | WP-01 | CAP-04/05/44 |
| WP-11 | Events & cards | Event record schema, geo-anchored Ground Truth Cards, taxonomy badges, vessel attack cards, manual curation tooling | WP-03/04 | CAP-33/34/35 |
| WP-12 | Scenes & analytics | Scene manifest format + dropdown, analyst presets/filters, KPI tiles, oil risk matrix (FRED), hex density | WP-04/09/11 | CAP-32/36/37/42/56 |
| WP-13 | AI & voice | `/ai/summary`, `/ai/intent`, Web Speech capture, intent executor | WP-02/03 | CAP-48/49/53 |
| WP-14 | Cinematic & capture | Orbit/spiral rig, shot planner, saved locations, street-traffic particle system (Overpass, class-ordered loading, particle cap) | WP-01/03 | CAP-16/45/46/47 |

Suggested build order: WP-01+02 in parallel → WP-03/04/05 → WP-06/07/08/09/10 in parallel → WP-11/12/13/14. **Start WP-05 recorders the moment WP-02 lands** — every day not recording is a day of history lost (D2).

---

## 5. Non-goals

Binding scope exclusions for every work package:

1. **No classified or proprietary data fusion.** All feeds are public/open (the original's explicit framing: "No classified clearances. Just open a tab" — https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator). Adtech geolocation (DS-20) stays a narrated concept, never a layer.
2. **No scraping of non-public data, no auth bypass, no ToS evasion.** No Equasis/GISIS bulk harvesting (deep links only), no unsecured-camera directories (Insecam-style), no key/IP rotation to dodge rate limits, no paywalled-content extraction.
3. **No targeting of private individuals.** Entity tracking is limited to broadcast transponders (ADS-B/AIS/TLE) and published public infrastructure; the street-traffic layer is simulated particles from OSM geometry (DS-07), not real vehicle telemetry.
4. **No Argus** personal-surveillance surface (D7).
5. **No live trading/market execution** off the oil panel — display only.
6. **No custom globe engine, no vector-search layer, no LLM agent framework** at MVP (D3/D8/D6).
