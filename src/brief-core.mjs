// One-click sourced brief — pure core (no DOM, no cesium, no fetch). Turns the current
// "picture" (active layers + salient events + a time-window label) into a compact analyst
// prompt the LLM seam narrates, and maps the active layer ids to their provenance badges.
// The DOM/LLM/clipboard shell lives in brief.ts; this file is headless-tested.
import { describeSources } from './sources.ts'

/**
 * @typedef {{ key: string, label: string, count: number }} ActiveLayer
 * @typedef {{ kind: string, text: string }} BriefEvent
 * @typedef {{ activeLayers: ActiveLayer[], events: BriefEvent[], windowLabel: string }} Picture
 */

/**
 * Turn the picture into a compact analyst-brief LLM prompt: a terse situation-report ask
 * that embeds every active layer's count and every event's text so the model narrates only
 * what's actually on screen (no hallucinated feeds).
 * @param {Picture} picture
 * @returns {string}
 */
export function buildBriefPrompt(picture) {
  const layers = picture.activeLayers.length
    ? picture.activeLayers.map((l) => `${l.label} ${l.count}`).join(', ')
    : 'none active'
  const events = picture.events.length
    ? picture.events.map((e) => `- ${e.kind}: ${e.text}`).join('\n')
    : '- none flagged'
  return [
    `GOD'S EYE situation brief. Observation window: ${picture.windowLabel}.`,
    `Active layers (with live counts): ${layers}.`,
    `Salient events:`,
    events,
    ``,
    `Write a short SOURCED situation report (3-4 sentences) covering only the layers and`,
    `events above. Lead with the most significant signal. Do not invent counts or feeds.`,
  ].join('\n')
}

/**
 * Credibility badges for the active layers — provider · freshness · limits per source,
 * url dropped. Unknown keys are silently filtered (delegates to the sources registry).
 * @param {string[]} activeKeys
 * @returns {import('./sources.ts').SourceBadge[]}
 */
export function briefBadges(activeKeys) {
  return describeSources(activeKeys)
}
