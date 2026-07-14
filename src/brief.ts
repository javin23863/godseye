// One-click SOURCED BRIEF (the "turn the picture into defensible intel" action): a BRIEF
// button folds the current picture into an analyst prompt, asks the LLM seam to narrate a
// short situation report, and renders #brief-panel with that narrative + a credibility badge
// per active source (provider · freshness · limits) + a COPY MD button. With no LLM key
// (llmAsk -> "" / null) it falls back to a deterministic template brief so the button always
// produces intel. Prompt-building + badge selection are pure (brief-core.mjs); this file is
// only the DOM + LLM + clipboard shell.
import { buildBriefPrompt, briefBadges } from './brief-core.mjs'
import { llmAsk } from './llm'
import type { SourceBadge } from './sources'

interface ActiveLayer {
  key: string
  label: string
  count: number
}
interface BriefEvent {
  kind: string
  text: string
}
interface Picture {
  activeLayers: ActiveLayer[]
  events: BriefEvent[]
  windowLabel: string
}

export interface BriefOpts {
  /** Snapshot of what's on screen right now (built by the caller). */
  picture(): Picture
}

export function init(opts: BriefOpts): void {
  const btn = document.createElement('button')
  btn.id = 'brief-btn'
  btn.textContent = 'BRIEF'
  btn.title = 'one-click sourced situation report'
  document.body.appendChild(btn)

  const panel = document.createElement('div')
  panel.id = 'brief-panel'
  panel.style.display = 'none'
  document.body.appendChild(panel)

  btn.onclick = async () => {
    const picture = opts.picture()
    const badges = briefBadges(picture.activeLayers.map((l) => l.key))
    btn.disabled = true
    render(panel, 'CORRELATING PICTURE…', badges, '', picture)
    // llmAsk narrates; degrades to a deterministic template when there's no key (returns "").
    const answer = (await llmAsk(buildBriefPrompt(picture), '')) || ''
    const narrative = answer || templateBrief(picture)
    render(panel, narrative, badges, markdown(narrative, badges), picture)
    btn.disabled = false
  }
}

/** Deterministic brief when the LLM is unavailable — assembled straight from the picture. */
function templateBrief(p: Picture): string {
  const layers = p.activeLayers.length
    ? p.activeLayers.map((l) => `${l.label} ${l.count}`).join(', ')
    : 'no active layers'
  const events = p.events.length ? p.events.map((e) => e.text).join('; ') : 'no flagged events'
  return `SITUATION (${p.windowLabel}): ${layers}. FLAGGED: ${events}.`
}

/** Brief as copyable markdown: the narrative + a Sources section citing each active feed. */
function markdown(narrative: string, badges: SourceBadge[]): string {
  const sources = badges.length
    ? badges.map((b) => `- **${b.label}** — ${b.provider} · ${b.freshness} · ${b.limits}`).join('\n')
    : '- (no active sources)'
  return `# GODSEYE BRIEF\n\n${narrative}\n\n## Sources\n\n${sources}\n`
}

function render(panel: HTMLElement, narrative: string, badges: SourceBadge[], md: string, _p: Picture): void {
  panel.innerHTML = `
    <h3>SOURCED BRIEF</h3>
    <div class="brief-narr">${escapeHtml(narrative)}</div>
    <div class="brief-src-h">SOURCES · ${badges.length}</div>
    <div class="brief-badges">${badges.map(badgeHtml).join('') || '<div class="brief-empty">NO ACTIVE SOURCES</div>'}</div>
    <button class="brief-copy">COPY MD</button>`
  panel.style.display = 'block'

  const copy = panel.querySelector('.brief-copy') as HTMLButtonElement
  copy.disabled = !md
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(md)
      copy.textContent = 'COPIED ✓'
    } catch (e) {
      console.warn('brief copy failed:', e)
      copy.textContent = 'COPY FAILED'
    }
    window.setTimeout(() => (copy.textContent = 'COPY MD'), 1500)
  }
}

/** One credibility badge: label + provider · freshness · limits (all four verbatim from the registry). */
function badgeHtml(b: SourceBadge): string {
  return `<div class="brief-badge">
    <div class="brief-badge-l">${escapeHtml(b.label)}</div>
    <div class="brief-badge-m">${escapeHtml(b.provider)} · ${escapeHtml(b.freshness)}</div>
    <div class="brief-badge-lim">${escapeHtml(b.limits)}</div>
  </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
