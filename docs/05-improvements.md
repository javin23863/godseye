# 05 — Improvements Beyond Parity

Improvement backlog for the godseye rebuild of Bilawal Sidhu's "God's Eye View".
Scope of this doc: (1) every limitation/wish observed in the original (cited), (2) a ranked
25-item backlog that goes beyond parity.

Cross-references: capabilities `CAP-xx` → `01-functional-spec.md`, data sources `DS-xx` →
`03-data-sources.md`, UI `UI-xx` → `04-ui-spec.md`, stack `STK-xx` → `02-architecture.md`. Limitations here are `L-xx`, backlog items `B-xx`.

**Legal scope (binding on every backlog item):** all feeds are public/open data — official APIs,
open-data portals, published DOT camera endpoints, free satellite archives. No scraping of private
data, no unsecured-camera directories (Insecam-style), no auth bypass, no paid-feed circumvention.
Items marked *proposal* are rebuild design decisions, not observed features, and need no citation.

---

## 1. Observed limitations and wishes in the original

Every row is evidenced from the source videos/repo. Rows marked *(context)* are program-level
facts that shape the rebuild rather than defects to fix.

| ID | Limitation / wish | Detail | Evidence | Backlog response |
|----|-------------------|--------|----------|------------------|
| L-01 | Fusion layer is the only missing commercial piece | Sensors and AI are already commercial; the thing that pulls all feeds into one picture doesn't exist — that is the core being built. | `vid_CHLFl26p7Po [15:36]` | B-21, B-23 |
| L-02 | No proprietary/classified data fusion (Palantir gap) | Open feeds only; conceded gap vs Palantir/Maven ("missing real proprietary data fusion", "I don't have the feeds from Fort Meade") — but a surprisingly complete picture without it. | `vid_rXvU7bPJ8n4 [00:37]`, `vid_rXvU7bPJ8n4 montage_002 tile 3,5`, `vid_rXvU7bPJ8n4 frame_01`, `vid_0p8o7AeHDzg [09:12]`, `[09:16]` | B-23 (open-feed fusion only; proprietary feeds stay out of scope) |
| L-03 | CCTV is 1 frame/minute, not real-time | CCTV layer updates at one frame per minute — real data but not live. | `vid_rXvU7bPJ8n4 [06:59]`, `vid_rXvU7bPJ8n4 frame_17` | B-18 |
| L-04 | CCTV projection calibration is WIP | A point-correspondence calibration system + shader work is planned to make the 3D projection "near perfect". | `vid_rXvU7bPJ8n4 [07:30]`, `[07:38]` | B-18 |
| L-05 | Particle spawning crashed the browser | Naive traffic-particle spawning crashed the browser; fixed by operator-directed sequential loading (main roads first, then arterial) — a scaling constraint any rebuild must respect. | `vid_rXvU7bPJ8n4 [09:39]`, `[09:44]` | B-10 |
| L-06 | 3D coverage gap requires oblique fallback | Places like Dubai lack Google 3D data ("Dubai doesn't like US companies 3D scanning their stuff"); fallback is a flat oblique-imagery substitute, not true 3D. | `vid_rXvU7bPJ8n4 [06:14]`, `[06:17]` | B-20 |
| L-07 | Alert quality bar: no detection spam | The decide-layer must automatically surface "what changed / what's anomalous", not a barrage like "unknown person detected at this timestamp". | `vid_CHLFl26p7Po [14:13]`, `[14:20]` | B-19 (design constraint) |
| L-08 | Consumer cameras are too limited (Argus motivation) | Ring is "so limited" and cloud-dependent for basic AI; implies local/edge processing ambition for the personal surface. | `vid_CHLFl26p7Po [13:53]`, `[14:00]` | *(context — Argus personal pipeline CAP-51 is outside the godseye core; no backlog item)* |
| L-09 | AIS is the expensive input | AIS ship-tracking data is the costly feed relative to free flight tracking — a cost constraint on the maritime layer. | `vid_CHLFl26p7Po [13:06]` | B-12 (free aisstream.io WebSocket per DS-05) |
| L-10 | Accuracy-at-scale / fault-attribution risk | Fused AI targeting produces wrong hits at scale and fault attribution (model vs sensor vs basemap) is unresolved — design pressure for provenance/confidence surfacing. | `vid_CHLFl26p7Po [10:54]`, `[11:37]` | B-14 |
| L-11 | Only polished b-roll, no live end-to-end session | Product appears only as produced captures; interactive flows beyond selection/toggles (search/voice/AI query) are not demonstrated in several videos. | `vid_CHLFl26p7Po [08:04]`, `[10:16]`, `vid_7HEUCLc7aL8 frame_21`, `frame_11` | B-12, B-21 |
| L-12 | Satellite coverage incomplete | Many spy satellites aren't tracked or only have a last-known position — stale/gap handling for orbital data is a known limitation. | `vid_0p8o7AeHDzg [03:47]` | B-05 |
| L-13 | No in-app entity dossier / lookup | Identifying an unfamiliar satellite requires leaving the app for a Google search — an obvious hook for an in-app AI entity card. | `vid_0p8o7AeHDzg [01:57]`, `montage_006 tile 3,4`, `montage_007 tile 2,5` | B-01 |
| L-14 | Commercial imagery 2-week hold | Commercial providers imposed a two-week waiting period on fresh imagery "for operational security", hampering the OSINT workflows the tool depends on. | `vid_ccZzOGnT4Cg [12:46]` | B-22 (route around: know when pixels were collectable) |
| L-15 | Unknown vessels are a data dead end | Some vessels have no registry info at all ("HG flag unknown unknown vessel"); dossier renders every field "Unknown". | `vid_ccZzOGnT4Cg [05:42]`, `frame_09` | B-15 |
| L-16 | AIS-off tracking needs external RF/SAR | Dark (AIS-off) vessels can't be tracked in-tool; RF geolocation and SAR are pointed to as external, not integrated. | `vid_ccZzOGnT4Cg [07:00]` | B-16, B-23 |
| L-17 | Strike timing/geolocation only approximate | Most event cards carry APPROX / APPROX DAY / APPROX SEQ chips; only some earn EXACT — event-pipeline precision is limited (surfaced honestly). | `vid_7HEUCLc7aL8 frame_16`, `frame_15`, `vid_ccZzOGnT4Cg frame_14`, `frame_16` | B-13, B-24 |
| L-18 | Only part of events verified | Provenance split between VERIFIED and OSINT/SOURCE-REPORTED/GEO-OSINT — a verification pipeline exists but is incomplete. | `vid_7HEUCLc7aL8 frame_15`, `frame_12` | B-13 |
| L-19 | Dark-transit layer off during headline counts | "DARK TRANSIT: LAYER OFF" during crossing-count analysis, so dark vessels are excluded from the counts and only inferred in narration. | `vid_7HEUCLc7aL8 frame_06`, `vid_7HEUCLc7aL8 [01:26]` | B-04 |
| L-20 | Day-chunk data, not full archive | Data loads in limited cached day-chunks with per-episode curation rather than an always-on continuous archive. | `vid_7HEUCLc7aL8 frame_15`, `frame_06`, `vid_ccZzOGnT4Cg [00:35]` | B-11, B-25 |
| L-21 | Crossing-event counts are estimates | Counts are read as approximate ("about eight", "roughly six"), not exact tallies. | `vid_7HEUCLc7aL8 [03:39]`, `[03:58]` | B-03 |
| L-22 | FLIR is a cosmetic style, not thermal data | FLIR renders the same basemap grayscale/high-contrast alongside BLOOM/SHARPEN — a look, not real thermal sensor data. | `vid_7HEUCLc7aL8 frame_12`, `frame_11`, `vid_ccZzOGnT4Cg frame_12`, `frame_11` | B-17 |
| L-23 | Built-but-unused controls | Several controls appear built but never exercised (CCTV MESH never expanded, DETECT never pressed, LIVE never engaged) — unfinished/demo-stage surface area. | `vid_7HEUCLc7aL8 frame_21`, `frame_11`, `vid_ccZzOGnT4Cg frame_21` | B-07, B-12 |
| L-24 | Not yet publicly usable; team added, roadmap pending | Product not available; team added, user opening targeted April, ~6 roadmap items pending, interim DIY via Substack; development paused for TED. | `vid_CHLFl26p7Po [15:01]`, `[15:57]`, `[16:38]`, `vid_0p8o7AeHDzg [10:30]`, `[10:45]`, `vid_ccZzOGnT4Cg [15:39]`, `[15:42]` | *(context — rebuild is not racing a shipped product)* |
| L-25 | Visualization exceeds DoD-procured systems | Defense-tech founders say the visualization shown is "leaps and bounds above systems the Department of War is buying" — positioning bar for the rebuild. | `vid_0p8o7AeHDzg [09:52]`, `[10:02]` | *(context — quality bar: parity on visuals is the floor, not the goal)* |
| L-26 | End-goal: most complete model of reality | Stated post-TED ambition to make it "the most complete model of reality you can get your hands on", implying expansion well beyond current layers. | `vid_ccZzOGnT4Cg [16:03]` | B-25 (and the moonshot tier generally) |
| L-27 | Recipe is open: Substack + transcripts | Rebuild recipe is his Substack post + YouTube transcripts fed to an AI coding agent — an explicit invitation to reproduce. | `vid_CHLFl26p7Po [16:28]`, `[16:33]` | *(context — this program is the invited reproduction)* |

