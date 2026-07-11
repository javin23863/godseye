# 06 — Roadmap: Milestoned Build Plan

Audience: the dev agent building **godseye**. Milestones are strictly ordered; each ends in a demoable state. IDs (CAP-xx / DS-xx / UI-xx / STK-xx) resolve to the capability, data-source, UI, and stack spec docs in this folder. All feeds are public/open data — keep every milestone that way (no scraping private data, no auth bypass, respect each feed's ToS).

Sizes: **S** = ~days, **M** = ~1–2 weeks, **L** = ~2–4 weeks of agent effort. (Original was built in ~3 days by one operator driving multiple coding agents — `https://www.linkedin.com/posts/bilawalsidhu_i-built-worldview-in-three-days-but-i-also-activity-7432079812619550720-O3Gb`, STK-08 — so sizes assume parity *plus* the hardening the original skipped.)

---

## Build-order rationale

1. **Globe first.** Every capability renders onto the CesiumJS + Google Photorealistic 3D Tiles globe (STK-01, STK-02, CAP-01). Nothing else can be demoed without it, and it is the only component with a hard external cost dependency (Google tile quota), so its fallback path must exist from day 0.
2. **One layer end-to-end in M0.** The layer pipeline (fetch → normalize → entity render → toggle → attribution) is the app's core abstraction (CAP-07). Proving it once with the simplest keyless feed (USGS earthquakes, DS-08) de-risks every later layer: each becomes "write a feed adapter".
3. **Crash-proofing before scale.** The original crashed the browser on naive particle spawning and was rescued by ad-hoc sequential loading (`vid_rXvU7bPJ8n4 [09:39]`, `[09:44]`). We front-load an entity budget + progressive streaming rule in M1, *before* fusing 7K flights (CAP-08) + global AIS (CAP-13), not after the first crash.
4. **Live layers (M1) before style (M2).** Shaders are pure client-side polish with zero data risk; feeds have keys, rate limits, and CORS issues that need soak time. Get data flowing early, make it pretty second.
5. **4D (M3) before AI (M4).** The recorder/archive is what AI analysis, baselines, and NL query run over. The original's day-chunk playback (STK-12) shows the minimum viable shape; AI without an archive is a caption generator.
6. **Parity long-tail (M5) after the spine.** CCTV projection, weather, jamming, particles etc. are each self-contained feed adapters + renderers on machinery built in M0–M3.
7. **Improvements last (M6+).** The verified backlog (sec_improvements) is ranked quick-win → medium → moonshot and mostly depends on the M3 archive.

Out of scope for this roadmap: **Argus** personal perception pipeline (CAP-51, STK-11) — a separate product surface, not the geospatial command center. **Adtech geolocation** (DS-20) — concept-only in the source material and not an open feed; excluded to keep the project on public data.

---

## M0 — Skeleton: globe + one layer end-to-end

**Goal:** A browser tab showing the photorealistic 3D globe with correct attribution, basemap switching, and one live layer (earthquakes) proving the full layer pipeline.

| | |
|---|---|
| In-scope CAP | CAP-01 (photoreal globe), CAP-03 (basemap switch Google 3D / aerial+labels / road), CAP-17 (earthquakes 24h), CAP-57 (runs entirely in browser) |
| In-scope DS | DS-01 (Google Photorealistic 3D Tiles via Cesium ion), DS-08 (USGS FDSN GeoJSON, free, no key, 1-min refresh) |
| Stack anchors | STK-01 (CesiumJS), STK-02 (Google 3D Tiles), STK-06 (original stack undisclosed — pick our own: plain TS + CesiumJS is sufficient; do **not** cargo-cult the community clone's Next.js/Zustand stack, which is worldview_oss's, not Sidhu's) |
| Size | **S** |

**Exit criteria (demoable):**
- Globe loads Google Photorealistic 3D Tiles with the standard Cesium/Google attribution bar visible (matches repo hero: `repo-asset:god-view-hero-crt.jpg` shows Cesium ion + "Google Maps Data" credit, STK-01).
- Basemap toggles between Google 3D / aerial-with-labels / road without reload (CAP-03, `vid_ccZzOGnT4Cg frame_14 [09:18]`).
- USGS all_day earthquakes render as points, auto-refresh ≤ 5 min, layer toggles on/off.
- Google tile requests fail gracefully to the 2D aerial basemap (proposal — quota protection, see risk R1).
- Secrets (Google Map Tiles API key, Cesium ion token) load from env/config, never committed.

---

## M1 — MVP: core live layers + layer manager + basic HUD

**Goal:** The fused common operational picture: flights, military aircraft, satellites, and ships live on the globe, managed by a layer panel with counts, under a hard entity budget.

| | |
|---|---|
| In-scope CAP | CAP-07 (toggleable layer system + chip bar), CAP-08 (commercial flights ~7K), CAP-09 (military ADS-B layer, orange), CAP-11 (satellites + click-to-draw orbit), CAP-13 (AIS vessels as directional arrows + trails; basic dossier from raw AIS fields), CAP-24 (country boundaries), CAP-30 (layer filtering/isolation) |
| In-scope DS | DS-02 (OpenSky /states/all, OAuth2, credit-limited), DS-03 (military: adsb.lol /v2 or airplanes.live — ADS-B Exchange has **no free API** since 2023), DS-04 (CelesTrak GP + satellite.js SGP4 client-side), DS-05 (aisstream.io WebSocket, free non-commercial, bounding-box subscribe), DS-21 (Natural Earth boundaries) |
| Size | **L** |

**Exit criteria (demoable):**
- All four tracking layers live simultaneously; layer panel shows per-layer icon + name + count + ON/OFF (CAP-07, `vid_0p8o7AeHDzg frame_03/frame_05`).
- Flights update on a poll interval that stays inside OpenSky's daily credit budget (DS-02: ~400–4,000 credits/day); military layer visually distinct (orange/yellow, CAP-09, `vid_0p8o7AeHDzg [07:14]`).
- Satellites propagate client-side via SGP4; clicking one draws its orbit/ground track + altitude readout (CAP-11, `vid_rXvU7bPJ8n4 [02:33]–[03:04]`).
- Ships render as heading arrows with track trails inside a subscribed bounding box; click opens a dossier of raw AIS fields, "Unknown" per missing field (CAP-13, DS-18 pattern, `vid_ccZzOGnT4Cg frame_05/frame_09`). Full registry join deferred to M6.
- Isolation filter works ("only military planes", CAP-30, `vid_rXvU7bPJ8n4 [04:59]`).
- **Engine rule (proposal, mandatory):** hard on-screen entity budget + viewport-tiled fetch + worker-thread parsing + clustering above threshold — the systemic version of the sequential-loading fix that saved the original from browser crashes (`vid_rXvU7bPJ8n4 [09:39]`). Demo: enable all layers at global zoom, no tab crash, FPS ≥ 30.

---

## M2 — Style & UX: shaders, HUD, scenes, tracking

**Goal:** The signature look-and-feel: sensor-style presets, post-processing controls, HUD spec, camera/scene system, click-to-track.

| | |
|---|---|
| In-scope CAP | CAP-04 (Normal/CRT/NVG/FLIR/Anime/Noir presets, number-key cycling), CAP-05 (bloom/sharpen/pixelation/distortion controls), CAP-06 (CLEAN-UI / HUD toggle / layout themes), CAP-10 (click-to-track aircraft, camera lock + untrack), CAP-43 (POI navigation centered on OSM 3D volumes), CAP-44 (hotkeys: numbers = styles, Q/W/E/R/T = city POIs), CAP-45 (shot planner: capture/load/update Shot 1..N), CAP-46 (cinematic camera: orbit °/s, spiral in/out, altitude/pitch/FOV, target presets), CAP-47 (saved locations panel), CAP-53 (search box: fly-to for places/entities) |
| In-scope DS | DS-07 (OSM Overpass — POI volume centering; also pre-work for M5 traffic) |
| Stack anchors | STK-05 (browser shader post-processing; original evidenced as WebGL-class with a WebGPU mention — implement as Cesium post-process stages, GLSL) |
| Size | **M** |

**Exit criteria (demoable):**
- All six style presets cycle live via number keys and a preset dock showing ACTIVE STYLE (CAP-04, `repo-asset:god-view-hero-crt.jpg`, `vid_rXvU7bPJ8n4 [01:09]`); FLIR is labeled as a **stylized look, not thermal data** in the UI (honesty requirement from observed limitation, `vid_7HEUCLc7aL8 frame_12`; real thermal is M6 backlog).
- Bloom toggle + sharpen slider with % readout function per-preset (CAP-05, `vid_rXvU7bPJ8n4 frame_03/frame_21`).
- Click any aircraft → camera locks and follows in real time; toggle off (CAP-10, `vid_rXvU7bPJ8n4 [03:37]`).
- POI chips fly to landmarks centered on OSM 3D volumes, not raw lat/lon (CAP-43, `vid_rXvU7bPJ8n4 [01:50]–[02:10]`); Q/W/E/R/T cycles a city's POIs (CAP-44).
- Shot planner saves/loads ≥ 3 camera shots; orbit/spiral camera modes run at set °/s (CAP-45/46, `vid_rXvU7bPJ8n4 [01:24]`, `vid_ccZzOGnT4Cg frame_01`).
- AI scene caption (CAP-49) is **stubbed** here with a template ("<STYLE> GLOBAL NEAR <POI>") — LLM version lands in M4.

---

## M3 — 4D: recorder, timeline playback, gate analytics, dark vessels

**Goal:** Time as a first-class axis: record everything live, scrub it back at variable speed, and run the two flagship analytics (chokepoint gates, dark-vessel detection) over the recording.

| | |
|---|---|
| In-scope CAP | CAP-38 (4D playback, draggable playhead, color-coded event dots), CAP-39 (speed presets 1m/s → 2d/s), CAP-40 (LIVE vs PLAYBACK segmented toggle — make LIVE real, unlike the original where only PLAYBACK was ever demonstrated), CAP-41 (playback lens: floating date HUD anchored to timeline), CAP-42 (curated scene presets: named + date-bounded + layer config), CAP-14 (dark-transit detection, DARK TRANSIT WATCH list, SEEN AGAIN reacquisition marker), CAP-15 (inner/outer gate lines, per-day IN/OUT crossing counts), CAP-37 (pre/post baseline KPI tiles), CAP-36 (timeline-synced oil risk matrix), CAP-33 (geo-anchored Ground Truth Cards), CAP-34 (event taxonomy + precision/provenance chips), CAP-35 (vessel attack/damage cards), CAP-56 (analyst temporal presets + belligerent filters) |
| In-scope DS | DS-16 (OSINT event records — **manually curated GeoJSON scene files in M3**; automated GDELT/ACLED pipeline is M6), DS-17 (oil futures — FRED daily closes, keyless CSV verified per DS-17, with an explicit provenance chip; the original's source was never named), DS-19 (news cards inside scene files) |
| Stack anchors | STK-12 (original served AIS playback from day-partitioned cached chunks — "8 CACHED DAY CHUNKS", `vid_ccZzOGnT4Cg frame_05`; replicate day-partitioning as the storage unit, design the schema so M6's continuous archive can replace it without a rewrite) |
| Size | **L** |

**Exit criteria (demoable):**
- Recorder persists all live-layer states (flights/military/sats/ships/quakes) to day-partitioned files; PLAYBACK scrubs any recorded range with the playhead, color-coded event dots, and speed presets including ≥ 6h/s compression (CAP-38/39, `vid_ccZzOGnT4Cg [01:46]`).
- LIVE/PLAYBACK toggle switches modes without reload; LIVE shows per-layer freshness (CAP-40 — improvement over original, proposal).
- Gate lines across a configurable strait produce **exact, deterministic** per-day IN/OUT counts (segment-intersection, not the original's narrated "about eight" estimates, `vid_7HEUCLc7aL8 [03:39]` — quick-win pulled forward) feeding PRE AVG / POST AVG / DELTA tiles (CAP-15/37, `vid_ccZzOGnT4Cg frame_04`: 126.3 / 9.8 / −92.2%).
- Dark-transit detection: AIS gap > threshold inside an AOI → dashed track + DARK TRANSIT WATCH entry; AIS reacquisition renders SEEN AGAIN (CAP-14, `vid_ccZzOGnT4Cg [05:50]–[05:59]`, `https://www.spatialintelligence.ai/p/one-chokepoint-controls-everything`).
- One complete curated scene preset ("named event, date-bounded, layers + camera") loads from a dropdown and replays end-to-end with Ground Truth Cards leader-lined to map anchors (CAP-42/33/34, `vid_ccZzOGnT4Cg frame_14/16/17`).

---

## M4 — AI + voice

**Goal:** The intelligence layer: voice command, LLM scene analysis, and in-app entity dossiers.

| | |
|---|---|
| In-scope CAP | CAP-48 (voice command: "STOP \| LISTENING — Ask or command", `repo-asset:god-view-hero-crt.jpg`; interaction details beyond the hero image are [SPECULATIVE] — original never demoed a live voice session), CAP-49 (AI scene summary, now LLM-backed location-aware captions), CAP-53 (search box upgraded to NL commands: fly-to, layer toggles, time jumps) |
| Backlog pulled in | In-app entity dossier (quick-win #1 from sec_improvements): click any satellite/aircraft/vessel → AI dossier card from CelesTrak/registry metadata + one cached LLM lookup per NORAD/ICAO/MMSI — fixes the observed "left the app to Google a satellite" gap (`vid_0p8o7AeHDzg [01:57]`) |
| In-scope DS | none new (LLM API is infrastructure, not a data layer) |
| Size | **M** |

**Exit criteria (demoable):**
- Voice: push-to-talk → STT → intent → executed command ("show military flights", "go to Strait of Hormuz", "play at 1 hour per second") with the STOP/LISTENING state pill (CAP-48).
- Every tracked entity click offers a dossier card with identity/operator/context, cached by canonical ID; failures degrade to raw feed fields, never invented facts (proposal — provenance bar per observed fault-attribution risk `vid_CHLFl26p7Po [10:54]`).
- Scene captions update on camera move (CAP-49, `vid_rXvU7bPJ8n4 frame_03`).
- All LLM output visually tagged as AI-generated with source chips (proposal).

---

## M5 — Parity long tail: CCTV, weather, jamming, remaining layers

**Goal:** Close out every remaining observed capability so the rebuild reaches feature parity with all five videos.

| | |
|---|---|
| In-scope CAP | CAP-20 (CCTV mesh: fly-to camera, frustum, feed projected onto 3D tiles + calibration controls), CAP-18 (weather radar), CAP-21 (GPS jamming hex tiles — computed live from ADS-B NIC/NACp integrity fields riding the M1 flight feed, DS-11 gpsjam method), CAP-16 (OSM traffic particle system with VEH-XXXX labels — **must** ship on the M1 entity budget; this is the exact layer that crashed the original, `vid_rXvU7bPJ8n4 [09:39]`), CAP-02 (oblique-imagery fallback where Google 3D coverage is absent, e.g. Dubai, `vid_rXvU7bPJ8n4 [06:10]`), CAP-12 (satellite→ground access/AOI lines), CAP-22 (airspace closure polygons + banners), CAP-23 (internet blackout layer), CAP-25 (OSINT social events layer), CAP-27 (pipeline routes), CAP-28 (critical infrastructure/desal layers), CAP-29 (imaging-satellite subset + overflight awareness), CAP-31 (panoptic fused mode + opacity + per-entity checkboxes), CAP-32 (hex density overlay), CAP-54 (2D analyst dashboard as second coordinated view + zoom transition), CAP-55 (before/after imagery BDA compare), CAP-19 (bikeshare — wire it or **delete the toggle**; dead controls were observed demo-debt), CAP-26 (VHF intercept — undemoed in original, no evidenced feed: [SPECULATIVE], recommend cut) |
| In-scope DS | DS-06 (public DOT CCTV: Austin open data et al. — public feeds only, no Insecam-style unsecured cams), DS-09 (weather: UI in the original names **NOAA NEXRAD** as the provider — US coverage; RainViewer for global is a proposal), DS-11 (jamming from ADS-B integrity fields), DS-07 (OSM Overpass road geometry), DS-12 (airspace: FAA NOTAM API + national mirrors; no single free global NOTAM API exists), DS-13 (blackouts: Cloudflare Radar + IODA), DS-10 (bikeshare: GBFS), DS-14/DS-15 (imagery: Capella Open Data, Copernicus Sentinel, NASA GIBS free tier for BDA compare), DS-19 (news/wire cards) |
| Size | **L** (parallelizable — each layer is an independent feed adapter on M0/M1 machinery) |

**Exit criteria (demoable):**
- CCTV: pick a mapped Austin camera → fly to it → live frame projected onto 3D geometry via frustum, calibration sliders + save; refresh at best available cadence, labeled (original was 1 frame/min, `vid_rXvU7bPJ8n4 [06:59]`).
- Jamming hexes computed from live integrity fields, no curated input (improvement over original's per-episode data, DS-11).
- Traffic particles load progressively (main roads → arterial) inside the entity budget; zero crashes in a 30-min soak with all layers on (lesson: `vid_rXvU7bPJ8n4 [09:39]/[09:44]`).
- Panoptic mode stacks sats + flights + maritime + quakes + traffic with opacity control (CAP-31, `vid_rXvU7bPJ8n4 [08:08]`).
- Every layer toggle in the UI is backed by a real feed or removed (no built-but-dead controls, observed debt `vid_7HEUCLc7aL8 frame_21`).
- Earthquakes (listed for parity here) were completed in M0.

---

## M6+ — Improvements backlog (beyond parity)

**Goal:** Exceed the original using the verified, ranked backlog in sec_improvements. Work the tiers in order; respect dependencies. All items are proposals grounded in observed limitations.

| Tier | Items (dependency →) |
|---|---|
| Quick wins | In-app entity dossier (done in M4) · Fires/natural-events layer (NASA FIRMS + EONET, DS-22) · Deterministic gate tallies + CSV export (done in M3) · Fold dark transits into gate counts as third class → needs gate tallies · TLE staleness/confidence badges on satellites · Live GPS-jamming from integrity fields (done in M5) · Wire-or-delete weather/bikeshare toggles (done in M5) · Automated internet-outage feed (Cloudflare Radar + IODA) · Live oil feed with provenance stamp · Progressive entity streaming/clustering engine rule (done in M1) |
| Medium | **Continuous always-on archive** (kill day-chunks; append-only columnar store — the single highest-leverage unlock) · Ship LIVE mode for real (done in M3) → needs streaming engine · Automated OSINT event pipeline with verification tiers (GDELT GEO 2.0 + ACLED + geocoded RSS → taxonomy + human-review promotion to VERIFIED) · Provenance & confidence chain on every derived claim · Vessel registry enrichment (kill the all-Unknown dossier; GFW/Equasis/ITU joins) · Sentinel-1 SAR dark-vessel reacquisition → needs archive · Real thermal layer (GIBS VIIRS brightness-temp; stop faking FLIR) · CCTV auto-calibration (PnP solve vs 3D tiles) + best-available frame rate · Anomaly decide-layer v1 (rolling baselines, deviation-only alerts, hard alert-rate cap — CAP-50's stated bar: "what changed / what's anomalous", not detection spam, `vid_CHLFl26p7Po [14:13]`) → needs archive |
| Moonshots | Natural-language spatiotemporal query over the archive → needs archive · Imaging-overflight prediction & AOI watch (forward SGP4 access windows; routes around the 2-week commercial imagery hold, `vid_ccZzOGnT4Cg [12:46]`) · Multi-source dark-target fusion cell (AIS gaps × open SAR × jamming × events) → needs SAR reacquisition · Agent-swarm continuous curation with auto-geolocation against the 3D tiles → needs OSINT pipeline · Historical time machine (multi-year replay from archival feeds) → needs archive |

Size: ongoing; sequence quick-wins (S each) → archive (L, gating) → the rest.

---

## Risk register

| # | Risk | Evidence / basis | Mitigation |
|---|---|---|---|
| R1 | **Google 3D Tiles quota/cost.** Map Tiles API is free-credit-then-pay-per-request (DS-01); a fused globe with constant camera motion burns tile requests fast. | DS-01; STK-02 | Cesium ion caching defaults; cap camera auto-orbit tile churn; automatic fallback to 2D aerial basemap on quota errors (CAP-03 machinery); usage alerting from day 0. |
| R2 | **Browser perf / entity counts.** Original crashed the tab on naive particle spawning; fixed only by operator-directed sequential loading (main roads first, then arterial). | `vid_rXvU7bPJ8n4 [09:39], [09:44]` (sec_improvements) | M1 engine rule: hard entity budget, viewport-tiled fetch, worker parsing, clustering, graceful degradation. Traffic particles (M5) ship only on this rule. Soak test in every milestone's CI. |
| R3 | **AIS cost.** "AIS is the expensive input" relative to free flight tracking. | `vid_CHLFl26p7Po [13:06]` (sec_improvements); DS-05 | aisstream.io free WebSocket (non-commercial, bounding-box) for build phase; scope subscriptions to active AOIs; budget line before any paid feed (Datalastic ~€99/mo). Non-commercial terms constrain any future monetization — flag before shipping publicly. |
| R4 | **Feed rate limits & auth churn.** OpenSky is credit-limited (~400–4,000/day, OAuth2); ADS-B Exchange has no free API since 2023; Overpass is fair-use. | DS-02, DS-03, DS-07 | Poll-interval budgeter per feed; military layer on adsb.lol/airplanes.live (keyless); cache Overpass results per city; adapter interface so providers swap without touching renderers. |
| R5 | **API key sprawl.** Google Map Tiles key, Cesium ion token, aisstream key, OpenSky OAuth2, FIRMS MAP_KEY, ACLED key, Cloudflare Radar token. | DS-01..22 | Single env-config module, fail-soft per layer (missing key = layer disabled with reason in the layer panel, not a crash); no keys in repo. |
| R6 | **CORS / feed proxying.** Several public feeds (DOT CCTV MJPEG, NOAA, GDELT) won't serve browser CORS. (proposal) | — | Thin same-origin proxy with per-feed allowlist and cache headers; keeps the app static-hostable otherwise. |
| R7 | **No reference code.** Original is closed-source placeholder until ~July 2026; stack beyond CesiumJS+Google tiles is undisclosed; circulating Next.js stack belongs to the worldview_oss clone. | STK-06, STK-09 | Build from this spec's evidence, not clone code; keep architecture swappable where the spec says [SPECULATIVE]; diff against the real repo when it drops. |
| R8 | **Demo-stage features may not exist as shown.** Only polished b-roll was ever published; LIVE mode, search, voice, and DETECT were never exercised on camera. | sec_improvements ("Only polished b-roll…"); CAP-40/48/53 notes | Treat those behaviors as design targets, not parity constraints; our exit criteria demand the live demo the original never showed. |
| R9 | **Satellite data staleness.** Untracked spy sats / last-known-position-only objects render as if live. | `vid_0p8o7AeHDzg [03:47]` (DS-04) | TLE epoch-age badges + confidence decay (M6 quick-win); never render stale objects as current without a marker. |
| R10 | **Imagery latency.** Commercial providers imposed a 2-week hold on fresh conflict imagery. | `vid_ccZzOGnT4Cg [12:46]` | BDA compare (CAP-55) designed for delayed imagery; overflight *prediction* (M6 moonshot) delivers timeliness without pixels; free Sentinel/GIBS as baseline. |
| R11 | **Legal/ToS drift.** Pressure to add "juicier" sources (unsecured cams, scraped private trackers). | DS-06 note (avoid Insecam-style cams); project charter | Hard rule: public/open feeds with documented terms only; per-layer source attribution rendered in-app; ToS reference recorded per DS id. |
| R12 | **Archive growth.** Recording all layers 24/7 (M3 recorder → M6 archive) grows unbounded. (proposal) | STK-12 (original punted via curated day-chunks) | Day-partitioned columnar files with retention tiers (full-res recent, downsampled historical); budget alarm on storage. |

---

## Milestone summary

| Milestone | Theme | Size | Gate to next |
|---|---|---|---|
| M0 | Globe + 1 layer end-to-end | S | Layer pipeline proven, tile fallback works |
| M1 | Core live layers + layer manager + entity budget | L | 4 tracking layers fused, no crash at global zoom |
| M2 | Shaders, HUD, camera/scenes, click-to-track | M | Full look-and-feel parity on live data |
| M3 | Recorder, 4D playback, gates, dark vessels | L | One curated scene replays end-to-end with exact analytics |
| M4 | Voice + AI captions + entity dossiers | M | Voice command round-trip live |
| M5 | CCTV, weather, jamming, particles, remaining layers | L | Every UI toggle backed by a real feed or deleted |
| M6+ | Improvements backlog (archive first) | ongoing | — |
