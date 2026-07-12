# 07 — Session Notes: Evidence Log

Date: **2026-07-11**. This document records how the godseye spec was reverse-engineered, what each source contributed, what was verified, what is still open, and exactly how a later session can close the remaining gaps. Raw evidence lives in the session scratchpad at `C:/Users/MSI/AppData/Local/Temp/claude/C--Users-MSI/71ca4046-b55b-4f0b-a35f-eaa6b7055ee2/scratchpad/godseye/` (referred to below as `scratchpad/godseye/`). Scratchpads are session-scoped — copy anything you need into the repo before ending the session.

All feeds referenced are public/open data. Nothing in this program scrapes private data or bypasses auth; keep it that way.

---

## 1. Methodology

Pipeline (21 subagents total):

1. **Source capture** — Bilawal Sidhu's 5 YouTube videos downloaded; each decomposed into `scratchpad/godseye/vid_<id>/transcript.txt` + `frame_NN.png` keyframes + `montage_NNN.png` contact sheets. Repo hero assets pulled from `bilawalsidhu/gods-eye-view` into `scratchpad/godseye/repo-assets/`. Web sweep for Sidhu's Substack/X posts and community-clone coverage.
2. **8 parallel analysis lanes** — each lane mined the evidence for one axis (capabilities, data sources, UI, stack, improvements/limitations, gaps, plus supporting lanes) and emitted claims with citations.
3. **Merge** — lane outputs deduplicated into canonical ID'd sections: `sec_capabilities.json` (CAP-01..57), `sec_data_sources.json` (DS-01..22), `sec_ui.json` (UI-01..32 + UI-02b), `sec_stack.json` (STK-01..13), `sec_improvements.json`, `sec_gaps.json`.
4. **Per-source adversarial verification** — every merged claim re-checked against its cited frames/transcripts/URLs by verifier agents whose job was to break the claim. Result: **122 of 125 claims CONFIRMED, 1 WRONG, 2 unverdicted** (see §3).
5. **Critic pass** — one critic agent attacked the merged spec for buildability holes and produced 17 gaps, each with a concrete `how_to_fill` recipe (`sec_gaps.json → critic_gaps`).
6. **4 gap-fill lanes** — the four highest-value critic gaps were researched and closed same-session (backend/ingest architecture, per-layer provider attributions via 4K re-extract, oil price feed, vessel registry join). Findings in `sec_gaps.json → gap_findings` and summarized in §6. The remaining 13 gaps are logged in §5 with their fill recipes.

Citation convention used throughout the docs: `vid_<id> [MM:SS]` = transcript timestamp; `vid_<id> frame_NN` / `montage_NNN` = captured image; `repo-asset:<file>` = repo hero image; bare URL = web source. Anything not CONFIRMED is tagged `[SPECULATIVE]`.

---

## 2. Per-video notes

Transcripts: `scratchpad/godseye/vid_<id>/transcript.txt`. Titles below are working titles derived from content (YouTube titles were not archived verbatim).

### vid_rXvU7bPJ8n4 — WorldView build/demo ("vibe coded Palantir"), ~10:14

- Primary source for the WORLDVIEW 3D-globe UI: the 8-row DATA LAYERS panel with provider subtitles (frame_07 [02:32], frame_08 [02:56]), sensor presets + per-effect shader controls (`vid_rXvU7bPJ8n4 [01:09]`, `[04:09]–[04:19]`), header telemetry, location panel.
- Names two feeds in narration: OpenSky live flights, "6.7K flights" (`vid_rXvU7bPJ8n4 [03:15]`); crowdsourced military ADS-B via "this website called ADSB" (`vid_rXvU7bPJ8n4 [04:30]`) — later resolved to adsb.lol by 4K re-extract (gapfill-2).
- CCTV projection/calibration workflow (AUTO CAL / ALIGN-DRAPE controls, author states point-correspondence solve is WIP at `[07:30]`; sequence `[06:39]–[07:45]`); street-traffic particle system and the road-class-ordered loading fix (`[05:36]–[06:00]`, `[09:39]–[09:50]`); Dubai oblique-imagery fallback (`[06:10]–[06:28]`).
- Shows the agent-swarm build process — "four of these terminals at once… four, six, eight different agents" (`vid_rXvU7bPJ8n4 [08:49]–[08:54]`).

### vid_0p8o7AeHDzg — Iran strikes 4D reconstruction ("Operation Epic Fury"), ~11:05

