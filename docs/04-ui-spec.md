# 04 — UI Spec

Interface specification for godseye, reverse-engineered from the original "God's Eye View" (ex-WorldView) app. Every claim about the original carries a citation; items marked **[PROPOSAL]** are our design decisions and need no citation. All 33 UI spec points (UI-01..UI-32 + UI-02b) are indexed in §8. Cross-reference capabilities as CAP-xx (see `01-functional-spec.md`), data sources as DS-xx (`03-data-sources.md`), stack as STK-xx (`02-architecture.md`).

The app has two evidenced skins that share one design language:

- **3D globe command center** — CesiumJS globe inside a circular scope mask, HUD chrome around it (`repo-asset:god-view-hero-crt.jpg`, UI-10).
- **2D analyst dashboard** ("MAPTHEWORLD.AI") — flat map + charts + analyst controls (UI-22, `vid_ccZzOGnT4Cg frame_04`).

---

## 1. Layout regions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SPARSE VIS:34 SRC:450 DENS:2.20 0.2ms                (render stats strip)    │
│ ◉ GOD'S EYE VIEW                                    ACTIVE STYLE             │
│ NO PLACE LEFT BEHIND                                CRT                      │
│                                                                              │
│ TOP SECRET // SI-TK // NOFORN                REC 2026-06-23 03:21:38Z        │
│ KH11-4171 OPS-4128                           ORB: 47431 PASS: DESC-247       │
│ CRT                                                                          │
│ SUMMARY: MILITARY FLIGHTS SATELLITES …       ┌ DISPLAY ──────┐               │
│ ┌ CCTV MESH    + ┐   ╭────────────────╮      └───────────────┘  [3D]         │
│ ┌ DATA LAYERS  + ┐   │                │      ┌ PARAMETERS ───┐          B    │
│ ┌ MAP STACK    + ┐   │  GLOBE VIEW    │      └───────────────┘          A    │
│ ┌ SCENES       + ┐   │  (scope mask)  │                                 N    │
│ O                    │                │                                 D    │
│ N                    ╰────────────────╯      GSD: 6038.84M NIIRS: 0.0        │
│ A                                            ALT: 16103578M SUN: -22.8° EL   │
│                                              AIS: --                         │
│ MGRS: 14Q KJ 3307 8505    ┌ LOCATIONS + ┐                                    │
│ 21°32'54.40"N 101°34'37.92"W  📍 San Francisco                               │
│                            Golden Gate Bridge                                │
│              ┌ STYLE PRESETS + ┐             ┌ STOP │ LISTENING ┐            │
│              │ STYLE  CRT      │             │ Ask or command   │            │
└──────────────────────────────────────────────────────────────────────────────┘
```
Wireframe transcribed from `repo-asset:god-view-hero-crt.jpg`.

### 1.1 Header / brand (top-left) — UI-01
- Globe/dot glyph + wordmark: `GOD'S EYE` in white, `VIEW` in cyan (earlier builds: `WORLD` white + `VIEW` cyan). Letterspaced monospace caps. Tagline beneath: `NO PLACE LEFT BEHIND`. (`vid_rXvU7bPJ8n4 frame_03`, `repo-asset:god-view-hero-crt.jpg`)

### 1.2 Left rail — accordion panels — UI-28
Stacked dark rounded cards, each a `+`-expander (`repo-asset:god-view-hero-crt.jpg`, `vid_7HEUCLc7aL8 frame_11/frame_21`):
1. **CCTV MESH** — public camera layer controls (collapsed in all evidence).
2. **DATA LAYERS** — expanded form is UI-05: rows of `icon + name + provider-attribution subtitle + live count badge + ON/OFF pill`, header search/filter icon. Evidenced rows: Live Flights, Military Flights, Earthquakes (24h), Satellites, Ocean/Street Traffic, Weather Radar, CCTV Mesh, Bikeshare (`vid_CHLFl26p7Po [08:04]`, `vid_rXvU7bPJ8n4 frame_07`).
3. **MAP STACK** — basemap selection (label partially unreadable in evidence; contents [SPECULATIVE], propose it hosts the MAP: AERIAL+LBL/ROAD/GOOGLE 3D toggles of UI-19).
4. **SCENES** — shot planner: Shot 1/2/3 rows with LOAD/DEL, `CAPTURE SHOT`/`UPDATE SHOT` buttons (CAP-45, `vid_rXvU7bPJ8n4 [01:24]`, `montage_005 tile 1,2`).

