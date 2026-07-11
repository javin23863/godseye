# godseye — 01 Functional Spec (Capability Matrix)

Dev-agent-ready capability matrix for rebuilding (and improving on) Bilawal Sidhu's "God's Eye View" (formerly WorldView): a browser-based geospatial OSINT command center. Reverse-engineered from 5 demo videos, repo assets, and a web sweep; adversarially verified (122/125 claims CONFIRMED).

**How to read this document**

- Canonical IDs: `CAP-xx` (capabilities, this doc), `DS-xx` (data sources, `03-data-sources.md`), `UI-xx` (UI spec, `04-ui-spec.md`), `STK-xx` (stack conclusions, `02-architecture.md`). Keep IDs stable across all godseye docs.
- Every factual claim about the original app carries a citation: `vid_<id> [mm:ss]` (transcript timestamp), `vid_<id> frame_NN` / `montage_NNN` (extracted frame), `repo-asset:<file>`, or a URL key from the table below.
- **Verdict** = adversarial-verification outcome. Anything not CONFIRMED is tagged **[SPECULATIVE]** and must be treated as inferred, not observed.
- Text marked **[PROPOSAL]** is a design decision for the rebuild, not an observed behavior of the original. Proposals need no citation.
- **Legal boundary (binding on the build):** every feed is public/open data (ADS-B aggregators, AIS relays, TLE catalogs, USGS, NOAA, public traffic cams, open registries). No scraping of ToS-restricted services, no private data, no auth bypass. ToS-restricted registries (e.g. Equasis, IMO GISIS) are analyst **deep links only**, never automated pipeline sources. The "TOP SECRET // SI-TK // NOFORN" chrome is cosmetic theater over open data and must never imply real classification.

**Citation URL keys**

| Key | URL |
|---|---|
| ART-SPY | https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator |
| ART-CHOKE | https://www.spatialintelligence.ai/p/one-chokepoint-controls-everything |
| ART-MONO | https://www.spatialintelligence.ai/p/the-intelligence-monopoly-is-over |
| X-4D | https://x.com/bilawalsidhu/status/2028197571840106985 |
| USGS-FEED | https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php |
| HERO-CRT | repo-asset:god-view-hero-crt.jpg (github.com/bilawalsidhu/gods-eye-view) |
| HERO-CEN | repo-asset:god-view-hero-censored.jpg |

**Video IDs:** `rXvU7bPJ8n4` (WorldView build demo), `CHLFl26p7Po` (intelligence-monopoly essay video), `7HEUCLc7aL8` (Hormuz dashboard walkthrough), `0p8o7AeHDzg` (Iran war 4D replay), `ccZzOGnT4Cg` (chokepoint maritime deep-dive).

**Tally:** 57 capabilities. 56 CONFIRMED, 1 unverdicted (CAP-48 voice — [SPECULATIVE], single still-image evidence).

---

## 1. Globe (2)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-01 | Photorealistic 3D globe basemap | Full 3D globe rendered from Google Photorealistic 3D Tiles (streamed via Cesium ion per STK-01/STK-02) as the base map. Photoreal volumetric city meshes must load for at least Austin/NYC/SF/London/Dubai (city list video-only). Attribution credit bar (Cesium ion + Google Maps Data) must render per Google/Cesium terms. | ART-SPY ("Google's Photorealistic 3D Tiles — the same technology that powers Google Earth's volumetric city models"); vid_rXvU7bPJ8n4 [00:57]–[01:01], frame_03, frame_06; vid_CHLFl26p7Po [14:36]; vid_ccZzOGnT4Cg [09:18], frame_14; HERO-CRT | CONFIRMED |
| CAP-03 | Basemap style switching | Bottom `MAP:` toggle row with three mutually exclusive basemap modes: `GOOGLE 3D` (photorealistic tiles), `AERIAL+LBL` (aerial imagery + labels), `ROAD` (vector road style). Active button lit. Switching preserves camera pose and all entity layers. See UI-19. | vid_ccZzOGnT4Cg frame_14 (MAP row, GOOGLE 3D lit), [09:18]; vid_7HEUCLc7aL8 frame_11, [05:41] | CONFIRMED |

## 2. Layers (15)

