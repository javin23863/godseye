# 08 — Temporal Evidence and Story Mode

- **Status:** Implemented and browser-verified closeout; v1 contract and visual language frozen
- **Owner:** javin23863
- **Repository:** `javin23863/godseye`
- **Last updated:** 2026-07-15
- **Contract PR #1:** Merged to `main` at `f292d883de43d893ea7381c481e8e334fcac6400` on 2026-07-15
- **Policy/plan PR #2:** Merged to `main` at `f4b85e2db1a72f10a705fc1dc23b3f5f54d620ef` on 2026-07-15
- **Related contract branch (merged):** `agent/scene-evidence-automation-v1`

## Purpose

Godseye is an independent real-time geospatial evidence and storytelling application. “God's Eye View” refers only to the attributed upstream inspiration documented in `00-overview.md`; the project name is **Godseye**.

Docs 00–07 preserve the reconstruction evidence and original parity roadmap. This closeout governs the final Godseye v1 direction: make time, source provenance, and uncertainty visible instead of adding more generic tactical decoration. Godseye is now a 6–15 second evidence cutaway inside the wider TraderCockpit editorial experience; Analyst mode remains the maximal command center.

Godseye does not adopt Apollo's organic intelligence identity. TraderCockpit may use Godseye footage and versioned evidence packets, but the repositories, installations, interfaces, and brands remain separate.

## Design principle

**Temporal evidence, not tactical theater.**

The current cyan/amber HUD, scanlines, bloom, reticles, and sensor filters resemble a familiar command-center genre because parity was the original goal. Story mode should be distinctive because its visual behavior explains evidence:

- What was observed?
- When was it observed?
- Which registered source produced it?
- How fresh and certain is it?
- What changed?
- Which relationships are observations and which are inferences?

No effect exists only to make the frame look classified, futuristic, or busy.

## Product boundaries

| Owner | Responsibility |
|---|---|
| Godseye | Cesium viewer, layers, basemaps, source registry, scene-state v2, evidence-packet/v1, visual readiness, MediaRecorder, semantic action mapping |
| TraderCockpit | CDP connection, shot schedule, captions, base64 chunk files, FFmpeg transcoding, platform edit, publishing approval |
| Future consumer product | Optional sanitized evidence-packet/v1 consumption after `product-manifest/v1` verifies `godseye-evidence/v1` |

Godseye does not expose DOM selectors, `window.__viewer`, Cesium objects, presets, or layer lookup to callers. `window.godseyeAutomationV1` remains the sole supported browser boundary. No headless CLI is planned until real demand proves it necessary.

## Dual presentation modes

### Analyst mode

Analyst mode preserves the operational surface and all existing layer behavior. Its visual cleanup is progressive:

- Replace the permanently expanded checkbox rail with a searchable layer command surface.
- Group layers by evidence domain and reveal advanced controls contextually.
- Keep counts, attribution, freshness, saved scenes, and search available.
- Keep existing sensor presets for analysts, with honest labels where a style is not real sensor data.
- Preserve keyboard and saved-shot workflows while the new controls are measured.

The current controls remain available until their replacements pass the same workflows. This phase is a simplification, not a rewrite.

### Story mode

Story mode replaces OPS-WALL as the capture surface. It hides analyst chrome and presents one evidence-led narrative on the existing viewer.

A story contains:

- One primary event or area of interest.
- At most three supporting signals.
- Registered source labels and observation times.
- A restrained evidence summary inside the protected overlay area.
- No unrelated global layer clutter.

Story mode does not create claims. It visualizes the scene and the claims supplied to `finish`, then returns the validated evidence packet.

## Temporal-evidence visual language

| Meaning | Visual behavior |
|---|---|
| Sourced observation | Solid mark using the source's semantic color, with an observation-time affordance |
| Inference | Outlined or dashed relationship, explicitly labeled as inference |
| Freshness | Timestamp plus restrained decay or wake length; never color alone |
| Uncertainty | Spatial extent, soft boundary, or range band showing where uncertainty exists |
| Time-ordered movement | Directional trail built only from recorded samples |
| Static relationship | Non-animated connection; no false direction or causality |
| Source-to-claim provenance | Short evidence thread from the active source signal to the claim card |
| Warning | Plain-language notice carried into evidence-packet/v1 |

Before/during/after states appear only when recorded observations support all displayed states. If history is unavailable, Story mode shows current observation time and source freshness instead of inventing a rewind.

Story mode defaults to cinematic Earth imagery with restrained bloom and no scanlines, fake targeting marks, or decorative alert text. Existing styles remain available in Analyst mode.