- Origin of the record-first archiver (STK-10): "I set loose an AI agent swarm to basically capture every open-source signal that I could find before the caches cleared" (`vid_0p8o7AeHDzg [00:29]`).
- 4D timeline reconstruction layers: satellites overhead (`[00:39]`, `[01:09]`, `[01:41]`), military flights and a GPS-jamming spike (`[01:14]–[01:29]`).
- Satellite AOI access-line behavior (`[01:41]–[02:10]`) — logic still unspecified (RG-09 in §5).
- Ground Truth Cards / geolocated event evidence and the swarm's role in collecting it (`[07:50]–[08:30]`).

### vid_ccZzOGnT4Cg — Strait of Hormuz maritime episode, ~16:13

- The AIS playback system: "I've recorded all the vessel tracking data from February 25th to present day" (`vid_ccZzOGnT4Cg [01:14]`); "playing back the scene at 6 hours per second" (`[01:46]`); timeline FEB 25 → MAR 28 2026 with speed presets and "8 CACHED DAY CHUNKS" (frame_04, crop_f05_timeline).
- Vessel dossier (UI-14) both ways: fully identified YEKTA II with AIS voyage fields (crop_f11_right, `[03:27]`) vs dark vessel "HG flag unknown unknown vessel" with per-field `Unknown` fallback (frame_09, `[05:42]–[05:55]`).
- Tehran's Tollbooth gate lines, crossing counts, and dark-transit narration (`[02:16]` pre/post-day averages from "my data"; method window `[05:30]–[07:00]`).
- Infographic slides (FROM STRAIT TO STORE, OIL FLOW — CONVERGE & CHOKE, HORMUZ OIL DEPENDENCY; montage_040) and the MAPTHEWORLD.AI 2D dashboard with the LIVE | PLAYBACK toggle (frame_04, frame_14).

### vid_7HEUCLc7aL8 — Ceasefire follow-up (first "God's eye view" usage), ~13:05

- Names the product on camera: "I used God's eye view to take a look at the Strait of Hormuz…" (`vid_7HEUCLc7aL8 [00:00]`).
- Extends the archive to 2026-04-03 with the "2,316 ACTIVE VESSELS • 8 CACHED DAY CHUNKS" status line and 500 ms playhead resolution (frame_15) — the key evidence for the day-partitioned chunk store.
- Oil Risk Matrix panel: timeline-synced daily Brent/WTI + derived spread (frame_07 MAR 31 2026 $118.35/$101.38/$16.97, frame_08 FEB 28 2026; narration `[03:16]–[03:18]`, `[04:21]–[04:23]`).
- Scene picker / curated scene fields (frame_11) and basemap style switching (`[05:41]`).

### vid_CHLFl26p7Po — Palantir / Maven Smart System explainer, ~16:42