Left panel also hosts the in-view vessel counter in maritime mode: `VESSELS IN VIEW: 3,842 / 9,431` + per-type count rows + first-transits line (UI-32, `vid_ccZzOGnT4Cg frame_01`).

### 1.3 Right rail — DISPLAY / PARAMETERS — UI-08
Vertical stack of dark rounded cards, cyan accents (`vid_0p8o7AeHDzg frame_03/frame_21`, `repo-asset:god-view-hero-crt.jpg`):
- Search input.
- **DISPLAY** card (repo hero) with `3D` toggle beneath.
- **BLOOM** toggle.
- **SHARPEN** slider with % readout.
- **HUD** button (toggles HUD chrome).
- **LAYOUT** dropdown, evidenced value `Tactical`.
- Green **PANOPTIC** toggle + opacity/density slider + per-entity checkboxes.
- **DETECT** button [SPECULATIVE — claimed but not visible in the verifying video, `sec_ui.json UI-08 verdict_note`].
- **CLEAN UI / CLEAR** button.
- **PARAMETERS** card (repo hero) — per-preset effect sliders live here, see §4.

### 1.4 Bottom band
- **Location pill** (bottom-center): pin glyph + current city/region; expands to `LOCATIONS [+]` panel with `Location: --` / `Landmark: --` fields (UI-30, CAP-47, `vid_0p8o7AeHDzg frame_03/frame_04`).
- **STYLE PRESETS dock**: horizontal icon-chip row, active chip highlighted, chyron `STYLE PRESETS — Visual Modes` (UI-06, `vid_rXvU7bPJ8n4 frame_03`).
- **City / landmark chip bars**: city row (Austin/San Francisco/New York/Tokyo/London/Paris/Dubai/Washington DC) with a per-city landmark row above it, centered above the dock (UI-07, `vid_rXvU7bPJ8n4 frame_06`).
- **Layer chip bar** (war/globe mode): pill-chip toggles with per-layer icons + lit-active state — Commercial Flights, Military Flights, GPS Jamming, Ground Truth Cards, Imaging Satellites, Maritime Traffic, Airspace Restrictions, VHF Intercept, Internet Blackout, Country Boundaries, OSINT Social Events, Fixed-Site Strikes (UI-20, `vid_ccZzOGnT4Cg frame_14`, `vid_CHLFl26p7Po [10:16]`).
- **Timeline / playback bar** (playback mode): see §6.3 (UI-17).
- **Camera control cluster**: `ORBIT: OFF [slider] N°/s [Target ▼] [FLAT] [SPIRAL IN] [SPIRAL OUT] [dist slider] [pitch slider] [FOV slider]` (UI-18, CAP-46, `vid_ccZzOGnT4Cg frame_14/frame_01` — 250 km / 45° / 60° FOV evidenced values).
- **Scene bar + map row**: `SCENE: [name ▼] [description - date range]` (e.g. `Iran War Infrastructure ▼ | Fixed-Site Strikes - Feb 28 to Mar 27, 2026`) and `MAP: [GOOGLE 3D] [AERIAL+LBL] [ROAD]` (UI-19, CAP-42, `vid_ccZzOGnT4Cg frame_14`).
- **Voice widget** (bottom-right): `STOP | LISTENING — Ask or command` (UI-29; verdict field absent in evidence JSON but visually confirmed directly in `repo-asset:god-view-hero-crt.jpg` bottom-right).

### 1.5 Corner / edge telemetry
- Top-left strip: render stats (§2.3).
- Top-right: ACTIVE STYLE + REC + ORB/PASS (§2.2).
- Bottom-left: MGRS + DMS (§2.2).
- Bottom-right: GSD/NIIRS, ALT/SUN EL, AIS (§2.2).
- Vertical edge text, rotated 90°: left edge `ONA: 3.1°` and `COLL: 03:21:39Z`; right edge `BAND: PAN  BITS: 11  LVL: 1A` (UI-02b, `repo-asset:god-view-hero-crt.jpg`).

### 1.6 Scope mask & wallpaper — UI-10
Viewport rendered inside a circular scope/porthole mask with CRT scanlines; black surround with faint topographic contour linework framing the app (`vid_ccZzOGnT4Cg frame_01/frame_19`, `vid_0p8o7AeHDzg frame_05`). **[PROPOSAL]** implement as a CSS mask + fixed SVG contour background, togglable via the HUD button.