All layers are independently toggleable from the left DATA LAYERS panel (UI-05) and/or the bottom chip bar (UI-20), with icon + name + provider subtitle + count badge + ON/OFF state (CAP-07).

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-07 | Toggleable live data-layer system | Left DATA LAYERS panel (icon + name + provider-attribution subtitle + live count badge + ON/OFF pill per row) and a bottom pill-chip bar with lit/unlit active states. Each layer toggles independently; toggling never reloads the app. The fused set forms one common operational picture. Verified panel roster in the WORLDVIEW build is exactly 8 rows: Live Flights, Military Flights, Earthquakes (24h), Satellites, Street Traffic, Weather Radar, CCTV Mesh, Bikeshare (no AIS row in that build — maritime lives in the war/maritime builds; see CAP-13 note). | vid_rXvU7bPJ8n4 frame_07, frame_08; vid_CHLFl26p7Po [08:04], montage_024 tile 1,1; vid_0p8o7AeHDzg frame_03, frame_05; 4K panel re-read (gapfill-2, hires/panel4k_02_top.png) | CONFIRMED |
| CAP-17 | Earthquake / seismic layer (24h) | Plot every seismic event of the last 24 h globally as map markers. Provider: USGS GeoJSON feed (DS-07; panel subtitle "USGS"). Refresh on toggle-on; count badge = event count. | vid_rXvU7bPJ8n4 [08:02], frame_07; vid_CHLFl26p7Po [08:04]; USGS-FEED | CONFIRMED |
| CAP-18 | Weather radar layer | Toggleable weather-radar globe overlay. Provider named on-screen: "NOAA NEXRAD (globe overlay)" (DS-09). Never demoed in any video — implement as a raster overlay of NEXRAD composite reflectivity; behavior beyond toggle is [PROPOSAL]. | vid_rXvU7bPJ8n4 frame_07, frame_08; vid_CHLFl26p7Po [08:04] (subtitle read at 4K, gapfill-2) | CONFIRMED |
| CAP-19 | Bikeshare layer | Toggleable city bikeshare mobility layer. Provider subtitle: "GBFS" (open General Bikeshare Feed Specification, not a single vendor). Never demoed — implement as station-status point layer from any GBFS endpoint; details [PROPOSAL]. | vid_rXvU7bPJ8n4 frame_07, frame_08; vid_CHLFl26p7Po [08:04] (4K subtitle read, gapfill-2) | CONFIRMED |
| CAP-21 | GPS jamming layer | GPS interference rendered as red hexagonal tiles whose intensity evolves over playback time. Derived signal: aggregate aircraft nav-integrity (NIC/NACp) broadcasts from ADS-B; low-confidence clusters = jamming cells. Red hex rendering + temporal evolution are video-observed; the derivation is stated in prose. | ART-MONO ("Every commercial aircraft broadcasts its GPS confidence level... aggregate enough of those signals, you can map where active GPS interference is happening"); vid_CHLFl26p7Po [10:16], [07:26]; vid_0p8o7AeHDzg [01:14], [07:43], frame_04 | CONFIRMED |
| CAP-22 | Airspace closure / restriction polygons | Country/zone closures render as translucent extruded red/orange polygons with glowing wall-like borders and dark rectangular on-globe banners "X AIRSPACE CLOSED" (UI-27). Closures appear/disappear as the timeline scrubs (cascading closures). Source: hand-curated per-scene polygon set (Natural Earth country polygons + closure flag in scene manifest) is the honest MVP path since no free global NOTAM-polygon feed reproduces the demo [PROPOSAL, per DS-12 gap]. | vid_0p8o7AeHDzg [05:23], [06:19], frame_16; vid_ccZzOGnT4Cg frame_14, frame_17; vid_7HEUCLc7aL8 frame_22; vid_CHLFl26p7Po [10:16] | CONFIRMED |
| CAP-23 | Internet blackout / outage layer | Internet disruption rendered as a red-labeled region/polyline, an INFRASTRUCTURE-category event card (e.g. "IRAN INTERNET DISRUPTION"), plus on-terrain red text label ("TEHRAN INTERNET BLACKOUT"). | vid_0p8o7AeHDzg [03:39], frame_09, frame_12; vid_CHLFl26p7Po [10:16], [10:19] | CONFIRMED |
| CAP-24 | Country boundaries layer | Toggleable country/admin boundary vector overlay (faint outline on dark basemap). | vid_7HEUCLc7aL8 frame_11 (lit "Country Boundaries" chip), frame_06; vid_CHLFl26p7Po [10:16] | CONFIRMED |
| CAP-25 | OSINT social events layer | Toggleable layer of OSINT/social-media-sourced events rendered as Ground Truth Cards (CAP-33) on the map. | vid_CHLFl26p7Po [10:16] ("OSINT Social Events" chip), [10:19] | CONFIRMED |
| CAP-26 | VHF/RF intercept layer | A "VHF Intercept" layer toggle exists in the chip bar but is never demonstrated. Ship the toggle; rendered content is undefined — implement as geo-tagged public marine-VHF event markers or descope, and mark whichever you do [PROPOSAL]. (Chip text could read UHF/RF at video resolution.) | vid_0p8o7AeHDzg frame_03, frame_05; vid_CHLFl26p7Po [10:16] | CONFIRMED |
| CAP-27 | Pipeline routes layer | Named strategic pipelines as labeled polylines (observed: "East-West Crude Oil Pipeline", Habshan–Fujairah). Static curated GeoJSON per scene is sufficient [PROPOSAL]. | vid_ccZzOGnT4Cg [07:21], frame_12, frame_13; vid_7HEUCLc7aL8 frame_15, frame_06 | CONFIRMED |
| CAP-28 | Critical-infrastructure & desalination layers | Toggleable location layers for desalination plants, refineries, gas complexes, general infrastructure ("Desal Plants" and "Infrastructure" chips). Static curated point sets per scene [PROPOSAL for sourcing]. | vid_ccZzOGnT4Cg [08:38], [08:52], frame_01; vid_7HEUCLc7aL8 frame_15 | CONFIRMED |
| CAP-30 | Layer filtering / isolation | Isolate a single entity class from the fused picture (e.g. only military planes visible, all else hidden) without losing other layers' loaded state. | vid_rXvU7bPJ8n4 [04:59]–[05:04] ("I can isolate basically all the military planes") | CONFIRMED |
| CAP-31 | Panoptic fused-picture mode | "Panopticon/God mode": one toggle stacks satellites + flights + maritime + earthquakes + traffic into a single detection-overlay picture. UI: green PANOPTIC toggle with opacity/density slider and per-entity checkboxes (Flights/Satellites/Maritime) in the right rail (UI-08). Exact semantics of the slider/checkboxes never explained on camera — implement as: master overlay opacity + per-class include flags [PROPOSAL]. | ART-SPY (Panoptic view / "God mode"); vid_rXvU7bPJ8n4 [08:08], [05:21], frame_07; vid_0p8o7AeHDzg frame_03, frame_21 | CONFIRMED |
| CAP-32 | Hex density overlay | Hex-bin density cells (blue/orange) over a region for at-a-glance activity mapping, rendered alongside (not replacing) event dots. Maps to the 2D dashboard's DENSITY chip (UI-22). | vid_ccZzOGnT4Cg frame_01, montage_001 tile r3,c6 | CONFIRMED |