- Contextualizes WorldView against Palantir Maven; contains the second independent 4K-capturable pass over the full WORLDVIEW UI at `[08:02]–[08:12]` — used by gapfill-2 to cross-confirm every DATA LAYERS provider subtitle (REC banner timestamp 01:34:25Z matches vid_rXvU7bPJ8n4's 01:34:34Z, i.e. same build/session).
- Source of the DS-05 **negative** finding: the AIS/dark-vessel talk at `[08:26]–[08:33]` and `[13:06]` is narration about real-world intelligence systems, not an app layer — there is no AIS row in the DATA LAYERS panel.
- Argus neighborhood-surveillance concept (`[06:48]`, `[16:04]`; montage_038–041) — no cursor/interaction shown, possibly motion-graphics mockup (RG-13 in §5).
- Data-cost discussion (`[13:04]–[13:08]`: AIS is the expensive feed) and further sensor-preset/photoreal-globe footage (`[08:04]–[10:16]`, `[14:36]–[14:46]`).

---

## 3. Verification summary

| Section | Items | CONFIRMED | WRONG | No verdict |
|---|---|---|---|---|
| Capabilities (CAP-01..57) | 57 | 56 | 0 | 1 (CAP-48) |
| Data sources (DS-01..22) | 22 | 21 | 1 (DS-09) | 0 |
| UI (UI-01..32 + UI-02b) | 33 | 32 | 0 | 1 (UI-29) |
| Stack (STK-01..13) | 13 | 13 | 0 | 0 |
| **Total** | **125** | **122** | **1** | **2** |

**The one WRONG finding and its correction — DS-09 (Weather radar).** The merged claim said "provider never named or demoed". The adversarial verifier re-read the cited frames and found the claim's own evidence contradicts it: the Weather Radar row subtitle in `vid_rXvU7bPJ8n4 frame_07`/`frame_08` reads **"NOAA NEXRAD (globe overlay)"** — the provider IS named in the UI (the layer is still never demoed live). Gapfill-2's 4K re-extract re-confirmed the exact string "NOAA NEXRAD (globe overlay) · never" (`vid_rXvU7bPJ8n4 frame_07 [02:32]` hires crop; `vid_CHLFl26p7Po [08:02]` hires crop). **Correction adopted everywhere: treat NOAA NEXRAD as the evidenced weather provider; DS-09's "recommended providers" list (RainViewer/Open-Meteo/etc.) is superseded — those remain valid only as rebuild alternatives, marked as proposals.**

**The two unverdicted items — CAP-48 (voice command interface) and UI-29 (voice widget).** Sole evidence is a single still image, `repo-asset:god-view-hero-crt.jpg`; no video shows the voice flow. Both are `[SPECULATIVE]` as to behavior (existence of the widget in the hero image is real; everything about how it works is inferred). See RG-06 in §5.

Everything else — all 122 remaining claims — survived a verifier whose brief was to disprove them against the cited frames/transcripts/URLs.

---

## 4. Open questions

All 30 open questions from `sec_gaps.json → open_questions`, numbered OQ-01..30 for cross-reference. Status annotations show where a gap-fill lane subsequently closed or narrowed one; unannotated items remain OPEN.

| # | Open question | Status |
|---|---|---|
| OQ-01 | Rendering engine never named in any video (no Cesium/ion logo, Google attribution, or code shots); web sources resolve it to CesiumJS via the repo hero's Cesium ion logo, but video-level evidence alone is inconclusive (deck.gl/Three.js with a 3D Tiles loader also possible). | OPEN |
| OQ-02 | Per-layer data-provider attributions exist as small subtitle lines under each DATA LAYERS row but were unreadable at original video resolution. | **CLOSED** by gapfill-2 4K re-extract: all 8 rows read (see §6). |
| OQ-03 | Which ADS-B aggregator "ADSB" refers to is never spelled out beyond "a website called ADSB". | **CLOSED** by gapfill-2: on-screen subtitle reads **adsb.lol**. |
| OQ-04 | Oil-futures price source unevidenced (exchange feed vs manually keyed daily series); values render to cents with day-over-day deltas. | **PARTIALLY CLOSED** by gapfill-3: original source still unknown, but panel granularity confirmed daily closes; rebuild feed chosen = FRED DCOILBRENTEU/DCOILWTICO (keyless CSV, verified live). |
| OQ-05 | The Austin CCTV API/endpoint and vessel-registry source are never shown; snapshot metadata implies "Austin Transportation & Public Works" cams but the data path is unknown. | OPEN (vessel-registry *rebuild* path spec'd by gapfill-4; original app's source still unknown). |
| OQ-06 | "open claw" (spoken) is almost certainly the OpenClaw agent-orchestration tool but the spelling/product is never shown; the specific CLI agents (Claude Code / Codex CLI / Gemini CLI) are implied by the model list but never named. | OPEN |
| OQ-07 | Exact Claude version: narration says "Claude 4.6" while an on-screen news card appears to read "Claude 4.x Sonnet" — card text too small to confirm; Maven's Claude is separately reported as Claude 3.5 Sonnet. | OPEN |
| OQ-08 | When/how the WorldView → God's Eye View rename lands in-product is unknown — every captured UI frame still says WORLDVIEW; the 2D dashboard is branded MAPTHEWORLD.AI. | OPEN |
| OQ-09 | Relationship between the MAPTHEWORLD.AI 2D dashboard and the 3D globe: one codebase with two themes or two separate apps over shared data (speed-preset sets and layer chips differ). | OPEN |
| OQ-10 | Whether LIVE mode actually streams real-time data or the whole demo runs from the recorded archive — only PLAYBACK is ever shown active; what a "LIVE-CALLOUT" layer renders is unknown. | OPEN (LIVE\|PLAYBACK toggle existence confirmed by gapfill-1; LIVE never shown active). |
| OQ-11 | Whether Ground Truth Cards / their imagery are hand-curated by Sidhu or auto-ingested from social/OSINT feeds by the agent swarm is not shown. | OPEN |
| OQ-12 | Whether the KH11 / ORB / PASS / MGRS / GSD / NIIRS telemetry is decorative cosplay or driven by real TLE/orbit propagation cannot be determined at video resolution. | OPEN |
| OQ-13 | Whether the satellite layer count (~141–188) is a curated visible subset vs the full catalog is unresolved (one telemetry strip shows SRC:7511 total sources; render stats show SRC:450 elsewhere). | OPEN (gapfill-2 confirmed Satellites row shows count 180, provider CelesTrak). |
| OQ-14 | Semantics of the right control rail: what the "Tactical" LAYOUT dropdown selects, what the sliders control, what the DETECT button and text-input box do, and whether "CLEAR" reads "CLEAR AI" or "CLEAR ALL". | OPEN |
| OQ-15 | Exact function of the green PANOPTIC toggle, its opacity slider, and Flights/Satellites/Maritime checkboxes (plausibly the all-entity connection-line mode) is never explained. | OPEN |
| OQ-16 | Header telemetry fields "PANOPTIC Vxx.x SRC:n DENS:n.n n.nms" — SRC/DENS/frame-time semantics unconfirmed (plausibly source count, point density, frame time). | OPEN |
| OQ-17 | Contents of the CCTV MESH layer/panel in the 3D view — toggle/accordion exists but is never expanded on camera. | OPEN (gapfill-2: subtitle reads "CCTV Mesh + Street View fallback · never" — mechanism named, contents still unshown). |
| OQ-18 | Meaning of the purple area overlays (over Iraq/Turkey/sea) vs the red airspace-closure polygons is never stated. | OPEN |
| OQ-19 | Meaning of the "GATES" layer (assumed Iranian toll/transit gate lines used for crossing-event counting) and of a barely-legible right-panel footer "GULF STRATEGIES · 324 VISIBLE". | OPEN |
| OQ-20 | One lit war-view chip reads approximately "VHF Intercept" (could be UHF/RF Intercept); the chip after it is cut off by the webcam overlay ("Inter…", possibly "Internet Outages") — needs a higher-res source. | OPEN |
| OQ-21 | Whether an aircraft/ADS-B layer is present in the Strait-of-Hormuz maritime episode is unclear — icon clusters near Fujairah read as anchored vessels, not aircraft. | OPEN |
| OQ-22 | Whether the infographic slides (Tehran's Tollbooth, dependency maps, oil price surge, ship-size comparison) are an in-product slide/story mode or video post-production — page-dots suggest an in-app deck but no chrome proves it. | OPEN (→ RG-04). |
| OQ-23 | Whether the green-CRT globe styling seen in the intro recap survives as a selectable preset in the current build or was replaced by the dark/photorealistic pair. | OPEN |
| OQ-24 | Whether the Argus neighborhood sequence (camera tiles, schedule pins, anomaly card) is a working build or a motion-graphics mockup — no cursor or interaction shown. | OPEN (→ RG-13). |
| OQ-25 | Whether the datasets are real-data recreations or partially synthetic scenario data — dates are 2026 and "Operation Epic Fury" does not match a real-world operation; product mechanics are as shown regardless. | OPEN |
| OQ-26 | The specific on-screen "toll money visualization" narrated at `vid_ccZzOGnT4Cg [04:36]` (particles/counter?) is not clearly visible in any captured frame. | OPEN |
| OQ-27 | Basemap imagery source for the blue-marble + bathymetry texture (non-3D tracking mode) has no visible attribution. | OPEN (→ RG-05). |
| OQ-28 | Whether AI-analysis chat / voice commands from the original WorldView demo persist in later builds is not shown in the war-replay videos (voice control is only evidenced in the repo hero image). | OPEN (→ RG-06). |
| OQ-29 | Languages/frameworks of Sidhu's own build remain undisclosed until the July 2026 code drop; the Next.js/React/Tailwind/Zustand stack circulating online belongs to a community clone, not the original. | OPEN |
| OQ-30 | Low-confidence UBOS.tech claim of a Chroma DB vector-search layer is uncorroborated by any primary Sidhu source and should not be treated as part of the stack until the code drops. | OPEN — `[SPECULATIVE]`, excluded from stack. |

---

## 5. Remaining gaps (13 critic gaps not gap-filled)

Critic produced 17 gaps; gap-fill lanes closed the first four (backend/ingest, layer attributions, oil feed, vessel registry — see §6). The 13 below remain. Each carries the critic's `how_to_fill` recipe verbatim in substance so a later session can execute it without re-deriving context. IDs RG-01..13 are local to this doc.

| ID | Refs | Gap | How to fill |
|---|---|---|---|
| RG-01 | DS-12 | Global airspace-closure source unresolved: the recommended FAA NOTAM API cannot produce the Iran/Qatar/UAE "AIRSPACE CLOSED" polygons actually demonstrated. | Evaluate ICAO API Data Service NOTAM endpoint and OpenAIP; if neither is viable free, spec the polygon set as hand-curated per scene (Natural Earth country polygons + closure flag in the scene manifest) and say so explicitly. |
| RG-02 | CAP-14, CAP-15 | Dark-transit and gate-crossing detection have feature descriptions but no algorithm: gate line coordinates, crossing test, AIS-silence threshold, and the INNER THEN DARK EXIT classification logic are all unstated. | Re-read `vid_7HEUCLc7aL8` transcript 02:30–04:30 and `vid_ccZzOGnT4Cg` 05:30–07:00 for method narration; then spec: gate = polyline segment-intersection test on track, dark transit = AIS gap > N min inside corridor (tunable), classification by last-gate-before/first-gate-after silence. |
| RG-03 | DS-16, UI-16 | Ground Truth Card event data model and curation pipeline unspecified — card anatomy exists but no record schema, geocoding workflow, media storage plan, or VERIFIED-vs-GEO-OSINT verification process. | Draft a JSON schema from the visible fields (category, UTC, title, attacker/target, precision, provenance, damage, media[]); re-read `vid_0p8o7AeHDzg` 07:50–08:30 transcript for swarm detail; spec manual curation as the MVP path since auto-ingest is unevidenced. |
| RG-04 | (new CAP/UI needed) | Infographic/story slide mode is shown but absent from the spec: `vid_ccZzOGnT4Cg montage_040` shows ≥3 named full-screen slides (FROM STRAIT TO STORE, OIL FLOW — CONVERGE & CHOKE, HORMUZ OIL DEPENDENCY choropleth) with page-dots. | Frame-step `vid_ccZzOGnT4Cg` ~13:00–15:00 (montage_039–042 region) looking for cursor/transition chrome to decide in-app deck vs video post-production; if in-app, add a CAP + UI spec for the slide/story mode and its chart types. |
| RG-05 | (2D dashboard) | MAPTHEWORLD.AI 2D dashboard rendering stack and basemap have no lead: `vid_7HEUCLc7aL8 frame_06` shows a dark labeled basemap (Bandar Abbas) with no attribution captured; TRIPS/HEADS/DENSITY layer chips imply a specific trip-rendering library. | Zoom frame corners across `vid_7HEUCLc7aL8` and `vid_ccZzOGnT4Cg` dashboard frames for an attribution string; failing that, recommend CARTO Dark Matter tiles + MapLibre GL + deck.gl (TripsLayer/HexagonLayer map 1:1 to the TRIPS and DENSITY chips) and mark it a design decision. |
| RG-06 | CAP-48, UI-29 | Voice interface has a single still image as evidence: no interaction flow, STT/TTS provider, or command grammar — a dev team would be guessing an entire subsystem. | Crop `repo-asset:god-view-hero-crt.jpg` bottom-right widget at full res; search Sidhu's Substack/X/Threads for any voice-demo clip; if nothing, explicitly spec it as Web Speech API + command-to-camera/layer intent mapping and label it inferred. |
| RG-07 | CAP-53, UI-08 | Search box and DETECT button / "Tactical" LAYOUT semantics exist in the spec with no behavior — geocoder vs entity search vs AI command undefined. | Frame-step `vid_rXvU7bPJ8n4` 04:55–05:30 (montage_015–017) for a DETECT press or typed query; grep the spy-satellite Substack article for "detect"/"layout"; otherwise spec search = geocode + entity-ID lookup and DETECT = panoptic detection-overlay trigger, marked as inferred defaults. |
| RG-08 | CAP-20 | CCTV projection calibration names controls (AUTO CAL/ALIGN-DRAPE/sliders) but gives no calibration model — frustum parameterization and the point-correspondence solve are unspecified. | Frame-step `vid_rXvU7bPJ8n4` 06:39–07:45 (montage_021–023) to read slider labels/ranges; spec camera pose as position/yaw/pitch/roll/FOV with manual sliders + planned PnP point-correspondence solve (author states it is WIP at [07:30]). |
| RG-09 | CAP-12 | Satellite AOI access-line logic undefined: what constitutes an "area of interest" and the draw condition (elevation mask? range?) is unstated. | Re-read `vid_0p8o7AeHDzg` transcript 01:41–02:10; spec AOI = curated target list per scene, line drawn when satellite elevation above a tunable mask angle — label inferred. |
| RG-10 | CAP-57, STK-05 | WebGL vs WebGPU unresolved for the post-processing pipeline — affects engine/browser support decisions. | Re-fetch https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator and quote the exact API sentence; note CesiumJS is WebGL-based today, so treat any WebGPU mention as aspirational and spec WebGL2 post-processing stages. |
| RG-11 | CAP-42, UI-19 | Curated scene package format has no manifest spec even though all its fields are visible (name, description, date range, layer states, camera). | No new evidence needed — draft the scene JSON manifest (id, title, description, date_range, camera preset, layer toggles, event-set ref, gates, speed presets) directly from UI-19 / `vid_7HEUCLc7aL8 frame_11` and `vid_ccZzOGnT4Cg frame_14`. |
| RG-12 | CAP-16 | Traffic particle system parameters unspecified: spawn rates, speeds, densities, and the road-class-ordered loading that fixed the browser crash are narrated but not spec'd as tunables. | Re-read `vid_rXvU7bPJ8n4` 05:36–06:00 and 09:39–09:50 transcript; spec Overpass query by highway class, sequential load order (motorway→arterial→residential), and per-class particle density/speed tunables with a hard particle cap. |
| RG-13 | CAP-51, STK-11 | Argus is in the spec with no UI detail and unknown build status (possibly a motion-graphics mockup) — leaving it in scope forces a dev team to invent a second product. | Examine `vid_CHLFl26p7Po` montage_038–041 for cursor/real interaction; regardless of outcome, add an explicit scope decision line: **Argus is descoped from the rebuild MVP (concept-only evidence)**. |

---

## 6. Gap-fill findings summary (the 4 filled lanes)

Full details with per-claim citations: `sec_gaps.json → gap_findings`.

### gapfill-1 — Backend / ingest & playback architecture (closed critic gap #1)

- Confirmed the LIVE | PLAYBACK two-path serving model from UI evidence (`vid_ccZzOGnT4Cg frame_14` pill crop; `vid_7HEUCLc7aL8 frame_15`).
- Storage schema derived from the on-screen "N CACHED DAY CHUNKS" counter: day-partitioned (UTC) chunk files of downsampled per-vessel position keyframes, lazily fetched as the playhead crosses day boundaries, client-side interpolation at 30M/S–6H/S with 500 ms playhead resolution (`vid_7HEUCLc7aL8 frame_15`; `vid_ccZzOGnT4Cg [01:46]`).
- **Hard constraint verified against provider docs:** OpenSky free API serves max 1 h history (4,000 credits/day; global `/states/all` = 4 credits → ~86 s cadence, ≤25 sq° bbox → ~21 s) — https://openskynetwork.github.io/opensky-api/rest.html; aisstream.io is a realtime-only websocket with zero backfill — https://aisstream.io/documentation. Therefore **record-first is mandatory** (matches `vid_ccZzOGnT4Cg [01:14]` and the swarm-archiver claim `vid_0p8o7AeHDzg [00:29]` = STK-10). Paid/partial backfill options: Global Fishing Watch APIs (derived AIS layers only) or a commercial raw-AIS archive (Spire→Kpler et al.).
- Delivered a drafted "Architecture: ingest, storage, serving (STK-10)" section (in `gap_findings[0]`, last finding) ready to merge into `02-architecture.md`.

### gapfill-2 — DATA LAYERS provider attributions via 4K re-extract (closed critic gap #2)

Re-downloaded the relevant sections of `vid_rXvU7bPJ8n4` (148–185 s) and `vid_CHLFl26p7Po` (470–500 s) at 3840×2160 and cropped the panel; two independent captures of the same build agree. All 8 rows read:

| Layer row | On-screen provider subtitle |
|---|---|
| Live Flights | OpenSky Network |
| Military Flights | adsb.lol |
| Earthquakes (24h) | USGS |
| Satellites | CelesTrak (count 180, toggle ON) |
| Street Traffic | OpenStreetMap |
| Weather Radar | NOAA NEXRAD (globe overlay) — re-confirms the DS-09 correction |
| CCTV Mesh | "CCTV Mesh + Street View fallback" (mechanism, not a vendor) |
| Bikeshare | GBFS |

Plus one **negative** finding: the panel has exactly 8 rows — **no AIS/ships row exists in the WORLDVIEW app**; AIS mentions in `vid_CHLFl26p7Po [08:26]/[13:06]` are tradecraft narration, not an app layer. Hires crops preserved at `scratchpad/godseye/vid_rXvU7bPJ8n4/hires/` and `scratchpad/godseye/vid_CHLFl26p7Po/hires/`.

### gapfill-3 — Oil price feed for DS-17 (closed critic gap #3)

- Rebuild feed chosen and **verified working live 2026-07-11**: FRED daily series DCOILBRENTEU + DCOILWTICO via keyless CSV `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU,DCOILWTICO` (history to 1986; ~3–5 business-day publication lag, irrelevant for historical playback). Renderer must forward-fill FRED's blank holiday cells. *(Proposal — the original app's source remains unknown, OQ-04.)*
- Panel semantics confirmed from evidence: the Oil Risk Matrix shows timeline-synced daily Brent, WTI, and derived Brent−WTI spread with day-over-day deltas and sparklines (`vid_7HEUCLc7aL8 frame_07/frame_08`, `[03:16]`, `[04:21]`) — daily closes are exactly the right granularity.
- Alternates checked and rejected: stooq CSV endpoints blocked by a JS anti-bot challenge (unverifiable feed can't anchor a DS); EIA Open Data API works but needs a key for data FRED mirrors keylessly.

### gapfill-4 — Vessel registry join for DS-18 (closed critic gap #4)

- Dossier fallback behavior nailed from evidence: every field independently falls back to literal `Unknown` (`?m x ?m` for dimensions), never blank/zero/hidden; zero-registry-match vessels are tagged UNKNOWN VESSEL / FLAG UNKNOWN and feed the dark-vessel lane (`vid_ccZzOGnT4Cg frame_09`, `[05:42]–[05:55]`).
- Data-path split proven by the YEKTA II dossier (`vid_ccZzOGnT4Cg crop_f11_right`): route/draught/dimensions/ETA come from AIS message 5; tonnage/deadweight/built/owner exist in **no** AIS message — they require a registry join, which the demo never had (those fields show `Unknown` on every inspected vessel).
- Proposed enrichment spec *(proposal)*: Stage A MMSI→IMO (AIS msg 5 self-report, else Global Fishing Watch `/v3/vessels/search`); Stage B IMO→particulars via GFW vessel-identity API (free token, registryInfo extraFields incl. tonnage/built/ownership; attribution required) with ~30-day per-IMO cache; Stage C manual deep links to Equasis and IMO GISIS in the dossier footer. **ToS constraint:** Equasis explicitly forbids bulk harvesting/APIs — deep-link only, never scrape; GISIS likewise has no API. Sources: https://globalfishingwatch.org/our-apis/documentation, https://www.equasis.org/, https://gisis.imo.org/public/ships/default.aspx.

---

*End of spec-phase evidence log. Cross-reference: capabilities/data-source/UI/stack tables live in their own docs; this file is the provenance record.*

---

# Build phase (2026-07-11 → 2026-07-12)

The spec above was handed off, then the same operator said **"begin"** — so the build happened in-session (superseding spec-only). What shipped, in order, all on `javin23863/godseye` main.

## What was built (milestone arc)

- **M0** (`ef9f5b9`) — Vite + TypeScript (strict) + CesiumJS scaffold; basemap switcher GOOGLE 3D / AERIAL+LBL / ROAD with keyless graceful fallback (Esri aerial + OSM road); USGS earthquakes layer; headless-Edge verify harness.
- **M1** — flights (OpenSky anonymous, 15-min poll = credit budget), military ADS-B (airplanes.live + adsb.lol/adsb.fi mirrors, orange), satellites (CelesTrak TLEs + satellite.js SGP4, click = orbit track), country boundaries. 8000-entity cap per aircraft layer.
- **M2** — style presets in one branched GLSL PostProcessStage (CRT / NVG / FLIR / ANIME / NOIR, keys 1–6) + bloom/sharpen/pixelate; scenes (6 cities × POI chips, shot planner, orbit cam, Nominatim search, click-to-track).
- **M3** — 4D playback: record-first → IndexedDB recorder; timeline scrub 1×–6h/s; satellites re-propagate at the playhead instant.
- **M4/M5** — Web Speech voice router, DMS/alt/REC HUD telemetry, template + LLM caption, NEXRAD weather (Iowa Mesonet WMS, keyless). Through here everything runs **keyless**.
- **Keyed features** (`fff927c`, keys in gitignored `.env`) — Google 3D tiles as default basemap; **AIS ships** (aisstream WebSocket, moving/stationary split, click dossier); **LLM** caption + voice Q&A (Ollama `minimax-m3:cloud`, key injected server-side by the `/feeds/llm` proxy, never in the bundle).
- **Hormuz analytics suite** (`b94e080`) via a tiered opus/sonnet/haiku subagent workflow — dark-vessel detection (AIS gap over recorded history), chokepoint gate crossing tally, oil futures panel (FRED Brent/WTI), critical-infrastructure layer.
- **Backlog-3** (`95961ed`) via a second tiered workflow (opus CCTV, sonnet GPS-jam + AOI, opus adversarial review per module) —
  - **GPS jamming** (CAP-21): SCAN VIEW hex-bins low nav-integrity (NIC/NACp) ADS-B reports from `airplanes.live/v2/point` into red degraded-GPS cells — the gpsjam.org method, zero new feeds. **Temporal follow-up** (below): each scan now records its cells and the 4D playhead replays them, so jamming intensity evolves along the timeline.
  - **Satellite AOI access lines** (CAP-12): imaging-satellite watchlist (Pleiades/WorldView/SkySat/Capella/ICEYE…) → fan lines to curated Iran/Hormuz AOIs whenever a bird is above a tunable elevation mask; reuses the CelesTrak TLE cache.
  - **CCTV mesh** (CAP-20): public DOT still-cams, click → fly-to framing pose + live-snapshot picture-in-picture (1 frame/min), COVERAGE footprint wedge, ALIGN-DRAPE outline/fill, manual pose sliders.

## Build lessons (the non-obvious ones)

- **Feed CORS** — OpenSky, adsb.lol/adsb.fi, FRED oil, and the LLM serve no third-party CORS (or hold secrets), so the app calls same-origin `/feeds/*` proxied by vite dev **and** preview. A production host must provide the same routes. `airplanes.live` is the one military mirror serving CORS `*` → fetch it browser-direct first (proxied hops forwarded browser headers and tripped upstream bot-detection; the proxy strips origin/referer/cookie/sec-* to compensate). Volunteer mirrors 502 randomly → 3-deep fallback chain.
- **AIS ships showed 0 despite live frames** — the browser `WebSocket` delivers aisstream frames as a **Blob**, not a string (Node's `ws` gives strings, which masked it in probes); `JSON.parse("[object Blob]")` failed silently in a `catch{}`. Fix: decode the Blob first.
- **AIS Persian Gulf = 0 vessels** — no crowd-sourced receiver coverage there; not a code bug. Default bbox moved to NW Europe (dense). The Hormuz/AIS analytics run over *recorded* history, so this is a coverage reality, not a defect.
- **satellite.js pinned v5** — v6 ships node-only WASM that breaks browser bundling ("iife does not support top-level await"). v5 is the browser-safe SGP4.
- **CelesTrak throttles per-IP on a ~2h window** — a repeat `GROUP=active` request returns a text banner ("GP data has not updated since your last successful request"), not TLEs. Mitigation: localStorage TLE cache (key `godseye-tle-active`, 2h TTL); headless verify seeds it via `M0_TLE_FILE`. Consequence: on a throttled run the SATELLITES layer (and the AOI access lines that reuse the same cache) legitimately read 0 — a network state, not a fault.
- **Tiered-subagent integration pattern** — parallel agents can't safely edit shared files (`main.ts` / `index.html` / `style.css` / `vite.config.ts`). So each agent wrote only *new* self-contained module files and returned a **wiring snippet** (imports / init / css / click-prefix) via a structured schema; the main thread integrated serially. An opus adversarial review ran per module before integration — it caught the one real integration gap in backlog-3 (CCTV's `select()` needed a `cctv-` branch in the global click handler that the wiring snippet omitted).

## State at handoff

- **41 pure-logic unit tests** (`node --test "tests/*.test.mjs"`), `tsc --noEmit` + `vite build` clean.
- **6 headless verify scripts** — `verify-m0` (every auto-layer populated + screenshot), `verify-styles`, `verify-playback`, `verify-keyed`, `verify-hormuz`, `verify-backlog`.
- **Feeds are all public/open OSINT data.** Keys (Google tiles / aisstream / Ollama) live in a gitignored `.env`; the app degrades gracefully without each.

## Remaining (not built — needs an operator call)

- **Worker-thread parsing/clustering** (improvement B-10) — deliberately **deferred**: the 8000-entity cap holds and nothing janks yet, so building a worker pipeline now would be speculative.
- **True projective-texture CCTV drape** onto the 3D tileset (the "draped onto real buildings" headline) — needs a classification primitive / custom tileset shader, and the public cams serve no CORS-enabled image to sample; the wedge-drape + PiP is the honest stand-in. Genuine ceiling.
- **CCTV PnP auto-calibration** (B-18) — the author himself marked this WIP; manual pose sliders are the shipped state.

## Temporal GPS-jam follow-up (built after the remaining-list above)

CAP-21 wanted jamming intensity that **evolves with the playhead**, not a one-shot scan — so this shipped next:

- **Record-first** (STK-10): `GpsJamLayer.scan()` now `record('gpsjam', cells)`s each scan's degraded-GPS cells to the IndexedDB recorder, then draws only when not in playback (`this.playback` guard) so a live tick never paints over the playhead frame.
- **Replay**: `renderItems(cells)` lets the 4D playhead redraw recorded cells at the scrubbed instant — `gpsjam` is now a `initPlayback` layer, same seam as ships/dark-vessel. On playback exit `refresh()` clears the layer (on-demand, no live poll to restore → "live" = blank, never a stale historical frame passed off as current).
- **AUTO-SCAN** toggle (`#jam-auto`, off by default): opt-in re-scan every 3 min (`AUTO_MS=180000`) so the archive actually accumulates evolution — off by default because each tick spends one `airplanes.live` point query. Manual scans alone give sparse frames; Gulf cells are often honestly 0.
- **Verified**: `tsc` + `vite build` clean, 41/41 unit tests, `verify-backlog` extended to drive the gpsjam playback path (auto-scan → enter playback → scrub → exit) with zero pageerrors. A 4-lens opus adversarial review (correctness / types-API / integration / budget-honesty) returned **SHIP**; its one confirmed wart (stranded frame on playback exit) is the `refresh()`-clears fix above.

Still open after this: worker-thread parsing (B-10, deferred) + the two CCTV ceilings above — the "Remaining (not built)" list, minus temporal GPS-jam.

*End of build-phase log.*