### 1.7 2D analyst dashboard — UI-22
Separate layout, same theme (`vid_ccZzOGnT4Cg frame_04/frame_12/frame_05`, `vid_7HEUCLc7aL8 frame_06/frame_07`):
- Brand row `MAPTHEWORLD.AI • PLAYBACK ⊖`; title `STRAIT OF HORMUZ GOD'S EYE VIEW`.
- Metric tabs: OPERATIONAL EVENTS / UNIQUE VESSELS / COMMERCIAL OBSERVED.
- Events time-series chart with `OVERVIEW | PLAYBACK LENS` toggle + INBOUND/OUTBOUND legend.
- **ANALYST CONTROLS** panel: stat tiles (FILTERED / ACTIVE / LOADED TRIPS), PRESETS (FULL PERIOD / BEFORE CHOKEPOINT / AFTER CHOKEPOINT / AFTER CEASEFIRE — CAP for analyst presets, `vid_ccZzOGnT4Cg frame_12`), collapsible FILTERS/LAYERS, layer chips: TRIPS / HEADS / DENSITY / PIPELINES / STRIKES / INFRASTRUCTURE / DESAL / GATES / DARK-GAP.
- `RESET VIEW` button.
- **OIL RISK MATRIX — [date]** panel: three price tiles (GLOBAL BRENT / U.S. WTI / BRENT-WTI SPREAD) with % day-over-day change + sparklines, values update as the timeline scrubs (UI-23, `vid_ccZzOGnT4Cg frame_04/frame_06`).

---

## 2. HUD readouts — exact formats

All monospace, all-caps. Example values are literal strings observed in evidence; treat field widths as shown.

### 2.1 Classification block (top-left) — UI-02
```
TOP SECRET // SI-TK // NOFORN
KH11-4171 OPS-4128
CRT
SUMMARY
NORMAL GLOBAL NEAR PALM JUMEIRAH (DUBAI)
```
- Line 1: static fake-classification banner, red/amber (`vid_rXvU7bPJ8n4 frame_03`, `repo-asset:god-view-hero-crt.jpg`).
- Line 2: sensor designator, format `KH11-nnnn OPS-nnnn` (randomized 4-digit groups; observed `KH11-4040 OPS-4138`, `KH11-4171 OPS-4128`).
- Line 3: active style name.
- Summary caption template: `[STYLE] [SCALE] NEAR [LANDMARK] (CITY) [DIST]KM` — auto-generated, location-aware (`vid_rXvU7bPJ8n4 frame_03` shows `NORMAL GLOBAL NEAR PALM JUMEIRAH (DUBAI)`).

### 2.2 Telemetry corners — UI-03, UI-04, UI-02b
| Readout | Format | Observed example | Citation |
|---|---|---|---|
| ACTIVE STYLE (top-right) | `ACTIVE STYLE` label + preset name | `ACTIVE STYLE / NORMAL` | `vid_rXvU7bPJ8n4 frame_03` |
| REC clock (top-right) | red dot + `REC YYYY-MM-DD HH:MM:SSZ` (UTC) | `REC 2026-03-03 00:36:34Z` | `vid_rXvU7bPJ8n4 frame_03` |
| Orbit/pass (top-right) | `ORB: nnnnn PASS: DESC-nnn` | `ORB: 47931 PASS: DESC-193` | `vid_rXvU7bPJ8n4 frame_03` |
| MGRS (bottom-left) | `MGRS: GZD SQ EEEE NNNN` | `MGRS: 14R PU 2097 4412` | `vid_rXvU7bPJ8n4 frame_03`, `vid_ccZzOGnT4Cg frame_14` |
| DMS lat/lon (bottom-left) | `DD°MM'SS.SS"N DDD°MM'SS.SS"W` | `30°16'04.08"N 097°44'32.61"W` | `vid_rXvU7bPJ8n4 frame_03` |
| GSD/NIIRS (bottom-right) | `GSD: n.nnM NIIRS: n.n` | `GSD: 6038.84M NIIRS: 0.0` | `repo-asset:god-view-hero-crt.jpg` |
| Altitude/sun (bottom-right) | `ALT: nM SUN: -nn.n° EL` | `ALT: 16103578M SUN: -22.8° EL` | `repo-asset:god-view-hero-crt.jpg` |
| AIS (bottom-right) | `AIS: --` or count | `AIS: --` | `repo-asset:god-view-hero-crt.jpg` |
| Collection time (left edge, vertical) | `COLL: HH:MM:SSZ` | `COLL: 03:21:39Z` | `repo-asset:god-view-hero-crt.jpg` |
| Off-nadir angle (left edge, vertical) | `ONA: n.n°` | `ONA: 3.1°` | `repo-asset:god-view-hero-crt.jpg` |
| Band/bits/level (right edge, vertical) | `BAND: XXX BITS: nn LVL: nX` | `BAND: PAN BITS: 11 LVL: 1A` | `repo-asset:god-view-hero-crt.jpg` |

