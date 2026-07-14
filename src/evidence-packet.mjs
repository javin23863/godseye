// Portable evidence handoff for media and product integrations. The packet records the
// captured v2 scene, full source provenance (including URLs), and only claims tied to
// sources active in that scene. Pure data; capture/transport stay outside this module.
import { sourceFor } from './sources.ts'
import { isSceneStateV2 } from './scene-state-codec.mjs'

/**
 * @typedef {{text:string, kind:'observation'|'inference', sourceKeys:string[]}} EvidenceClaim
 * @typedef {{name:string, uri:string, mediaType?:string}} EvidenceArtifact
 * @typedef {{
 *   scene: import('./scene-state-codec.mjs').SceneStateV2,
 *   claims?: EvidenceClaim[],
 *   artifacts?: EvidenceArtifact[],
 *   warnings?: string[]
 * }} EvidenceInput
 */

/** Build an evidence-packet/v1 from a captured scene. @param {EvidenceInput} input */
export function createEvidencePacket(input) {
  const { scene, claims = [], artifacts = [], warnings = [] } = input
  if (!isSceneStateV2(scene)) {
    throw new TypeError('evidence-packet/v1 requires a valid scene-state v2')
  }
  if (!Array.isArray(claims) || !Array.isArray(artifacts) ||
      !Array.isArray(warnings) || warnings.some((warning) => typeof warning !== 'string')) {
    throw new TypeError('claims, artifacts, and warnings must be arrays')
  }
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.name !== 'string' || !artifact.name.trim() ||
        typeof artifact.uri !== 'string' || !artifact.uri.trim() ||
        (artifact.mediaType !== undefined && typeof artifact.mediaType !== 'string')) {
      throw new TypeError('each evidence artifact needs name, uri, and optional mediaType strings')
    }
  }

  const layerKeys = [...new Set(scene.layers ?? [])]
  const sources = []
  const missing = []
  for (const key of layerKeys) {
    const source = sourceFor(key)
    if (source) sources.push({ key, ...source })
    else missing.push(key)
  }

  const usable = new Set(sources.map((source) => source.key))
  for (const claim of claims) {
    if (!claim || typeof claim.text !== 'string' || !claim.text.trim() ||
        !['observation', 'inference'].includes(claim.kind) ||
        !Array.isArray(claim.sourceKeys) || !claim.sourceKeys.length ||
        claim.sourceKeys.some((key) => typeof key !== 'string')) {
      throw new TypeError('each evidence claim needs text, kind, and at least one source key')
    }
    const unsupported = claim.sourceKeys.filter((key) => !usable.has(key))
    if (unsupported.length) throw new TypeError(`claim cites source outside captured scene: ${unsupported.join(', ')}`)
  }

  return {
    schema: 'evidence-packet/v1',
    observedAt: scene.observedAt,
    scene,
    sources,
    claims,
    artifacts,
    warnings: [...warnings, ...missing.map((key) => `No provenance registered for active layer: ${key}`)],
    producer: { name: 'godseye', version: 1 },
  }
}