---

## 2. Ranked backlog (25 items)

All items in this section are **proposals** (rebuild design decisions). Rationales cite observed
evidence via `L-xx` rows above and `CAP/DS` ids. Ordering within a tier is priority order.
`CAP-48` references carry **[SPECULATIVE]** — the voice-command capability was not CONFIRMED in
the evidence pass.

**Recommended build order:** all quick wins are independent and can land in any order after
capability parity. B-11 (continuous archive) is the highest-leverage medium item — B-16, B-19,
B-21, B-25 all sit on top of it. B-10 gates B-12.

### 2.1 Quick wins (B-01 … B-10)

Feed adapters, joins, and rendering fixes on top of existing parity plumbing. No new
infrastructure.

| ID | Name | Description | Rationale | Dependencies |
|----|------|-------------|-----------|--------------|
| B-01 | In-app entity dossier (AI lookup card) | Click any satellite/aircraft/vessel to get an AI-generated dossier card: identity, operator, mission, notable history — assembled from CelesTrak GP metadata, ADS-B registry fields, and a single LLM web-search call, cached per NORAD/ICAO/MMSI id. | L-13: identifying an unfamiliar satellite required leaving the app for Google (`vid_0p8o7AeHDzg [01:57]`). All join keys (NORAD ID, ICAO hex, MMSI) are already on-screen; this is one API route plus a card component. | CAP-10, CAP-11, CAP-13; DS-02, DS-04, DS-05 |
| B-02 | Fires / natural-events layer (FIRMS + EONET) | Add NASA FIRMS VIIRS 375 m active-fire detections and NASA EONET curated natural events as two toggleable layers using the existing DATA LAYERS row pattern. | DS-22 flags this as the standard missing live layer; FIRMS is a free MAP_KEY GeoJSON feed and EONET needs no key. Pure capability gap — layer plumbing (CAP-07) already exists, so this is one feed adapter each. | CAP-07; DS-22 |
| B-03 | Deterministic gate-crossing tallies + CSV export | Replace narrated approximate counts with exact segment-intersection counting against the gate lines, rendered as precise IN/OUT integers per day, with one-click CSV/JSON export of the crossing events. | L-21: counts were "about eight", "roughly six" (`vid_7HEUCLc7aL8 [03:39]`). Track data is already loaded; line-segment intersection is trivial and turns a vibe into an auditable number — the KPI tiles inherit the fix for free. | CAP-15, CAP-37; DS-05 |
| B-04 | Include dark transits in chokepoint counts | Fold DARK TRANSIT WATCH entries into the gate analytics as a third counted class (IN / OUT / DARK-est), with a visible footnote of the inference method. | L-19: "DARK TRANSIT: LAYER OFF" during headline counts — dark vessels excluded, only inferred in narration (`vid_7HEUCLc7aL8 frame_06`). Both datasets already exist in-app; this is a join, not a new pipeline. | CAP-14, CAP-15; B-03 |
| B-05 | TLE staleness & confidence badges on satellites | Show TLE epoch age on every satellite label, decay position-confidence visually (dashed orbit, widening error ring) as epochs age, and mark last-known-only objects explicitly instead of rendering them as live. | L-12: many spy sats untracked or last-known-position only (`vid_0p8o7AeHDzg [03:47]`). Epoch age is already in the GP data (DS-04); rendering honesty is a shader/label tweak and directly serves the provenance design pressure (L-10). | CAP-11; DS-04 |
| B-06 | Live GPS-jamming computation from ADS-B integrity fields | Compute the jamming hex layer in near-real-time by hex-binning low NIC/NACp reports from the OpenSky/adsb.lol state vectors already being polled, instead of a curated per-episode dataset. | DS-11 confirms the gpsjam.org method and notes the integrity fields ride the same state vectors as the flight layer — zero new feeds, one binning function, and the layer stops depending on day-chunk curation (L-20). | CAP-08, CAP-21; DS-02, DS-11 |
| B-07 | Wire the undemoed layers: weather radar + bikeshare | Back the existing Weather Radar toggle with its UI-named provider — NOAA NEXRAD (US, per the layer-row subtitle "NOAA NEXRAD (globe overlay)", see DS-09) — adding RainViewer free tiles for global coverage (*proposal*); back the Bikeshare toggle with GBFS city feeds. Delete either toggle if not wired. | CAP-18/CAP-19 exist as UI rows but were never demoed, and L-23 flags built-but-unused controls as demo-stage debt. NEXRAD, RainViewer, and GBFS are all free (DS-09/DS-10); dead toggles are worse than no toggles. | CAP-18, CAP-19; DS-09, DS-10 |
| B-08 | Automated internet-outage feed (Cloudflare Radar + IODA) | Drive the blackout layer from Cloudflare Radar outage endpoints and IODA's near-real-time API with auto-drawn country/ASN polygons, replacing hand-placed "TEHRAN INTERNET BLACKOUT" annotations. | DS-13: the source was implied but never named, i.e. curated by hand. Both APIs are free and the polygon rendering already exists — converts a per-episode artifact into a standing live layer. | CAP-23; DS-13 |
| B-09 | Live oil/commodity feed with provenance stamp | Automate the Brent/WTI/spread panel: FRED daily closes for playback alignment (DS-17, verified keyless) plus a free delayed intraday feed for LIVE mode (e.g. Yahoo futures — *proposal*, not evidenced in DS-17; stooq rejected as bot-blocked, DS-17 gapfill-3), timestamp each quote, label the delay ("DELAYED 15M" chip). | DS-17: price source is unevidenced, likely manually keyed per episode. A financial panel with no source stamp violates the tool's own provenance bar (L-10); a free delayed feed plus a delay chip fixes both. | CAP-36, CAP-38; DS-17 |
| B-10 | Progressive entity streaming & clustering (crash-proofing) | Formalize the sequential-loading hack into an engine rule: viewport-tiled entity fetch, worker-thread parsing, density-based clustering above entity thresholds, and a hard on-screen entity budget with graceful degradation. | L-05: naive particle spawning crashed the browser; fixed ad hoc by operator-directed sequencing (`vid_rXvU7bPJ8n4 [09:39]`). A rebuild fusing 7K flights + global AIS + traffic particles hits this wall on day one; make the fix systemic, not per-layer. | CAP-07, CAP-16, CAP-57; DS-02, DS-05, DS-07 |