MGRS + DMS update live with camera position (UI-04, `vid_ccZzOGnT4Cg frame_14/frame_16`). GSD/ALT should be derived from the actual Cesium camera; NIIRS/ONA/BAND/BITS/LVL are flavor fields — **[PROPOSAL]** compute NIIRS from GSD via the general image-quality equation approximation, keep BAND/BITS/LVL static per style.

### 2.3 Render stats strip — UI-02b
Top-left strip, format: `[MODE] VIS:nn SRC:nnn DENS:n.nn n.nms` = detection-density mode, visible entity count, source count, density factor, frame time.
- `SPARSE VIS:34 SRC:450 DENS:2.20 0.2ms` (`repo-asset:god-view-hero-crt.jpg`)
- `PANOPTIC VIS:0 SRC:10 DENS:1.88 3.9ms`, `VIS:4 SRC:11 … 4.3ms` (`vid_0p8o7AeHDzg frame_03/frame_05`)

### 2.4 Timeline clock & status — UI-17
- Centered ms-precision UTC clock: `HH:MM:SS.mmmZ`, observed `15:38:49.199Z` (`vid_ccZzOGnT4Cg frame_05`), 500 ms playhead resolution observed (`11:59:59.500Z`, `sec_gaps.json` gap-fill on `vid_ccZzOGnT4Cg frame_15`).
- Status line: `N ACTIVE VESSELS · 8 CACHED DAY CHUNKS` (`vid_ccZzOGnT4Cg frame_05`).

### 2.5 Crossing-events lens HUD — UI-24
Floating dark card anchored to the timeline playhead by a vertical cyan line: date header (`MAR 08, 2026`) + three tiles `N CROSSING EVENTS / N IN / N OUT` (observed 17/11/6) + footer `DARK TRANSIT: LAYER OFF` + grayed `LIVE` label (`vid_ccZzOGnT4Cg frame_03`).

---

## 3. Label conventions — UI-11, UI-12, UI-13, UI-14, UI-15, UI-16, UI-25, UI-26, UI-27

| Entity | Label format | Color | Citation |
|---|---|---|---|
| Satellite (unnamed) | `SAT-XXXXX` (5-digit, NORAD-style) | amber/orange mono; restyles per preset — teal in CRT/Normal, green in NVG | `vid_rXvU7bPJ8n4 frame_07/frame_14`, `repo-asset:god-view-hero-crt.jpg` (SAT-31114, SAT-39728…) |
| Satellite (named) | catalog name, e.g. `USA-234 (TOPAZ)`, `SL-3 R/B` | same | `vid_0p8o7AeHDzg [01:41]`, `vid_CHLFl26p7Po [08:16]` |
| Vehicle (CCTV/panoptic detections) | `VEH-XXXX` (4-digit) + corner-bracket reticle | amber/orange mono | `vid_rXvU7bPJ8n4 frame_23`, `repo-asset:god-view-hero-censored.jpg` (VEH-1482, VEH-2594…) |
| Aircraft, commercial | callsign | cyan | `vid_CHLFl26p7Po [08:08]` |
| Aircraft, military | callsign | yellow | `vid_CHLFl26p7Po [08:12]` |

