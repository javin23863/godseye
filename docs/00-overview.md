# godseye — Program Overview

## What God's Eye View is

**God's Eye View** (in-app brand "WORLDVIEW" in every captured UI frame; renamed for release — STK-07) is a browser-based geospatial OSINT command center built by Bilawal Sidhu, an ex-Google Maps/XR PM, in roughly a weekend of AI-agent-driven "vibe coding" (STK-04, STK-08, `vid_rXvU7bPJ8n4 [08:40]`, https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator). It renders Google Photorealistic 3D Tiles on a CesiumJS globe (STK-01, STK-02, `repo-asset:god-view-hero-crt.jpg`) and fuses live public feeds — commercial and military ADS-B flights, AIS ship tracking with dark-vessel detection, satellite orbits, earthquakes, GPS-jamming hex tiles, public CCTV, NOAA NEXRAD weather — into toggleable layers (CAP-07..29) with 4D timeline playback of reconstructed events (CAP-38..41), sensor-style GLSL shader presets (CRT/NVG/FLIR/anime — CAP-04, STK-05), AI scene analysis (CAP-49..52), and a voice-command widget (CAP-48 [SPECULATIVE — evidenced only by `repo-asset:god-view-hero-crt.jpg`, no verify verdict]). It runs entirely in a browser tab with no public hosted instance (CAP-57, STK-09).

## What THIS repo is

A working independent implementation plus the evidence-backed blueprint used to build it. The upstream inspiration was closed-source when research began, so the specification was reverse-engineered from public evidence and adversarially verified before implementation. Docs 01–07 preserve provenance and design rationale; the application code is the current product truth. Constraint carried through every doc and the implementation: **all feeds are public/open data — no scraping of private data, no auth bypass, no ToS-violating access.**

## Evidence base

| Source | ID / location | Notes |
|---|---|---|
| Video: WorldView build/demo ("vibe coded Palantir") — *working title* | `vid_rXvU7bPJ8n4` | Original WorldView launch demo; layers, shaders, build workflow |
| Video: Iran strikes 4D reconstruction ("Operation Epic Fury") — *working title* | `vid_0p8o7AeHDzg` | 4D Iran-strikes reconstruction; timeline playback |
| Video: Ceasefire follow-up (first "God's eye view" usage) — *working title* | `vid_7HEUCLc7aL8` | Ceasefire analysis; basemap switching, analyst presets |
| Video: Palantir / Maven Smart System explainer — *working title* | `vid_CHLFl26p7Po` | Palantir framing; app comparison segments |
| Video: Strait of Hormuz maritime episode — *working title* | `vid_ccZzOGnT4Cg` | Strait of Hormuz; chokepoints, dark vessels, oil risk matrix |

YouTube titles were not archived verbatim; working titles are derived from content (see `07-session-notes.md` §2).
| Repo assets | `repo-asset:god-view-hero-crt.jpg`, `repo-asset:god-view-hero-censored.jpg` | Hero UI screenshots from `bilawalsidhu/gods-eye-view`; Cesium ion + Google Maps Data credit bar visible |
| Web sweep | Sidhu newsletter (spatialintelligence.ai), Threads, X, community clones (`jedijamez567/worldview_oss`, `noaRoblesLevy/GodsEye`), Cesium blog | Corroboration + stack triangulation |

Each video directory also holds `transcript.txt`, `frame_NN.png`, and `montage_NNN.png` stills (cite, rarely re-read).

**Verification stats:** 125 canonical spec claims (57 CAP + 22 DS + 33 UI + 13 STK) went through an adversarial verify pass: **122 CONFIRMED, 1 WRONG, 2 unverdicted.**

- The 1 WRONG: DS-09's original "weather provider never named" text — the UI in fact names **NOAA NEXRAD (globe overlay)**; treat NOAA NEXRAD as the evidenced provider.
- The 2 unverdicted (CAP-48 voice command, UI-29 voice widget) are evidenced by `repo-asset:god-view-hero-crt.jpg` but skipped by the verify pass; per program rules they carry **[SPECULATIVE]** tags wherever cited.

## Doc map

| Doc | Contents |
|---|---|
| `01-functional-spec.md` | The 57 capabilities (CAP-01..57): globe, layers, timeline, shaders, AI, camera + acceptance criteria |
| `02-architecture.md` | Evidenced stack conclusions (STK-xx table) + proposed rebuild architecture, design decisions, work packages |
| `03-data-sources.md` | The data-source catalog: 22 verified sources (DS-01..22) + 2 new rows from gap findings (DS-23/24) |
| `04-ui-spec.md` | The 33 UI spec points (UI-01..32 + UI-02b): panels, HUD, hotkeys, widgets, layout themes |
| `05-improvements.md` | Observed limitations of the original (L-01..27) + the 25-item ranked improvement backlog (B-01..25) |
| `06-roadmap.md` | Milestoned build plan M0–M6+ with risk register (proposal, not evidence) |
| `07-session-notes.md` | Evidence log: methodology, per-video notes, verification summary, 30 open questions, 13 remaining gaps, 4 gap-fill findings |

## Citation format (used across all docs)

| Form | Meaning | Example |
|---|---|---|
| `vid_<id> [MM:SS]` | Transcript timestamp in that video | `vid_rXvU7bPJ8n4 [03:15]` |
| `vid_<id> frame_NN` / `montage_NNN` | Extracted still / montage tile from that video | `vid_7HEUCLc7aL8 frame_11` |
| `repo-asset:<file>` | Image from the `bilawalsidhu/gods-eye-view` GitHub repo | `repo-asset:god-view-hero-crt.jpg` |
| Bare URL | Web-sweep source (newsletter, clone repo, blog) | `https://www.spatialintelligence.ai/p/i-built-a-spy-satellite-simulator` |
| `CAP-xx` / `DS-xx` / `UI-xx` / `STK-xx` | Canonical cross-reference into docs 01–04 | `CAP-14`, `DS-09` |
| `[SPECULATIVE]` | Claim about the original app not CONFIRMED by the verify pass | — |
| *(proposal)* | Our design decision for the rebuild; needs no citation | — |

Rule: every factual claim about the **original** app carries a citation; anything not CONFIRMED is tagged `[SPECULATIVE]`; rebuild design choices are marked *(proposal)*.