Story evidence chrome may use a restrained proportional sans face for legibility in compressed social video. Analyst controls, source data, timestamps, and reconstructed upstream surfaces retain the established monospace system; this exception does not restyle Analyst mode.

## Story choreography

TraderCockpit owns story selection, captions, market interpretation, audio, editing, and publishing. Godseye implements the **Signal → Exposure → Proof** cutaway through the existing `begin → finish → drain` lifecycle:

1. **Signal / Context — 1.5–3s:** settle the camera, show the primary observation and its first registered source, and suppress inherited Analyst clutter.
2. **Exposure / Reveal — 3–7s:** after readiness passes, run one 800ms source-lock pulse and reveal no more than three supporting sources in the explicit action order.
3. **Proof / Resolve — 2–5s:** hold the observation time, freshness/provenance, and stable evidence frame for at least 1.5s. Show recorded change only when history exists; otherwise show freshness instead of fabricating a rewind.

The implemented default holds Signal for 1.6s, runs the sub-second reveal, and leaves the remaining 6–15 second clip stable for Proof. Reduced motion removes the pulse and snaps directly to the complete evidence state. The camera moves because narrative scale changes, not merely to keep the globe moving.

## One dual-safe composition

Story mode uses one responsive layout for landscape and vertical production:

- Keep the primary event inside the central region shared by 16:9 and 9:16 crops.
- Reserve the lower caption band for TraderCockpit; Godseye does not burn captions into the recording.
- Keep source, time, and warning cards inside measured CSS safe areas.
- Move or collapse supporting evidence when the viewport becomes vertical.
- Limit simultaneous supporting signals instead of shrinking labels below readability.

The capture smoke test runs both aspect ratios against the same scene request.

## Automation contract extension

The existing `godseye-automation/v1` schema and four operations remain unchanged. Extensions are additive.

### `status`

Add:

```json
{
  "presentations": ["analyst", "story"]
}
```

Existing `ready`, `recording`, and lifecycle `phase` fields remain.

### `begin`

Add one optional request field:

```json
{
  "presentation": "analyst"
}
```

Allowed values are `analyst` and `story`; omission preserves current Analyst behavior. Unknown values fail validation before touching the viewer or UI.

After actions, camera movement, and settling, Story mode evaluates the frame before recording. The successful response adds:

```json
{
  "presentation": "story",
  "readiness": {
    "ready": true,
    "fallbackApplied": false,
    "checks": {
      "camera": "pass",
      "tiles": "pass",
      "sources": "pass",
      "overlays": "pass",
      "contrast": "pass"
    },
    "warnings": []
  }
}
```

Checks use `pass`, `warn`, or `fail` so warnings remain distinguishable from blocking errors.

- **Camera:** target coordinates are valid, the camera is above the ellipsoid/terrain, and the globe occupies a usable part of the frame.
- **Tiles:** the scene has rendered and globe/tiles are ready within the settle window. Remote imagery receives a bounded wait, then the bundled Natural Earth layer is used. After the strict wait, rendered coverage with no high-priority gaps may proceed as an explicit refinement warning; an unrendered frame still fails.
- **Sources:** at least one active Story signal maps to the registered source catalog; unregistered active layers warn.
- **Overlays:** required Story elements are visible and inside the current viewport's safe areas.
- **Contrast:** a sparse sample of the rendered Cesium framebuffer is neither effectively blank nor dominated by clipped luminance.

On camera or contrast failure, apply one deterministic fallback: preserve longitude/latitude, heading, and the requested pitch, stop orbit, and raise the camera to a safe contextual height between 2,500km and 8,000km. Re-render and run the checks again. Record `fallbackApplied: true` and the reason as a warning.

If the fallback still fails a blocking check, reject `begin` before MediaRecorder starts. The lifecycle remains idle.

### `finish`

The response remains:

```json
{
  "scene": { "v": 2 },
  "evidence": { "schema": "evidence-packet/v1" }
}
```

Readiness and fallback warnings are merged with caller warnings into `evidence-packet/v1`. Claims still reference only sources active in the captured scene. `finish` stops recording/orbit before capturing scene-state v2.

### `drain`

No change. Return the next base64 chunk or `null`; the lifecycle returns to idle after the terminal `null`.

## Implemented closeout

