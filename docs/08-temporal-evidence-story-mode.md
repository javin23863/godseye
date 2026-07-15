# 08 — Temporal Evidence and Story Mode

- **Status:** Proposed; Story mode is not merged
- **Owner:** javin23863
- **Repository:** `javin23863/godseye`
- **Last updated:** 2026-07-15
- **Contract PR #1:** Merged to `main` at `f292d883de43d893ea7381c481e8e334fcac6400` on 2026-07-15
- **Related contract branch (merged):** `agent/scene-evidence-automation-v1`
- **Next step:** Review this policy/plan PR; Story mode remains the proposed follow-on.

## Purpose

Godseye is an independent real-time geospatial evidence and storytelling application. “God's Eye View” refers only to the attributed upstream inspiration documented in `00-overview.md`; the project name is **Godseye**.

Docs 00–07 preserve the reconstruction evidence and original parity roadmap. This proposal governs the next visual direction: make time, source provenance, and uncertainty visible instead of adding more generic tactical decoration.

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

TraderCockpit continues to own shot timing. Godseye supplies five semantic visual phases that existing shot lists can compose with action tokens:

1. **Context:** establish the location and scale.
2. **Reveal:** introduce the primary observed signal and source.
3. **Focus:** approach the event while suppressing unrelated layers.
4. **Compare:** show real temporal change or supporting signals when available.
5. **Resolve:** hold a readable scene for the evidence summary and edit transition.

The camera moves because the narrative scale changes, not simply to keep the globe moving. Orbit is restrained during evidence reading and stops before final capture if it harms label stability.

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
- **Tiles:** the scene has rendered and globe/tiles are ready within the settle window.
- **Sources:** at least one active Story signal maps to the registered source catalog; unregistered active layers warn.
- **Overlays:** required Story elements are visible and inside the current viewport's safe areas.
- **Contrast:** a downscaled sample from the recording canvas is neither effectively blank nor dominated by clipped luminance.

On camera or contrast failure, apply one deterministic fallback: preserve longitude/latitude and heading, use pitch `-45`, stop orbit, and raise the camera to a safe contextual height. Re-render and run the checks once more. Record `fallbackApplied: true` and the reason as a warning.

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

## Delivery order

1. Record the merged contract and automation baseline from Godseye PR #1 at `f292d883de43d893ea7381c481e8e334fcac6400` on `main`.
2. Review and merge this policy/plan; Story mode remains proposed.
3. Add `presentation` validation and additive status/begin response fields with focused tests.
4. Build the minimal Story chrome and dual-safe CSS on the existing viewer.
5. Add readiness checks and one deterministic fallback.
6. Prototype Context → Reveal → Focus → Compare → Resolve with three representative real events.
7. Connect TraderCockpit's existing shot lists through semantic actions only.
8. Simplify Analyst mode after Story capture is stable.

No new rendering framework or duplicate viewer is introduced. A direct `deploy` instruction invokes the Luna workflow in `AGENTS.md`; the primary agent remains responsible for implementation and approval.

## Verification

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