Detail surfaces:
- **Selected-satellite card** (UI-12): catalog name + `7xx km - NORAD 11xxx` altitude/id line; yellow orbit polyline + red ground-track line drawn on the globe (`vid_CHLFl26p7Po [08:16]/[08:20]`).
- **Military aircraft tooltip** (UI-13): `CALLSIGN / TYPE | SERIAL / Operator ... | ALT ft` — observed `R47T13 / C303 | 07-0136 / Operator unknown | 28000 ft`, amber (`vid_rXvU7bPJ8n4 frame_12`).
- **Vessel dossier** (UI-14): flag icon + name + flag state + type header; sections ROUTE (destination/departure), RAW AIS, ETA/ATD, SPECS (gross tonnage, deadweight, draught, dimensions, built), OWNERSHIP (owner/flag/operator). Unknown vessels render every field `Unknown` (`vid_ccZzOGnT4Cg frame_05/frame_09`).
- **DARK TRANSIT WATCH list** (UI-15): rows = classification chips (`INNER THEN DARK EXIT` / `PRIMARY` / `HIGH`) + description + UTC time range; amber `SEEN AGAIN` marker on the map where AIS resumes (`vid_ccZzOGnT4Cg frame_11/frame_10`).
- **Ground Truth Card** (UI-16): dark rounded card — header = category pill (left) + UTC time (right); all-caps title; optional embedded photo/satellite thumbnail or vertical video (carousel counter, `VIDEO HERO` button); leader line to map anchor. Strike variant adds ATTACKER→TARGET flag chips, precision chip (`EXACT` / `APPROX DAY` / `APPROX SEQ`), provenance chip (`VERIFIED` / `GEO-OSINT`), strike-type subtitle (`vid_ccZzOGnT4Cg frame_14/frame_16`, `vid_7HEUCLc7aL8 frame_16`).
- **Selection ring** (UI-25): cyan/gold dashed ring with heading arrow around the focused vessel/aircraft/satellite (`vid_ccZzOGnT4Cg frame_09/frame_11`).
- **Site pins** (UI-26): orange teardrop pin + teal halo ring + green label box (e.g. `FARP AIRSTRIP`); dotted orange relation lines linking related sites (`vid_7HEUCLc7aL8 frame_19/frame_20`).
- **Airspace closures** (UI-27): dark rectangular on-globe banners `X AIRSPACE CLOSED` + country-name labels; countries fill translucent red with glowing wall-like extruded borders (`vid_0p8o7AeHDzg frame_16/frame_08/frame_14/frame_12`).
- **Legends** (UI-21): flag-icon conflict-pair legend (US+Israel→Iran, Iran→US, Iran→Gulf, Israel→Lebanon, ● Ceasefire); 7-category event-color legend (Kinetic / Retaliation / Civilian Impact / Maritime / Infrastructure / Escalation / Airspace Closure); vessel-type legend (▲ Tanker / Cargo / Military) (`vid_0p8o7AeHDzg frame_03/frame_05`, `vid_7HEUCLc7aL8 frame_11`).

---

## 4. Style presets & per-effect sliders — UI-06, UI-09, CAP-04, CAP-05

Preset dock chips (icon + name), active chip highlighted (`vid_rXvU7bPJ8n4 frame_03`, `montage_004`):

| # | Preset | Notes |
|---|---|---|
| 1 | Normal | photoreal passthrough |
| 2 | CRT | scanlines + phosphor; sliders: **Pixelation / Distortion / Instability** (three cyan-dot sliders, UI-09, `vid_rXvU7bPJ8n4 frame_19`) |
| 3 | NVG | night-vision green; entity labels restyle green (UI-11) |
| 4 | FLIR | thermal white-hot look (`https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator` names CRT/NVG/FLIR/anime modes) |
| 5 | Anime | cel-shading |
| 6 | Noir | high-contrast B/W [video-only evidence, `vid_rXvU7bPJ8n4 frame_03`] |
| 7–8 | +2 unnamed chips | [SPECULATIVE — chips visible but names unread, `vid_rXvU7bPJ8n4 frame_03`] |

Global post-processing controls (preset-independent, right rail): BLOOM toggle, SHARPEN slider with % readout (`vid_0p8o7AeHDzg frame_03/frame_21`). CAP-05 also claims a **sensitivity** slider [SPECULATIVE — named in description, not visible in verifying frames].

**[PROPOSAL]** Each preset = a post-process shader pass + a label-restyle token set (`--label-sat`, `--label-veh` CSS vars); per-preset slider card renders from a preset-descriptor `{name, icon, uniforms: [{label, min, max, default}]}` so new presets need no UI code.

---

## 5. Typography & color — UI-31

- Canvas: dark near-black; faint topographic contour wallpaper behind panels (`vid_rXvU7bPJ8n4 frame_03`, `vid_ccZzOGnT4Cg frame_04`).
- Type: monospace, all-caps microtext throughout; letterspaced wordmark (`repo-asset:god-view-hero-crt.jpg`).
- Accents:
  - **Cyan** — primary accent: wordmark `VIEW`, sliders, toggles, selection rings, anchor lines, commercial callsigns.
  - **Amber/orange** — detections, entity tags (SAT-/VEH-), tooltips, outbound series, corner-bracket reticles, site pins, SEEN AGAIN markers.
  - **Red** — classification banner, REC dot, critical chips, satellite ground-track, airspace fills.
  - **Green** — NVG label restyle, PANOPTIC toggle, site label boxes.
  - **Yellow** — military callsigns, satellite orbit polylines.