## 3. Tracking (9)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-08 | Live commercial flight tracking | Render ~7,000 live aircraft (demo shows "6.7K flights") as oriented plane icons with per-aircraft callsign labels (cyan, UI-11). Provider: OpenSky Network (DS-02; panel subtitle "OpenSky Network"). Positions update at a credit-sustainable poll cadence (see §Acceptance/AC-10 recording math). | ART-SPY ("OpenSky Network — 7,000+ live aircraft positions, updated constantly"); vid_rXvU7bPJ8n4 [03:15], [03:20], frame_09; vid_0p8o7AeHDzg [01:12], frame_04 | CONFIRMED |
| CAP-09 | Military flight layer (crowdsourced ADS-B) | Separate toggle layer of military aircraft rendered orange/yellow, sourced from an unfiltered crowdsourced ADS-B aggregator (panel subtitle: "adsb.lol", DS-03) so aircraft absent from consumer trackers appear. Hover/selection tooltip: callsign, hex/serial, operator, altitude (UI-13, e.g. "R47T13 / C303 \| 07-0136 / Operator unknown \| 28000 ft"). | vid_rXvU7bPJ8n4 [04:30] ("this website called ADSB... crowdsourced data to track all the military planes"), [04:39], frame_12; vid_0p8o7AeHDzg [07:14] ("yellow planes are military planes"), frame_16; 4K subtitle read (gapfill-2) | CONFIRMED |
| CAP-10 | Click-to-track aircraft | Select any plane → camera locks and follows its live position; tracking toggles off to release the camera. See §Acceptance AC-08. | vid_rXvU7bPJ8n4 [03:37] ("track their location in real-time"), [03:23] ("turn off the tracking"); vid_CHLFl26p7Po [08:29] | CONFIRMED |
| CAP-11 | Satellite layer with click-to-track orbits | Layer of hundreds of labeled satellites (demo count: 180; names + NORAD IDs incl. rocket bodies like "SL-3 R/B") from CelesTrak TLEs (DS-04; panel subtitle "CelesTrak"), propagated client-side (satellite.js-class SGP4 [PROPOSAL, per STK-01 replica]). Sparse/full label-density modes. Click a satellite → selected-satellite card (name, NORAD ID, altitude e.g. "731 km"), yellow orbit polyline + red ground-track line (UI-12), and orbit-class readout (geostationary/geosynchronous). | vid_rXvU7bPJ8n4 [02:33]–[03:04], frame_07, frame_08; vid_CHLFl26p7Po [08:12]–[08:20]; vid_0p8o7AeHDzg [01:41], frame_07; HERO-CRT | CONFIRMED |
| CAP-12 | Satellite-to-ground access/AOI lines | When a satellite passes over an area of interest, fan lines connect it to ground target points, used to infer imaging opportunities. See §Acceptance AC-05. | vid_0p8o7AeHDzg [01:51] ("lines connect when they actually go over an area of interest"), frame_02, frame_08 | CONFIRMED |
| CAP-13 | Maritime / AIS vessel tracking with dossiers | Every vessel rendered as a directional arrow with track trail; click → selection ring (UI-25) + full dossier panel (UI-14): flag + name + type; ROUTE (destination/departure/ETA/ATA); RAW AIS; SPECS (gross tonnage, deadweight, draught, dimensions, built); OWNERSHIP. Per-field literal "Unknown" fallback ("?m x ?m" for dimensions) — never blank/zero/hidden. AIS static+voyage fields come from the AIS stream; tonnage/ownership require a registry join (DS-18; Global Fishing Watch vessel-identity API automated, Equasis/GISIS as deep links only). NOTE: this layer exists in the maritime/war builds (MAPTHEWORLD.AI + God's Eye), not in the 8-row WORLDVIEW panel (gapfill-2 negative finding). | ART-CHOKE; vid_ccZzOGnT4Cg [01:02] ("every arrow is a vessel"), [03:27], [03:47], frame_05, frame_09; vid_7HEUCLc7aL8 frame_02, frame_03; vid_CHLFl26p7Po [08:29]–[08:38] | CONFIRMED |
| CAP-15 | Chokepoint gate crossing-event analytics | Inner/outer "gate" polylines across a strait; each vessel track crossing a gate emits a crossing event with direction (IN/OUT); per-UTC-day counts feed the lens HUD (CAP-41/UI-24) and pre/post baselines (CAP-37). Watch text observed: "CROSSED INNER GATE". See §Acceptance AC-03. | vid_7HEUCLc7aL8 frame_02, [03:31], montage_011 tile 1,1; vid_ccZzOGnT4Cg frame_03, frame_08, frame_11 | CONFIRMED |
| CAP-16 | Street traffic particle system from OSM roads | Query OpenStreetMap road geometry (panel subtitle "OpenStreetMap"; Overpass API [PROPOSAL]) and spawn a particle system emulating city traffic along the road network, with per-vehicle `VEH-XXXX` labels in sparse/full modes. See §Acceptance AC-09. | ART-SPY ("OpenStreetMap — vehicle flow on city streets, rendered as a particle system"); vid_rXvU7bPJ8n4 [05:36]–[05:51], frame_14 | CONFIRMED |
| CAP-29 | Imaging-satellite layer & overflight awareness | Dedicated "Imaging Satellites" toggle rendering named commercial/defense imaging birds (observed: Pleiades Neo, WorldView Legion, SPOT, Persona-3, Gaofen, Capella, USA-234 (TOPAZ)) with overhead-pass awareness over the current AOI. Curated NORAD-ID watchlist over the CelesTrak catalog [PROPOSAL]. | vid_0p8o7AeHDzg [01:41]–[03:00], frame_07 ("USA-234 (TOPAZ)" label); vid_CHLFl26p7Po [10:16] (chip) | CONFIRMED |

## 4. Imagery (3)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-02 | Oblique-imagery fallback where no 3D coverage | Where Google 3D tiles have no coverage (demoed: Dubai/Burj Khalifa), the globe must degrade gracefully to off-nadir oblique satellite/aerial imagery while vector layers (road network, entities) continue to render on top. No hard failure, no blank tiles. | vid_rXvU7bPJ8n4 [06:10]–[06:28] (Dubai narration: no Google 3D, oblique imagery, street traffic still renders) | CONFIRMED |
| CAP-20 | Live CCTV mesh with 3D projection & calibration | Toggle live public CCTV cameras (demoed: Austin public traffic cams, DS-06); pick a camera → fly-to → project its live feed onto the 3D tile geometry via a camera frustum (projective texturing). Calibration subsystem: PROJECTION / COVERAGE / AUTO CAL / ALIGN-DRAPE / SAVE CAL controls + pose sliders. Panel subtitle: "CCTV Mesh + Street View fallback" (imagery fallback when no live feed). See §Acceptance AC-04. | ART-SPY ("real traffic camera feeds from Austin, geographically located and projected onto the 3D model... real camera footage draped onto real buildings, in real time"); vid_rXvU7bPJ8n4 [06:39]–[07:15], frame_16; vid_CHLFl26p7Po [13:10]; vid_7HEUCLc7aL8 frame_21; HERO-CRT | CONFIRMED |
| CAP-55 | Before/after satellite imagery BDA | Side-by-side / toggled before-vs-after commercial satellite imagery of a struck site for battle-damage assessment (source imagery subject to commercial providers' release holds — demo notes a two-week hold). Implement as a paired-image compare widget on a Ground Truth Card or site pin [PROPOSAL for placement]. | vid_ccZzOGnT4Cg [12:26] ("the before and after satellite imagery"), [12:46] | CONFIRMED |

## 5. Time (5)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-38 | 4D time playback & reconstruction | Scrubbable minute-by-minute replay of a multi-week recorded window (demoed: 2026-02-25 → 2026-04-03, ~38 days) with a draggable playhead, ms-precision UTC clock (observed 500 ms resolution: "2026-04-03 11:59:59.500Z"), and color-coded event dots on the scrubber. All layers (vessels, flights, jamming, closures, cards, oil matrix) re-render to the playhead time. See §Acceptance AC-01. | vid_ccZzOGnT4Cg [00:04] ("full 4D reconstruction"), [01:14]; vid_0p8o7AeHDzg [00:35], [01:01], frame_10; vid_7HEUCLc7aL8 frame_06, frame_15, [03:11]; X-4D | CONFIRMED |
| CAP-39 | Variable playback speeds | Time-compression preset chips. Observed sets: dashboard 30M/S…6H/S…1D/S; god-view narration cites 1m/s, 5m/s, 15m/s, 1h/s up to 2d/s. Speed switch is instant, playback stays smooth (interpolated), and slowing down to inspect behavior must not resample data. | vid_ccZzOGnT4Cg [01:46] ("playing back the scene at 6 hours per second"), frame_05 (30M/S–1D/S chips); vid_7HEUCLc7aL8 frame_15; vid_0p8o7AeHDzg [06:30] | CONFIRMED |
| CAP-40 | LIVE vs PLAYBACK modes | Top-center segmented toggle: LIVE (pass-through of current API state) vs PLAYBACK (reads only the recorded archive). Only PLAYBACK is ever demonstrated (LIVE always dimmed) — LIVE-mode behavior is therefore inferred: proxy latest snapshots at source-limited cadence [PROPOSAL]. | vid_ccZzOGnT4Cg frame_04 ("● PLAYBACK" pill), frame_14 (LIVE dimmed / PLAYBACK lit); vid_7HEUCLc7aL8 frame_07, frame_11; vid_0p8o7AeHDzg [01:00] | CONFIRMED |
| CAP-41 | Synchronized playback lens | Floating date HUD anchored to the timeline by a vertical cyan line: date header + tiles (N CROSSING EVENTS / N IN / N OUT) + footer "DARK TRANSIT: LAYER OFF" + grayed LIVE label (UI-24). Lens values re-slice per day as the playhead moves. | vid_ccZzOGnT4Cg frame_03 ("MAR 08, 2026", 17 crossings, 11 IN / 6 OUT); vid_7HEUCLc7aL8 [03:11], frame_06 | CONFIRMED |
| CAP-42 | Curated scene presets | Named, date-bounded event packages selectable from a `SCENE:` dropdown (observed: "Iran War Infrastructure ▼ \| Fixed-Site Strikes - Feb 28 to Mar 27, 2026"; also "Ceasefire Rescue"). Loading a scene sets topic, layer toggles, date range, camera, gates, and event set. Scene manifest = JSON: `{id, title, description, date_range, camera, layer_toggles, event_set_ref, gates[], speed_presets}` [PROPOSAL, fields all observed in UI-19/frame_14]. | vid_ccZzOGnT4Cg frame_14; vid_7HEUCLc7aL8 frame_11; HERO-CRT | CONFIRMED |

## 6. AI (4)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-49 | AI-generated scene summary | Auto-generated location-aware caption of the current shot, format `[STYLE] [SCALE] NEAR [LANDMARK] (CITY)` (observed: "NORMAL GLOBAL NEAR PALM JUMEIRAH (DUBAI)", "CRT GLOBAL NEAR CHRYSLER BUILDING"), rendered in the classification banner block (UI-02). Regenerates as camera/style changes. Nearest-landmark reverse lookup + template is sufficient; an LLM is not required for the observed output [PROPOSAL]. | vid_rXvU7bPJ8n4 frame_03, frame_06, frame_19; vid_7HEUCLc7aL8 frame_11, frame_21; HERO-CRT | CONFIRMED |
| CAP-50 | AI anomaly surfacing (decide layer) | Roadmap-grade requirement from the author: the system should automatically surface "what changed, what's anomalous" — NOT a barrage of raw detections ("unknown person detected at this timestamp"). Build as a ranked anomaly feed over layer deltas (new dark transit, gate-rate change beyond baseline, new closure, jamming-cell growth) [PROPOSAL for concrete triggers]. | vid_CHLFl26p7Po [14:13]–[14:25] | CONFIRMED |
| CAP-51 | Argus personal perception pipeline | Second surface turning the fusion framework inward on personal cameras: Meta SAM 2 segments feeds → Claude/Gemini infers context and writes natural-language alerts; private by default, optionally shareable (STK-11). **Scope decision: DESCOPED from the godseye rebuild MVP** — evidence is possibly motion-graphics-only (no cursor/interaction shown) and it is a separate product [PROPOSAL]. | vid_CHLFl26p7Po [13:29], montage_039 tile 3,1, montage_040 tile 1,1, [15:21]–[16:04] | CONFIRMED |
| CAP-52 | AI agent swarm OSINT ingest | An agent swarm captures every open-source signal before source caches clear, time-aligning them into the scrubbable 4D dataset (the record-first archiver, STK-10). One scraper agent per source, always-on. See §Acceptance AC-10. | vid_0p8o7AeHDzg [00:27]–[00:35] ("AI agent swarm to capture every open-source signal... before the caches cleared"); X-4D | CONFIRMED |

## 7. Voice (1)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-48 | Voice command interface | Bottom-right voice widget "STOP \| LISTENING — Ask or command" (UI-29): ask questions or issue commands by voice. Only evidence is a single still image — no interaction flow, STT provider, or grammar observed. See §Acceptance AC-07 for the inferred design. | HERO-CRT (widget visible in hero screenshot) | **[SPECULATIVE]** (no verification verdict; single-still evidence) |

## 8. Camera (4)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-43 | POI navigation with OSM-volume centering | City chip row + per-city landmark chip row (UI-07); clicking flies the camera to the landmark, centered on the landmark's OpenStreetMap 3D volume (building footprint + height), not raw lat/lon — so tall buildings frame correctly. | vid_rXvU7bPJ8n4 [01:50]–[02:10] (explicit OSM-volume-vs-lat/lon narration), frame_06, montage_007 tile 2,1 | CONFIRMED |
| CAP-44 | Keyboard hotkeys | Number keys `1..n` switch style presets (CAP-04); `Q/W/E/R/T` cycle the current city's points of interest. Hotkeys must work while the globe has focus, without modifier keys. | vid_rXvU7bPJ8n4 [01:08] ("click through these numbers"), [02:16]–[02:19] ("jump between Q, W, E, R, T") | CONFIRMED |
| CAP-45 | Shot planner / saved shots | SCENES panel with saved camera shots (Shot 1/2/3 rows), LOAD/DEL per row, and CAPTURE SHOT / UPDATE SHOT buttons — save and jump between pre-planned camera poses for content creation. Persist shots (localStorage or scene manifest) [PROPOSAL for storage]. | vid_rXvU7bPJ8n4 [01:24], montage_005 tile 1,2 | CONFIRMED |
| CAP-46 | Cinematic camera system | Camera control cluster (UI-18): `ORBIT: OFF [slider] N°/s`, named target dropdown (observed: Kharg Island, Strait of Hormuz), `FLAT` toggle, `SPIRAL IN` / `SPIRAL OUT`, plus distance/pitch/FOV sliders (observed values 250 km / 45° / 60° FOV). Auto-orbit rotates about the target at the set °/s; spiral animates radius while orbiting. | vid_ccZzOGnT4Cg frame_14, frame_01; vid_7HEUCLc7aL8 frame_11, frame_20; vid_0p8o7AeHDzg frame_03 | CONFIRMED |

## 9. Search (3)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-47 | Saved locations / bookmarks | `LOCATIONS [+]` panel with `Location:` / `Landmark:` fields for bookmarking places; bottom-center location pill shows current city/region (UI-30). | vid_0p8o7AeHDzg frame_04; HERO-CRT, HERO-CEN | CONFIRMED |
| CAP-53 | Search box | Text input with placeholder + submit arrow at the top of the right control rail. Behavior never demonstrated — implement as geocode + entity-ID lookup (fly-to on match) and mark as inferred default [PROPOSAL]. | vid_7HEUCLc7aL8 frame_11; vid_CHLFl26p7Po [08:04]; vid_0p8o7AeHDzg frame_03 | CONFIRMED (existence only; behavior [SPECULATIVE]) |
| CAP-56 | Analyst presets & filters | ANALYST CONTROLS: temporal presets (FULL PERIOD / BEFORE CHOKEPOINT / AFTER CHOKEPOINT / AFTER CEASEFIRE) that set the analysis window, plus belligerent/attacker flag filters (Iran / Israel / United States / US+Israel) that re-slice every dependent stat, chart, and card set. | vid_ccZzOGnT4Cg frame_12 (presets), frame_14 (flag filters); vid_7HEUCLc7aL8 frame_06 | CONFIRMED |

## 10. Style (3)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-04 | Sensor-style visual presets | Full-screen switchable render styles: Normal, CRT (scanlines + circular scope vignette, UI-10), NVG (night vision), FLIR (thermal), Anime (cel-shading), Noir (+2 more chips visible in the dock, names unread). Cycled via number keys (CAP-44) and a bottom preset dock (UI-06) with "ACTIVE STYLE" readout top-right (UI-03). Entity labels restyle per preset (UI-11). See §Acceptance AC-06. | ART-SPY ("CRT scan lines, night vision (NVG), FLIR thermal, anime cel-shading"); vid_rXvU7bPJ8n4 [01:09], frame_03, frame_07, montage_004; vid_CHLFl26p7Po [08:04]–[08:12], [10:16]; HERO-CRT (STYLE PRESETS dock, ACTIVE STYLE: CRT) | CONFIRMED |
| CAP-05 | Per-effect post-processing controls | Real-time in-browser shader parameter controls layered LUT-style: global BLOOM toggle + SHARPEN slider with % readout (observed in right rail, UI-08); per-preset parameter cards (CRT card: Pixelation / Distortion / Instability sliders, UI-09). Named-but-unseen params (sensitivity) ship as preset-card sliders where the preset needs them [PROPOSAL]. | vid_rXvU7bPJ8n4 [01:13], [04:09]–[04:19], frame_03, frame_19; vid_0p8o7AeHDzg frame_03, frame_21 | CONFIRMED |
| CAP-06 | HUD declutter / layout themes | `HUD` toggle button, `CLEAR UI` (a.k.a. CLEAN UI) declutter button hiding all chrome for capture, and a `LAYOUT` dropdown (observed value: "Tactical") selecting an interface theme. Only one layout value ever observed — ship Tactical as the sole layout, keep the dropdown [PROPOSAL]. | vid_rXvU7bPJ8n4 frame_03, frame_07, frame_19; vid_0p8o7AeHDzg frame_03, frame_21; vid_7HEUCLc7aL8 frame_11 | CONFIRMED |

## 11. Alerts (4)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-14 | Dark-vessel (AIS-gap) detection & reacquisition | Detect AIS-off transits: track goes dark inside a watch corridor → render dashed track segment, add row to DARK TRANSIT WATCH list (classification chips e.g. `INNER THEN DARK EXIT` / `PRIMARY` / `HIGH`, description, UTC time range — UI-15); when the vessel re-emits AIS, drop an amber "SEEN AGAIN" marker at the reacquisition point and link it to the gap. See §Acceptance AC-02. | ART-CHOKE ("the signal disappears. Dashed line. Dark transit... then when it's safely through, the signal pops back on"); vid_ccZzOGnT4Cg [05:50]–[05:59], frame_10, frame_11; vid_7HEUCLc7aL8 [01:26], frame_06; vid_CHLFl26p7Po [08:22]–[08:34] | CONFIRMED |
| CAP-33 | Geo-anchored Ground Truth Cards | OSINT event cards anchored to map points by leader lines. Card anatomy (UI-16): dark rounded card, header = category pill (left) + UTC timestamp (right), all-caps title, optional embedded photo/satellite thumbnail or vertical video (carousel counter, VIDEO HERO button), leader line to the anchor. Cards appear/disappear with playback time. Record schema [PROPOSAL from visible fields]: `{id, ts_utc, lat, lon, category, title, attacker?, target?, precision, provenance, damage?, media[]}`; MVP curation is manual (auto-ingest unevidenced). | vid_ccZzOGnT4Cg frame_14, frame_16, frame_17; vid_7HEUCLc7aL8 frame_16, frame_21; vid_CHLFl26p7Po [10:19], [14:38]; vid_0p8o7AeHDzg frame_08, frame_11; HERO-CRT | CONFIRMED |
| CAP-34 | Event categorization taxonomy | 7-category event system — Kinetic, Retaliation, Civilian Impact, Maritime, Infrastructure, Escalation, Airspace Closure — with one color each, driving timeline-dot colors and card badges (legend: UI-21). Strike-card variant adds: ATTACKER→TARGET flag chips, precision chip (`EXACT` / `APPROX DAY` / `APPROX SEQ`), category (`ENERGY`/`MILITARY`/`DESALINATION`), provenance chip (`VERIFIED` / `GEO-OSINT`), damage-assessment line (observed: "Operations Halted", "Minor Material Damage"). | vid_ccZzOGnT4Cg frame_14, frame_16, frame_17; vid_0p8o7AeHDzg frame_03, frame_05 (legend); vid_7HEUCLc7aL8 frame_16, frame_18; vid_CHLFl26p7Po [10:16], [10:19] | CONFIRMED |
| CAP-35 | Vessel attack/damage cards | Cards tracking kinetic attacks on vessels: severity (`MODERATE`/`CRITICAL`/`SUNK`), weapon type (`USV`/`PROJECTILE`/`MISSILE`), and LAST AIS timestamp (observed: Sonangol Namibe MODERATE/USV; Safeen Prestige MODERATE/PROJECTILE; Mussafah 2 CRITICAL/MISSILE "SUNK"). | vid_ccZzOGnT4Cg frame_15, [09:21] | CONFIRMED |

## 12. Other (4)

| ID | Capability | Build requirement | Evidence | Verdict |
|---|---|---|---|---|
| CAP-36 | Timeline-synced oil risk matrix | "OIL RISK MATRIX — [date]" panel: three tiles (GLOBAL BRENT / U.S. WTI / BRENT–WTI SPREAD), each with price to cents, day-over-day delta, and a sparkline over the playback window; values step per playback date as the timeline scrubs (observed $81.40 → $112.19 Brent). Spread = Brent − WTI (derived, not a third feed). Data: daily closes — FRED `DCOILBRENTEU`/`DCOILWTICO` keyless CSV is a verified free source (DS-17); forward-fill holiday gaps. | vid_ccZzOGnT4Cg [02:26]–[02:30], frame_04, frame_06; vid_7HEUCLc7aL8 [03:16], frame_06, frame_07 ($118.35/$101.38/$16.97), frame_08 | CONFIRMED |
| CAP-37 | Baseline-vs-now KPI computation | Pre/post stat tiles computed from the loaded period around a pivot event: `PRE AVG/DAY`, `POST AVG/DAY`, `DELTA VS PRE` (observed: 126.3 / 9.8 / −92.2% on gate-crossing counts). Aggregates are materialized from the app's own recorded archive, not an upstream API. | vid_ccZzOGnT4Cg [02:13] ("pre-avg ~130 vs post-avg ~10, down 92.2%"), frame_04; vid_7HEUCLc7aL8 frame_06 | CONFIRMED |
| CAP-54 | Two coordinated views (2D dashboard + 3D globe) | Two surfaces over the same recorded dataset: a dark 2D maritime analyst dashboard (brand "MAPTHEWORLD.AI", UI-22: metric tabs, events time-series with OVERVIEW\|PLAYBACK LENS toggle, ANALYST CONTROLS, TRIPS/HEADS/DENSITY/... layer chips) and the photorealistic 3D globe, with a zoom transition between them. Whether original = one codebase/two themes or two apps is unknown — rebuild as one app with two view modes [PROPOSAL]. | vid_7HEUCLc7aL8 frame_06 (2D), frame_11 (3D), [05:41]; vid_ccZzOGnT4Cg frame_04, frame_14, [09:18] | CONFIRMED |
| CAP-57 | Runs entirely in the browser | The whole command center runs in one browser tab — globe streaming, all layers, and real-time full-screen shader post-processing. No native install, no server-side rendering of the view. Caveat: author's article fetch surfaced "WebGPU" while CesiumJS is WebGL-based — target WebGL2 post-processing and treat WebGPU as aspirational (STK-05). | ART-SPY ("All of it running in a browser. No classified clearances. Just open a tab"); vid_rXvU7bPJ8n4 [01:19], [04:02], [09:18]; vid_0p8o7AeHDzg [00:06] | CONFIRMED |

---

# Acceptance criteria — 10 most complex capabilities

Testable pass/fail criteria for the builder. "Observed" values are cited facts about the original and are the parity bar; bracketed defaults are [PROPOSAL] tunables where the original's parameter was not observable.

## AC-01 · Timeline playback (CAP-38, CAP-39, CAP-40, CAP-41)

Observed ground truth: playback window FEB 25 → APR 03 2026 (~38 days) `vid_ccZzOGnT4Cg [01:14]`, `vid_7HEUCLc7aL8 frame_15`; playhead clock at 500 ms resolution ("2026-04-03 11:59:59.500Z") `vid_7HEUCLc7aL8 frame_15`; status line "4,455 ACTIVE VESSELS · 8 CACHED DAY CHUNKS" `vid_ccZzOGnT4Cg frame_05`; 6 h/s narrated speed `vid_ccZzOGnT4Cg [01:46]`.

1. Dragging the playhead to any time `t` inside the loaded window re-renders **every** time-aware layer (vessel positions, flights, jamming hexes, closures, Ground Truth Cards, oil matrix, KPI tiles, lens HUD) to state-at-`t` within 250 ms of drag end. No layer may show state from a different `t`.
2. Speed chips (at minimum: 30M/S, 1H/S, 6H/S, 1D/S — the observed dashboard set) switch instantly mid-play with no re-fetch and no visual jump other than rate change.
3. Storage is day-partitioned UTC chunk files of downsampled per-entity position keyframes ([1–5 min] resolution); the client interpolates between keyframes, so at 6 h/s (a day chunk consumed in 4 s of wall time) motion stays smooth (no teleporting arrows). Raw message logs must not be shipped to the client.
4. Chunks are fetched lazily as the playhead crosses UTC-day boundaries and held in a bounded client cache; the status line shows the live count ("N CACHED DAY CHUNKS") and the active-entity count. Cache count must stay bounded (observed steady-state: 8) over a full-window scrub.
5. UTC clock display has sub-second precision and is monotonic during playback.
6. LIVE/PLAYBACK segmented toggle: PLAYBACK reads only the archive; LIVE (inferred, [PROPOSAL]) proxies the latest source snapshots and disables the scrubber. The inactive mode renders dimmed.
7. Scrubber shows color-coded event dots per the CAP-34 taxonomy; clicking a dot seeks to that event's timestamp.
8. Playback-lens HUD (CAP-41): anchored by a vertical line to the timeline position, shows date + crossing tiles (N / N IN / N OUT) + "DARK TRANSIT: LAYER OFF" footer when that layer is off; values update per day crossed.

## AC-02 · Dark-vessel detection (CAP-14)

Observed ground truth: dashed line during gap, "DARK TRANSIT WATCH" list with `INNER THEN DARK EXIT / PRIMARY / HIGH` chips + UTC ranges `vid_ccZzOGnT4Cg frame_11`, amber "SEEN AGAIN" marker `vid_ccZzOGnT4Cg frame_10`, ART-CHOKE narrative (signal off inside strait, back on when through).

1. Detection rule [PROPOSAL, algorithm unstated in evidence]: an AIS track with no message for > [30 min] while its last position is inside a configured watch corridor polygon opens a dark-transit candidate; the threshold is a per-corridor tunable.
2. During the gap the vessel's track renders as a dashed segment from last-seen to (eventually) reacquisition point; the vessel arrow freezes at last-seen with a "dark" style.
3. On AIS reacquisition, an amber "SEEN AGAIN" marker is placed at the first new fix, visually linked to the gap, and the watch-list row gets its closing UTC.
4. Watch list row = classification chip(s) + one-line description + UTC time range; rows sort newest-first; clicking a row flies to the gap and selects the vessel.
5. Classification [PROPOSAL, from observed chip text]: `INNER THEN DARK EXIT` = last gate crossed before silence was the inner gate and reacquisition is outside; derive from the gate-event sequence (AC-03) around the gap. `PRIMARY`/`HIGH` = watch priority/confidence tunables.
6. **Honesty requirement:** archiver gap-markers (recording outages, see AC-10) must NOT create dark-transit rows — a data hole is rendered as a data hole (distinct style + tooltip), never as a vessel behavior claim.

## AC-03 · Gate crossing analytics (CAP-15, feeds CAP-37, CAP-41)

Observed ground truth: inner/outer gate lines across the strait, per-day HUD split 11 IN / 6 OUT `vid_ccZzOGnT4Cg frame_03`, "CROSSED INNER GATE" watch text `vid_ccZzOGnT4Cg frame_11`, PRE/POST tiles 126.3 / 9.8 / −92.2% `vid_ccZzOGnT4Cg frame_04`.

1. A gate is a named polyline (2+ vertices) with a defined positive direction, stored in the scene manifest (CAP-42).
2. Crossing test: segment–segment intersection between consecutive track keyframe positions and the gate polyline; each intersection emits one event `{vessel, gate, ts (interpolated), direction}`. Direction = sign of the cross product of gate segment × track segment (IN/OUT per the gate's declared orientation).
3. A vessel oscillating on the line must not spam events: debounce repeated same-gate crossings within [10 min] to one event [PROPOSAL].
4. Per-UTC-day aggregates (total, IN, OUT per gate) are materialized once at archive-build time and served as sidecar files; the lens HUD and dashboard charts read aggregates, never recompute from raw tracks in the client.
5. PRE/POST KPI tiles: given a pivot timestamp (from the scene manifest), `PRE AVG/DAY` and `POST AVG/DAY` are means of daily totals before/after the pivot within the loaded window; `DELTA VS PRE` = (post−pre)/pre as a signed %. Reproduce 126.3 / 9.8 / −92.2% on the reference dataset.
6. Timeline events "CROSSED INNER GATE"/"CROSSED OUTER GATE" append to the vessel's history and are queryable by the dark-transit classifier (AC-02.5).

## AC-04 · CCTV projection & calibration (CAP-20)

Observed ground truth: Austin public traffic cams, fly-to picked camera, feed projected on 3D geometry `vid_rXvU7bPJ8n4 [06:39]–[07:15]`, ART-SPY ("draped onto real buildings, in real time"); calibration controls PROJECTION/COVERAGE/AUTO CAL/ALIGN-DRAPE/SAVE CAL + sliders `vid_rXvU7bPJ8n4 frame_16`; author states auto-calibration is WIP at `vid_rXvU7bPJ8n4 [07:30]`; panel subtitle "CCTV Mesh + Street View fallback" (gapfill-2).

1. Camera roster: public/open camera feeds only (MVP: Austin public traffic cams, DS-06), each with `{id, lat, lon, feed_url, refresh_s}`; snapshot-style cams re-fetch at their native refresh; never scrape private or auth-gated streams.
2. Toggling CCTV MESH renders a camera icon per site; clicking one flies the camera to a framing pose and activates projection.
3. Projection = projective texturing from a frustum parameterized as `{position (lat/lon/alt), yaw, pitch, roll, hfov}` onto the 3D tiles, depth-tested so the image drapes on the first surface hit and does not bleed through buildings.
4. Manual calibration: sliders for all six pose/FOV parameters with live update; `SAVE CAL` persists per-camera calibration; reload restores it.
5. `AUTO CAL` [PROPOSAL — WIP in the original]: 2D↔3D point-correspondence solve (user clicks ≥4 pairs image-point ↔ globe-point, PnP solve for pose). Ship the manual path first; AUTO CAL may land as a stub button that opens the correspondence picker.
6. `ALIGN-DRAPE` toggles between frustum projection and ground-plane drape; `COVERAGE` renders the frustum footprint polygon.
7. Fallback: when a feed is down, show the static imagery fallback (Street View-style still or last-good frame) with a STALE badge — never a black projection.

## AC-05 · Satellite AOI access lines (CAP-12)

Observed ground truth: fan lines connect satellites to ground points when passing over an area of interest `vid_0p8o7AeHDzg [01:51], frame_02, frame_08`.

1. AOI = curated target list per scene (`{name, lat, lon}` array in the scene manifest) [PROPOSAL — AOI definition unstated in evidence].
2. For each satellite in the imaging watchlist (CAP-29), propagate position from CelesTrak TLEs (SGP4) at the current playback/live time; when elevation angle from a target to the satellite exceeds a mask angle ([30°] default, tunable per target), draw a line satellite→target.
3. Multiple simultaneous accesses render as a fan (one line per visible target); lines appear/disappear smoothly as passes begin/end, and follow the satellite each frame.
4. Selecting a satellite while lines are active shows pass metadata (target name, elevation, time-to-LOS) [PROPOSAL].
5. Playback correctness: at scrub time `t`, lines must reflect geometry at `t` (propagate TLE to `t`), not wall-clock now.

## AC-06 · Style shaders (CAP-04, CAP-05, CAP-06)

Observed ground truth: preset dock with Normal/CRT/NVG/FLIR/Anime/Noir (+2) `vid_rXvU7bPJ8n4 frame_03, montage_004`, HERO-CRT ("ACTIVE STYLE: CRT"); number-key cycling `vid_rXvU7bPJ8n4 [01:08]`; BLOOM toggle + SHARPEN % slider `vid_rXvU7bPJ8n4 frame_03`; CRT param card Pixelation/Distortion/Instability `vid_rXvU7bPJ8n4 frame_19`; circular scope vignette `vid_rXvU7bPJ8n4 frame_05`; per-preset label restyle `UI-11`.

1. Rendering: full-screen post-process pass(es) over the composited globe render, WebGL2 (WebGPU aspirational — see CAP-57 caveat). Presets are shader parameter sets, not separate scenes.
2. Required presets and minimum effect content: **Normal** (passthrough + optional bloom/sharpen), **CRT** (scanlines, pixelation, barrel distortion, phosphor tint, instability jitter, circular scope mask), **NVG** (green monochrome, gain/sensitivity, noise), **FLIR** (thermal-style palette, white-hot default), **Anime** (cel-shading/posterize + edge lines), **Noir** (high-contrast desaturated).
3. Switching presets via dock click or number key takes effect next frame; no reload, no >100 ms hitch; "ACTIVE STYLE" readout (UI-03) and the AI scene caption (CAP-49) update.
4. Global controls independent of preset: BLOOM on/off, SHARPEN 0–100% with numeric readout. Per-preset param cards expose that preset's sliders (CRT: Pixelation/Distortion/Instability) with live response.
5. Entity labels/colors restyle with the preset (e.g. satellite tags teal in Normal/CRT, green in NVG) per UI-11.
6. HUD/`CLEAR UI` state is orthogonal to style: declutter hides chrome but keeps the active shader.
7. Perf gate: style pipeline adds ≤ [3 ms] GPU frame time at 1080p on a mid-range laptop GPU (original's stats strip shows sub-5 ms frame times, UI-02b).

## AC-07 · Voice command (CAP-48) — [SPECULATIVE subsystem]

Observed ground truth: a single still — bottom-right widget "STOP | LISTENING — Ask or command" (HERO-CRT / UI-29). Everything else here is [PROPOSAL].

1. Widget states: idle (mic icon), LISTENING (label + STOP button), processing, response. Clicking STOP always halts capture immediately.
2. STT: browser-native Web Speech API first; a local/remote STT provider behind the same interface if browser support is insufficient. No always-on capture: listening starts only on explicit user activation (click or hotkey).
3. Command grammar maps utterances to existing app intents only — fly-to (`"go to Dubai"`), layer toggles (`"show military flights"`), style (`"night vision"`), time (`"play at one hour per second"`, `"pause"`), tracking (`"track that plane"`). Unrecognized input falls through to the "ask" path: an AI answer rendered as text (no side effects).
4. Every voice-triggered action must be reproducible via the pointer/keyboard UI — voice is an alternate input, never the only path.
5. Acceptance: scripted utterance list (≥1 per intent class) executes the correct intent end-to-end with mic input mocked.

## AC-08 · Click-to-track (CAP-10, extends to CAP-11/CAP-13)

Observed ground truth: click plane → camera follows in real time `vid_rXvU7bPJ8n4 [03:37]`; tracking toggled off `vid_rXvU7bPJ8n4 [03:23]`; selection ring with heading arrow `UI-25`; satellite click draws orbit + ground track `vid_CHLFl26p7Po [08:16]–[08:20]`.

1. Clicking any entity (aircraft, vessel, satellite) selects it: selection ring + heading arrow renders around it, and its info card/tooltip opens (UI-12/13/14).
2. Entering track mode locks the camera to the entity: camera keeps its current offset (range/pitch/heading) and follows the entity's interpolated position every frame — smooth between data updates (no stepping at poll cadence).
3. User orbit/zoom input while tracking adjusts the offset without breaking the lock; an explicit toggle (and Esc) releases tracking and returns free camera without a jump cut.
4. Tracking works identically in LIVE and PLAYBACK (in playback, follows the interpolated historical track; scrubbing while locked keeps the lock).
5. Satellites additionally draw the orbit polyline + red ground-track on selection; deselect removes them.
6. If the tracked entity's data ends (goes dark / lands / chunk boundary with no data), the camera halts at last position and the UI states why ("SIGNAL LOST" style badge) [PROPOSAL for the badge].

## AC-09 · Street-traffic particle system (CAP-16)

Observed ground truth: OSM road-network query, particle traffic, VEH-XXXX labels, sparse/full modes `vid_rXvU7bPJ8n4 [05:36]–[05:51], frame_14`, ART-SPY; author narrates a browser crash fixed by loading roads by class order `vid_rXvU7bPJ8n4 [09:39]–[09:50]`.

1. Road source: Overpass API query for the current city AOI, fetched by highway class in strict order motorway → trunk/primary → secondary/tertiary → residential; rendering begins after the first class arrives (progressive load) [class order observed as the crash fix; endpoint choice PROPOSAL].
2. Particles spawn on road polylines and advance along them; per-class tunables: density (particles/km), speed range, color. Defaults [PROPOSAL]: motorway 25 m/s, arterial 15 m/s, residential 8 m/s.
3. Hard global particle cap ([20,000]) with per-class budget; hitting the cap degrades density, never crashes or freezes the tab (the original's crash is the regression this guards).
4. Label modes: OFF / SPARSE (labels for [1 in 50] particles) / FULL; labels are stable `VEH-XXXX` IDs in amber monospace (UI-11) that persist for the particle's life.
5. Particles render correctly in both 3D-tile cities and oblique-fallback areas (CAP-02: Dubai case — roads render even without 3D buildings).
6. Layer honesty: this is **simulated** ambient traffic derived from road geometry, not real vehicle tracking — the layer's subtitle/tooltip must say so.

## AC-10 · Playback recording — record-first archiver (CAP-52, STK-10, STK-12)

Observed/verified ground truth: "I've recorded all the vessel tracking data from February 25th to present day" `vid_ccZzOGnT4Cg [01:14]`; agent swarm capturing signals "before the caches cleared" `vid_0p8o7AeHDzg [00:29]`; "8 CACHED DAY CHUNKS" `vid_7HEUCLc7aL8 frame_15`. Verified source limits (gapfill-1): OpenSky free API serves max 1 h of history (t < now−3600 → HTTP 400), 4,000 credits/day, global `/states/all` = 4 credits; aisstream.io is a realtime-only websocket with zero backfill.

1. **Record-first is mandatory:** multi-week playback cannot be reconstructed after the fact from free sources. The archiver must be an always-on service, started before any window you intend to replay.
2. One scraper worker per source, independently supervised: (a) aisstream websocket, bbox-subscribed to configured AOIs; (b) OpenSky poller at credit-sustainable cadence — ~86 s global or ~21 s for a ≤25 sq° AOI on the standard tier (feeder account doubles budget to 8,000/day); (c) military-ADS-B poller (adsb.lol); (d) CelesTrak TLE snapshot daily; (e) event/OSINT capture lane (manual-curation MVP per CAP-33). A worker crash must not stop the others.
3. AIS resilience: auto-reconnect with subscription re-send (aisstream closes sockets lacking a subscription within 3 s), dedupe on (MMSI, timestamp) across reconnect overlap, and **gap-marker records** written for every outage interval so playback renders honest data holes (consumed by AC-02.6).
4. Output schema: day-partitioned UTC chunk files of per-entity downsampled keyframes ([1–5 min]) + per-day aggregate sidecars (gate-crossing events and counts, active-entity counts) — exactly what AC-01.3/AC-03.4 consume. Writes are append-only; a partial day is served as a partial chunk.
5. Recording-liveness surface: the viewer's REC indicator (UI-03) reflects actual archiver liveness in LIVE mode, not a fake blinker [PROPOSAL].
6. Backfill lanes (optional, clearly labeled in provenance): Global Fishing Watch APIs (free; derived AIS products — analytics layers only, not smooth tracks); commercial raw-AIS archives (Spire/Kpler-class) as the paid recovery path. Provenance per chunk: `recorded` vs `backfilled` vs `curated`.
7. Acceptance: kill any single worker for 10 min during a recording session → other feeds unaffected, gap markers present for the killed feed, playback over that window shows the hole honestly, and no dark-transit false positives result.

---

## Cross-reference index

- Data provider details per layer: `03-data-sources.md` (DS-01..DS-24). Confirmed on-screen providers: OpenSky Network (flights), adsb.lol (military), CelesTrak (satellites), USGS (earthquakes), OpenStreetMap (street traffic), NOAA NEXRAD (weather radar), GBFS (bikeshare), "CCTV Mesh + Street View fallback" (CCTV) — 4K panel reads, gapfill-2.
- UI anatomy per widget: `sec_ui.json` → UI-01..UI-32 (+UI-02b), referenced inline above.
- Stack conclusions: STK-01 (CesiumJS/Cesium ion), STK-02 (Google Photorealistic 3D Tiles), STK-05 (WebGL-class shader post-processing; WebGPU wording unconfirmed), STK-06 (original's framework stack undisclosed — do not copy the community clone's Next.js stack as if it were Sidhu's), STK-10 (agent-swarm archiver), STK-12 (day-chunk playback storage), STK-13 (Chroma DB claim = low-confidence secondhand, excluded from this spec).
- Known limitations & ranked improvement backlog: `sec_improvements.json` / the improvements doc.