### 2.2 Medium (B-11 … B-20)

New pipelines and services behind existing UI surfaces. B-11 first — three later items depend on it.

| ID | Name | Description | Rationale | Dependencies |
|----|------|-------------|-----------|--------------|
| B-11 | Continuous always-on archive (kill day-chunks) | Stream every live feed into an append-only columnar store (Parquet on object storage, partitioned by layer/hour) so the 4D timeline can scrub any historical range on demand instead of loading curated per-episode day-chunks. | L-20: data loads as cached day-chunks with per-episode curation (`vid_7HEUCLc7aL8 frame_15`). The single highest-leverage unlock: baselines (B-19), anomaly detection, NL queries (B-21), and multi-year replay (B-25) all need a real archive underneath. | CAP-38; all live DS feeds (DS-02, DS-04, DS-05, DS-08, DS-11) |
| B-12 | Ship LIVE mode for real | Make the LIVE/PLAYBACK toggle genuinely stream: aisstream.io WebSocket for AIS, OpenSky/adsb.lol polling for flights, client-side SGP4 for sats, USGS 1-min feed for quakes — with per-layer freshness indicators in the header. | L-11/L-23: only PLAYBACK is ever demonstrated; open question whether LIVE streams at all. Every recommended source (DS-02/04/05/08) supports live delivery free — this also neutralizes the AIS cost constraint (L-09). The difference between a replay viewer and an operational picture. | CAP-40; DS-02, DS-04, DS-05, DS-08; B-10 |
| B-13 | Automated OSINT event pipeline with verification tiers | Replace hand-curated Ground Truth Cards with an ingest pipeline: GDELT GEO 2.0 (15-min) + ACLED + geocoded RSS → dedupe/cluster → auto-assign the existing taxonomy and provenance tier, with a human-review queue that promotes GEO-OSINT to VERIFIED. | L-17/L-18: only part of events verified, timing/geolocation mostly APPROX; curation method unstated (DS-16). DS-16 names free geocoded feeds; the card UI and taxonomy already exist — the gap is the pipeline behind them. | CAP-33, CAP-34; DS-16, DS-19 |
| B-14 | Provenance & confidence chain on every derived claim | Every rendered assertion (dark transit, jamming hex, crossing count, event card) carries a clickable chain: source feed + timestamp + transformation + confidence score, surfaced in a uniform inspector panel. | L-10: fused AI produces wrong hits at scale and fault attribution (model vs sensor vs basemap) is unresolved (`vid_CHLFl26p7Po [10:54]`). The original already grades events VERIFIED/GEO-OSINT — generalize that discipline to every layer. | CAP-14, CAP-21, CAP-33, CAP-37 |
| B-15 | Vessel registry enrichment (kill the Unknown dossier) | Multi-source registry join for the vessel dossier: Global Fishing Watch vessel API + Equasis/ITU MMSI lookups + AIS static-message harvesting over time, cached per MMSI, with per-field source attribution and a "registry gap" flag instead of silent Unknowns. | L-15: every dossier field renders Unknown for unregistered vessels (`vid_ccZzOGnT4Cg [05:42]`). DS-18 confirms the registry join exists but is single-source; unknown-registry vessels are exactly the interesting ones (shadow fleet), so enrichment is analytic capability, not polish. | CAP-13; DS-05, DS-18 |
| B-16 | Sentinel-1 SAR dark-vessel reacquisition | When a DARK TRANSIT window opens, auto-query Copernicus Data Space for Sentinel-1 scenes intersecting the predicted corridor, run CFAR ship detection on the scene, and pin unmatched SAR contacts as candidate reacquisitions on the timeline. | L-16: RF/SAR pointed to as external, not integrated (`vid_ccZzOGnT4Cg [07:00]`). DS-14 confirms Sentinel-1 is free with an account; closes the tool's most-narrated analytic gap with a free source. | CAP-14; DS-14; B-11 |
| B-17 | Real thermal layer (stop faking FLIR) | Add a data-backed thermal mode: NASA GIBS VIIRS brightness-temperature / day-night-band WMTS tiles plus FIRMS hotspots draped on the globe, offered alongside the cosmetic FLIR shader and labeled as measured vs stylized. | L-22: FLIR is a look, not thermal data (`vid_7HEUCLc7aL8 frame_12`). GIBS is keyless WMTS (DS-14), the style-preset system already handles mode switching — the delta is honest data behind an existing look. | CAP-04; DS-14, DS-22; B-02 (shares FIRMS adapter) |
| B-18 | CCTV auto-calibration + best-available frame rate | Finish the projection pipeline: point-correspondence PnP solve against the 3D tiles for one-click calibration (replacing manual sliders), and per-camera capability detection to use MJPEG/HLS streams where DOTs publish them, falling back to 1-frame/min snapshots. Public DOT endpoints only. | L-03/L-04: 1 fpm cadence and calibration explicitly WIP — Sidhu planned the point-correspondence system himself (`vid_rXvU7bPJ8n4 [07:30]`). DS-06 lists DOT endpoints that serve real streams (Caltrans, TranStar), so the 1 fpm cap is per-source, not inherent. | CAP-01, CAP-20; DS-01, DS-06 |
| B-19 | Anomaly decide-layer v1 (baseline + deviation alerts) | Per-layer rolling baselines from the archive (crossing rates, flight density per region, jamming extent, dark-transit frequency); alert only on significant deviations, each alert carrying its baseline window, magnitude, and provenance chain. Digest view, hard alert-rate cap. | CAP-50 is the stated roadmap ("surface what changed / what's anomalous") and L-07 sets the quality bar: no detection spam (`vid_CHLFl26p7Po [14:13]`). The KPI machinery (CAP-37) already computes pre/post deltas for one strait — generalize it and invert it into push. | CAP-37, CAP-50; B-11, B-14 |
| B-20 | Procedural 3D fallback for coverage gaps | Where Google 3D Tiles are absent (Dubai et al.), extrude OSM building footprints with height tags into simple 3D volumes textured from the oblique imagery, so the globe stays 3D instead of dropping to a flat oblique substitute. | L-06: coverage gap forces a flat oblique fallback (`vid_rXvU7bPJ8n4 [06:14]`). OSM building data is already queried for POI centering (CAP-43) and traffic (CAP-16, DS-07); extrusion is well-trodden and keeps sensor presets and camera moves consistent everywhere. | CAP-01, CAP-02, CAP-16, CAP-43; DS-01, DS-07 |