- Panels: dark rounded cards, subtle borders, glowing toggle states (`vid_0p8o7AeHDzg frame_03`).
- Overall register: deliberate spy-thriller CRT/military-HUD aesthetic (`vid_rXvU7bPJ8n4 [00:24]`).

**[PROPOSAL]** token set: `--bg:#050608`, `--panel:#0c1014cc`, `--cyan:#35d6e8`, `--amber:#f0a03c`, `--red:#e8453c`, `--green:#3ce87a`, `--yellow:#e8d43c`, font `IBM Plex Mono` / `JetBrains Mono` fallback `monospace`. Exact hex values are proposals; hue/role assignments above are evidenced.

---

## 6. Interaction map

### 6.1 Keyboard — CAP-44
| Key | Action | Citation |
|---|---|---|
| `1`–`8` | switch style preset (dock order) | `vid_rXvU7bPJ8n4 [01:08]` "click through these numbers" |
| `Q W E R T` | jump between the current city's points of interest | `vid_rXvU7bPJ8n4 [02:16]-[02:19]` |

POI jumps center the camera on each landmark's OpenStreetMap 3D volume, not raw lat/lon (CAP-43, `vid_rXvU7bPJ8n4 [01:50]-[02:10]`).

### 6.2 Pointer
- **Click aircraft** → camera-lock and follow in real time; tracking togglable off (CAP-10, `vid_rXvU7bPJ8n4 [03:37]/[03:23]`).
- **Click satellite** → draw orbit polyline + red ground track, show altitude card, classify geostationary/geosynchronous (CAP-11, `vid_CHLFl26p7Po [08:16]/[08:20]`).
- **Click vessel** → selection ring + full dossier panel (CAP-13, `vid_ccZzOGnT4Cg [03:27]/[03:47]`).
- **Hover military aircraft** → amber tooltip (UI-13).
- Layer pills / chip bars toggle layers (UI-05, UI-20); city/landmark chips fly the camera (UI-07).

### 6.3 Timeline — UI-17, CAP-38, CAP-39, CAP-40
- Transport: play/pause, draggable playhead over a scrubber studded with color-coded event dots matching the 7-category legend; context sparkline strip (inbound/outbound area chart) beneath (`vid_ccZzOGnT4Cg frame_05/frame_08`).
- Speed preset chips: dashboard shows a `30M/S`–`1D/S` chip range (`vid_ccZzOGnT4Cg frame_05`); narrated speeds include **15 minutes per second** (`vid_0p8o7AeHDzg [06:33]`) and **6 hours per second** time-lapse (`vid_ccZzOGnT4Cg [01:46]`); CAP-39 description spans 1m/s → 2d/s. **[PROPOSAL]** chip enum: `1M/S 5M/S 15M/S 30M/S 1H/S 6H/S 12H/S 1D/S 2D/S`.
- `LIVE | PLAYBACK` segmented toggle top-center (CAP-40, `vid_ccZzOGnT4Cg frame_04/frame_14`); LIVE grays out inside playback lens HUD (UI-24).
- Scrubbing re-slices dependent panels live (oil prices UI-23, crossing counts UI-24).

### 6.4 Camera — UI-18, CAP-46, CAP-45
Auto-orbit at set °/s, FLAT toggle, SPIRAL IN / SPIRAL OUT, distance/pitch/FOV sliders, named target dropdown (observed targets: Kharg Island, Strait of Hormuz — `vid_ccZzOGnT4Cg frame_01/frame_14`). Saved shots via SCENES panel: capture/update/load/delete Shot 1/2/3 (`vid_rXvU7bPJ8n4 [01:24]`).

### 6.5 Voice — UI-29, CAP-48
Bottom-right widget `STOP | LISTENING — Ask or command`; STOP halts listening (`repo-asset:god-view-hero-crt.jpg`). Command grammar beyond the widget is unevidenced — **[PROPOSAL]** route utterances to the same command bus as the search input (fly-to, layer toggle, style switch, timeline seek), Web Speech API first, no cloud STT dependency.