- `window.godseyeAutomationV1` remains the sole caller boundary; omitted `presentation` remains Analyst-compatible.
- Story uses DUSK Earth imagery, restrained bloom, no Analyst chrome, no optional basemap-label clutter, one primary layer, and at most three supports.
- Explicit semantic action order defines primary/support source order in the overlay, scene-state v2, and evidence-packet/v1.
- Story snapshots and restores presentation, clean UI, layers, style, basemap imagery visibility, bloom, sharpen, pixelate, resolution, globe/tileset quality, globe lighting, and manual orbit on success, begin failure, evidence failure/cancellation, and terminal drain.
- Every layer used by the three proof archetypes has registered provenance. Missing history remains a freshness warning; no rewind is synthesized.
- The Story composite uses a preserved WebGL frame plus a manual 32Hz canvas-track loop, producing measured output above 30fps without changing the public schema.
- Keyless SHIPS remains an honest zero-count, addressable evidence layer. Bundled Natural Earth prevents remote imagery failure from becoming a blank capture.
- No feed, viewer, rendering framework, archive, SAR path, worker parser, CCTV completion, or briefing schema was added.

All M6+ capability expansion is explicitly deferred. Further editorial, market, caption, audio, distribution, and performance-comparison work belongs in TraderCockpit or post-release measurement—not in Godseye v1.

## Verification

### Closeout commands

```sh
npm test
npm run build
npm run verify:story -- http://127.0.0.1:4321
node scripts/verify-newsint.mjs http://127.0.0.1:4321
node scripts/verify-visuals.mjs http://127.0.0.1:4321
```

Verified on 2026-07-15 against local Vite/Edge:

- `npm test`: **182/182 pass**.
- `npm run build`: TypeScript and Vite production build pass.
- `verify:story`: **3 archetypes × 2 aspects pass**, including invalid-frame rejection, camera fallback, cancellation/completion restoration, source/order agreement, crop safety, reduced motion, no Analyst chrome, and no page errors.
- Official landscape WebM receipts: geopolitical **6.160s / 199 frames / 32.17fps**; natural disaster **6.180s / 199 frames / 32.04fps**; airspace/security **6.180s / 197 frames / 31.73fps**.
- `verify-newsint`: pass with 16 zones, 38 feed rows, 1,500 fire detections, 40 weather alerts, 4 outage signals, 5 financial instruments, and a 45-character grounded/fallback region report.
- `verify-visuals` passed on 2026-07-15 with `rings=27`, `trails=73`, and `VISUALS VERIFY OK`; screenshots are in `artifacts/story-closeout-20260715`.

Generated local artifacts and the machine-readable `godseye-story-verification/v1` receipt are in `artifacts/story-closeout-20260715/` (gitignored). The set contains three official 1920×1080 clips, one Signal/Exposure/Proof still per archetype, one 1080×1920 reduced-motion proof still per archetype, and the news regression screenshot.

### Contract tests

- Reject unknown presentation values before handlers run.
- Preserve omitted-presentation behavior.
- Preserve lifecycle ordering for status, begin, finish, and drain.
- Return readiness fields from a successful Story begin.
- Merge readiness warnings into evidence-packet/v1.
- Keep chunks drainable after finish validation failure.

### Visual and browser tests

- Capture the same representative scene at 1920×1080 and 1080×1920.
- Confirm the primary event stays inside the shared safe region.
- Confirm captions have a reserved band and evidence cards are not clipped.
- Confirm a deliberately unsafe camera uses the fallback.
- Confirm a still-invalid or blank fallback rejects begin before recording.
- Confirm reduced-motion Analyst UI remains usable; capture automation may request explicit motion.

### Regression checks

- Existing Analyst layer toggles, presets, search, camera, scenes, and keyboard workflows remain functional.
- Existing automation callers without `presentation` continue to work.
- Scene-state v1 decoding remains permissive while v2 stays the write format.
- Evidence claims continue to validate against sources active in the captured scene.
- Production tests and build pass, followed by one real CDP capture smoke test when the application is available.

## Acceptance criteria

- Analyst and Story modes are visibly and behaviorally distinct.
- Story mode contains one primary event and no more than three supporting signals.
- No displayed history, direction, causality, or confidence is fabricated.
- Every claim is traceable to active registered sources or produces a warning.
- Both target aspect ratios remain readable from one scene request.
- No accepted capture is underground, featureless, tile-unready, overexposed, or outside safe areas.
- TraderCockpit performs no Godseye DOM or Cesium interpretation.
- Godseye adds no headless CLI, second viewer, or borrowed dependency.

## Measurement

Compare Godseye clips with topic-matched non-Godseye clips using first-three-second hold, average watch time, completion, saves, and shares. Raw views alone do not prove the visual system caused better performance. Keep, revise, or remove Story treatments based on repeated evidence rather than claims that a design is unprecedented or viral.