### 2.3 Moonshots (B-21 … B-25)

Capability combinations the original renders but never exploits. All stay within open data.

| ID | Name | Description | Rationale | Dependencies |
|----|------|-------------|-----------|--------------|
| B-21 | Natural-language spatiotemporal query | LLM-driven query over the archive: "show every tanker that went dark within 50 nm of Kharg Island in June" → compiled filter (layer, geofence, time range, predicate) → results rendered as a temporary layer + auto-configured timeline window, saved as a shareable scene preset. | L-01/L-11: the search box (CAP-53) and voice interface (CAP-48 [SPECULATIVE]) exist but no query behavior was ever demonstrated. This is the fusion layer Sidhu calls the only missing commercial piece (`vid_CHLFl26p7Po [15:36]`), made interrogable — what turns viewers into analysts. | CAP-42, CAP-48 [SPECULATIVE], CAP-53; B-11 |
| B-22 | Imaging-overflight prediction & AOI watch | Extend the imaging-satellite layer from observed passes to predicted ones: propagate the imaging-sat catalog forward, compute access windows over user AOIs (reusing the access-line geometry), and alert "Pleiades Neo images your AOI in 40 min" — plus a reverse view of which actors can currently see a location. | CAP-12's access lines are retrospective inference, but SGP4 propagation (DS-04, already client-side) makes the forward computation free. Also routes around the 2-week commercial imagery hold (L-14) — you can't get the pixels fast, but you can know exactly when they were collectable. | CAP-12, CAP-29; DS-04 |
| B-23 | Multi-source dark-target fusion cell | A standing fusion pipeline that cross-correlates AIS gaps, Sentinel-1/Umbra/Capella open SAR detections, GPS-jamming hexes, and OSINT event cards into unified "dark target" tracks with confidence scoring — the in-house version of the RF/SAR services the original points at externally. | L-01/L-02/L-16: the fusion layer is the missing piece, proprietary feeds are out of reach — but cross-correlating the free feeds already in the tool is exactly the fusion no one ships openly. Open SAR only (Copernicus, Umbra/Capella open data per DS-14). | CAP-14, CAP-21, CAP-33; DS-14; B-16 |
| B-24 | Agent-swarm continuous curation with auto-geolocation | Make the agent-swarm ingest (CAP-52) a standing service: agents continuously harvest public social/OSINT media before caches clear, then auto-geolocate imagery by matching frames against the photorealistic 3D tiles (skyline/facade matching) to upgrade APPROX events to EXACT with a machine-verifiable method chip. | L-17: most cards APPROX, curation per-episode/manual. The 3D basemap (CAP-01) is itself the geolocation reference database — a capability combination the current build renders but never exploits. Public posts/outlets only, respecting platform terms. | CAP-01, CAP-33, CAP-52; DS-16, DS-19; B-13 |
| B-25 | Historical time machine (multi-year replay) | Extend 4D playback beyond curated multi-week windows to years: backfill from archival feeds (OpenSky historical, GDELT back-catalog, USGS archives, Sentinel archives) so any past crisis can be reconstructed on demand at existing time-compression rates. | L-26: stated end-goal is "the most complete model of reality you can get your hands on" (`vid_ccZzOGnT4Cg [16:03]`), and L-20's day-chunk limit is the blocker. The playback UX (CAP-38/39) already scales time compression; only data depth is missing, and several sources publish free historical archives. | CAP-38, CAP-39; DS-02, DS-08, DS-14, DS-16; B-11 |

---

## 3. Dependency graph (backlog-internal)

```
B-03 ──> B-04
B-10 ──> B-12
B-02 ──> B-17 (shared FIRMS adapter)
B-11 ──> B-16 ──> B-23
B-11 ──> B-19        B-14 ──> B-19
B-11 ──> B-21
B-11 ──> B-25
B-13 ──> B-24
```

Everything else is independent. The operator's ask — "all functionalities and capabilities and any
improvements in functionality that you can see or help with" — is satisfied by: parity docs
(01–04) for the functionality, section 1 here for everything the original visibly cannot do, and
section 2 for the improvements, quick wins first.