### 6.6 Scenes — UI-19, CAP-42
`SCENE:` dropdown loads a named, date-bounded topic+layer+date-range configuration (e.g. `Iran War Infrastructure | Fixed-Site Strikes - Feb 28 to Mar 27, 2026`, `vid_ccZzOGnT4Cg frame_14`).

---

## 7. Build notes [PROPOSAL — no citations]

- One HUD component tree over the Cesium canvas; every readout in §2 is a subscriber to a single `cameraState`/`clockState` store — no per-widget polling.
- All chrome hideable via the HUD button (UI-08) for clean capture; CLEAN UI clears labels only.
- Number formats above are contracts: write one `fmt.ts` (MGRS via an existing lib, DMS, UTC, SI meters) and a snapshot test of the example strings in §2.
- Keep Google attribution visible over the globe at all times (visible in `repo-asset:god-view-hero-crt.jpg`) — required by tile terms, do not hide it with the HUD toggle.

---

## 8. UI reference table (all 33 IDs)

| ID | Area | One-line spec | Verdict | Primary citation |
|---|---|---|---|---|
| UI-01 | Header wordmark | Globe glyph + `GOD'S EYE`(white)+`VIEW`(cyan), tagline `NO PLACE LEFT BEHIND` | CONFIRMED | `vid_rXvU7bPJ8n4 frame_03`; `repo-asset:god-view-hero-crt.jpg` |
| UI-02 | Classification banner | `TOP SECRET // SI-TK // NOFORN` + `KH11-nnnn OPS-nnnn` + style + auto summary caption | CONFIRMED | `vid_rXvU7bPJ8n4 frame_03`; `repo-asset:god-view-hero-crt.jpg` |
| UI-02b | Deep telemetry HUD block | REC/ORB-PASS/COLL/ONA/MGRS+DMS/GSD-NIIRS/ALT/SUN EL/AIS/BAND-BITS-LVL + `VIS/SRC/DENS/ms` stats strip | CONFIRMED | `repo-asset:god-view-hero-crt.jpg`; `vid_0p8o7AeHDzg frame_03/frame_05` |
| UI-03 | REC / orbit telemetry | Red dot `REC YYYY-MM-DD HH:MM:SSZ` + `ORB: nnnnn PASS: DESC-nnn` + ACTIVE STYLE | CONFIRMED | `vid_rXvU7bPJ8n4 frame_03` |
| UI-04 | MGRS / geolocation | MGRS + DMS lat/lon updating with camera | CONFIRMED | `vid_ccZzOGnT4Cg frame_14/frame_16` |
| UI-05 | DATA LAYERS panel | Layer rows: icon+name+attribution+count badge+ON/OFF pill; 8 evidenced rows | CONFIRMED | `vid_CHLFl26p7Po [08:04]` |
| UI-06 | Style-preset dock | Icon chips Normal/CRT/NVG/FLIR/Anime/Noir+2, chyron `STYLE PRESETS — Visual Modes` | CONFIRMED | `vid_rXvU7bPJ8n4 frame_03`, `montage_004` |
| UI-07 | POI / city chip bars | 8-city chip row + per-city landmark row above dock | CONFIRMED | `vid_rXvU7bPJ8n4 frame_06` |
| UI-08 | Right FX/control panel | BLOOM, SHARPEN %, HUD, LAYOUT `Tactical`, PANOPTIC+checkboxes, CLEAR; DETECT unverified | CONFIRMED (DETECT [SPECULATIVE]) | `vid_0p8o7AeHDzg frame_03/frame_21` |
| UI-09 | CRT parameter card | Pixelation / Distortion / Instability cyan-dot sliders | CONFIRMED | `vid_rXvU7bPJ8n4 frame_19` |
| UI-10 | Scope / CRT vignette | Circular scope mask + scanlines, black surround w/ contour linework | CONFIRMED | `vid_ccZzOGnT4Cg frame_01/frame_19` |
| UI-11 | Entity label formats | `SAT-XXXXX`/`VEH-XXXX` amber mono; preset restyle; cyan/yellow callsigns | CONFIRMED | `vid_rXvU7bPJ8n4 frame_07/14/23`; `repo-asset:god-view-hero-censored.jpg` |
| UI-12 | Satellite tracking card | Catalog name + `7xx km - NORAD nnnnn`; yellow orbit + red ground track | CONFIRMED | `vid_CHLFl26p7Po [08:16]/[08:20]` |
| UI-13 | Military aircraft tooltip | `R47T13 / C303 \| 07-0136 / Operator unknown \| 28000 ft` | CONFIRMED | `vid_rXvU7bPJ8n4 frame_12` |
| UI-14 | Vessel dossier panel | Flag+name+type; ROUTE/RAW AIS/ETA-ATD/SPECS/OWNERSHIP; all-`Unknown` variant | CONFIRMED | `vid_ccZzOGnT4Cg frame_05/frame_09` |
| UI-15 | DARK TRANSIT WATCH | Classification chips + description + UTC range; amber `SEEN AGAIN` marker | CONFIRMED | `vid_ccZzOGnT4Cg frame_11/frame_10` |
| UI-16 | Ground Truth Card | Pill+UTC header, title, media, leader line; strike variant flags/precision/provenance | CONFIRMED | `vid_ccZzOGnT4Cg frame_14/frame_16` |
| UI-17 | Timeline / playback bar | Transport + speed chips + dot scrubber + ms UTC clock + status line + sparkline strip | CONFIRMED | `vid_ccZzOGnT4Cg frame_05/frame_08` |
| UI-18 | Camera control cluster | ORBIT °/s, target ▼, FLAT, SPIRAL IN/OUT, dist/pitch/FOV sliders | CONFIRMED | `vid_ccZzOGnT4Cg frame_14/frame_01` |
| UI-19 | Scene bar & map row | `SCENE: [name ▼]` + `MAP: GOOGLE 3D / AERIAL+LBL / ROAD` | CONFIRMED | `vid_ccZzOGnT4Cg frame_14` |
| UI-20 | Layer chip bar (globe) | 12 pill-chip layer toggles w/ icons + lit-active state | CONFIRMED | `vid_ccZzOGnT4Cg frame_14`; `vid_CHLFl26p7Po [10:16]` |
| UI-21 | Conflict & category legends | Flag conflict-pairs, 7-category event colors, vessel-type legend | CONFIRMED | `vid_0p8o7AeHDzg frame_03/frame_05` |
| UI-22 | 2D analyst dashboard | MAPTHEWORLD.AI brand, metric tabs, chart+lens toggle, ANALYST CONTROLS, RESET VIEW | CONFIRMED | `vid_ccZzOGnT4Cg frame_04/frame_12` |
| UI-23 | Oil risk matrix | Brent/WTI/spread tiles + %Δ + sparklines, scrub-reactive | CONFIRMED | `vid_ccZzOGnT4Cg frame_04/frame_06` |
| UI-24 | Crossing-events lens HUD | Date + N CROSSING/IN/OUT tiles + `DARK TRANSIT: LAYER OFF` + cyan anchor line | CONFIRMED | `vid_ccZzOGnT4Cg frame_03` |
| UI-25 | Selection ring | Cyan/gold dashed ring + heading arrow on focused entity | CONFIRMED | `vid_ccZzOGnT4Cg frame_09/frame_11` |
| UI-26 | Site pins & relation lines | Orange teardrop + teal halo + green label box + dotted orange relations | CONFIRMED | `vid_7HEUCLc7aL8 frame_19/frame_20` |
| UI-27 | Airspace-closure banners | `X AIRSPACE CLOSED` labels; translucent red fills, glowing borders | CONFIRMED | `vid_0p8o7AeHDzg frame_16/08/14/12` |
| UI-28 | Left accordion panels | `+`-expanders: CCTV MESH / DATA LAYERS / MAP STACK / SCENES | CONFIRMED | `repo-asset:god-view-hero-crt.jpg`; `vid_7HEUCLc7aL8 frame_11/frame_21` |
| UI-29 | Voice control widget | `STOP \| LISTENING — Ask or command`, bottom-right | CONFIRMED (verdict absent in evidence JSON; visually verified in repo asset) | `repo-asset:god-view-hero-crt.jpg` |
| UI-30 | Location box & bookmarks | Bottom-center location pill + `LOCATIONS [+]` panel w/ Location/Landmark fields | CONFIRMED | `vid_0p8o7AeHDzg frame_03/frame_04` |
| UI-31 | Theme / typography | Dark canvas, mono all-caps, cyan/amber/red roles, CRT-HUD aesthetic, contour wallpaper | CONFIRMED | `vid_ccZzOGnT4Cg frame_04/frame_14` |
| UI-32 | In-view vessel counter | `VESSELS IN VIEW: 3,842 / 9,431` + per-type rows + first-transits line | CONFIRMED | `vid_ccZzOGnT4Cg frame_01` |
