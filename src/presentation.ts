export interface LayerState { box: HTMLInputElement; checked: boolean }

/** Apply one presentation state without changing the Cesium viewer. */
export function applyPresentationState(presentation: string | undefined, cleanUi: boolean): void {
  if (presentation) document.body.dataset.presentation = presentation
  else delete document.body.dataset.presentation
  document.body.classList.toggle('clean-ui', presentation === 'story' || cleanUi)
  const overlay = document.getElementById('story-overlay')
  overlay?.setAttribute('aria-hidden', String(presentation !== 'story'))
  if (presentation !== 'story') overlay?.classList.remove('story-locked')
}

export function updateStoryOverlayView(observedAt: string, context: string, sourceLabels: string[]): void {
  const observed = document.getElementById('story-observed')
  if (observed) observed.textContent = observedAt.replace('.000Z', 'Z')
  const contextElement = document.getElementById('story-context')
  if (contextElement) contextElement.textContent = context
  const list = document.getElementById('story-source-list')
  if (!list) return
  list.replaceChildren(...sourceLabels.map((label, index) => {
    const item = document.createElement('b')
    item.textContent = label
    item.style.setProperty('--source-index', String(index))
    return item
  }))
  if (!sourceLabels.length) list.textContent = 'NO ACTIVE REGISTERED SOURCES'
}

/** Restart the one-shot evidence-lock treatment after Story readiness passes. */
export function lockStoryOverlay(): void {
  const overlay = document.getElementById('story-overlay')
  if (!overlay) return
  overlay.classList.remove('story-locked')
  void overlay.offsetWidth
  overlay.classList.add('story-locked')
}

export function captureLayerState(): LayerState[] {
  return [...document.querySelectorAll<HTMLInputElement>('#layers label.layer-row input[type=checkbox]')]
    .map((box) => ({ box, checked: box.checked }))
}

/** Explicit Story order wins; without one, retain the first four active layers. */
export function orderedStoryLabels(activeLabels: string[], preferredLabels: string[] = []): string[] {
  const active = new Set(activeLabels)
  const preferred = [...new Set(preferredLabels)].filter((label) => active.has(label)).slice(0, 4)
  return preferred.length ? preferred : activeLabels.slice(0, 4)
}

/** Keep one primary signal plus at most three supporting signals. */
export function focusStoryLayers(preferredLabels: string[] = []): number {
  const rows = [...document.querySelectorAll<HTMLLabelElement>('#layers label.layer-row')]
    .map((row) => ({ row, box: row.querySelector<HTMLInputElement>('input[type=checkbox]') }))
    .filter((entry): entry is { row: HTMLLabelElement; box: HTMLInputElement } => Boolean(entry.box?.checked))
  const keepLabels = new Set(orderedStoryLabels(rows.map(({ row }) => row.dataset.layer ?? ''), preferredLabels))
  const keep = new Set(rows.filter(({ row }) => keepLabels.has(row.dataset.layer ?? '')).map(({ box }) => box))
  for (const { box } of rows) if (!keep.has(box)) box.click()
  return Math.max(0, rows.length - keep.size)
}

export function restoreLayerState(state: LayerState[]): void {
  for (const { box, checked } of state) if (box.checked !== checked) box.click()
}
