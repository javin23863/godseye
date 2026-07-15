export interface LayerState { box: HTMLInputElement; checked: boolean }

/** Apply one presentation state without changing the Cesium viewer. */
export function applyPresentationState(presentation: string | undefined, cleanUi: boolean): void {
  if (presentation) document.body.dataset.presentation = presentation
  else delete document.body.dataset.presentation
  document.body.classList.toggle('clean-ui', presentation === 'story' || cleanUi)
  document.getElementById('story-overlay')?.setAttribute('aria-hidden', String(presentation !== 'story'))
}

export function updateStoryOverlayView(observedAt: string, context: string, sourceLabels: string[]): void {
  const observed = document.getElementById('story-observed')
  if (observed) observed.textContent = observedAt.replace('.000Z', 'Z')
  const contextElement = document.getElementById('story-context')
  if (contextElement) contextElement.textContent = context
  const list = document.getElementById('story-source-list')
  if (!list) return
  list.replaceChildren(...sourceLabels.map((label) => {
    const item = document.createElement('b')
    item.textContent = label
    return item
  }))
  if (!sourceLabels.length) list.textContent = 'NO ACTIVE REGISTERED SOURCES'
}

export function captureLayerState(): LayerState[] {
  return [...document.querySelectorAll<HTMLInputElement>('#layers label.layer-row input[type=checkbox]')]
    .map((box) => ({ box, checked: box.checked }))
}

/** Keep one primary signal plus at most three supporting signals. */
export function focusStoryLayers(preferredLabels: string[] = []): number {
  const rows = [...document.querySelectorAll<HTMLLabelElement>('#layers label.layer-row')]
    .map((row) => ({ row, box: row.querySelector<HTMLInputElement>('input[type=checkbox]') }))
    .filter((entry): entry is { row: HTMLLabelElement; box: HTMLInputElement } => Boolean(entry.box?.checked))
  const preferred = new Map(preferredLabels.map((label, index) => [label, index]))
  rows.sort((left, right) =>
    (preferred.get(left.row.dataset.layer ?? '') ?? Number.MAX_SAFE_INTEGER) -
    (preferred.get(right.row.dataset.layer ?? '') ?? Number.MAX_SAFE_INTEGER))
  const keep = new Set(rows.slice(0, 4).map(({ box }) => box))
  for (const { box } of rows) if (!keep.has(box)) box.click()
  return Math.max(0, rows.length - keep.size)
}

export function restoreLayerState(state: LayerState[]): void {
  for (const { box, checked } of state) if (box.checked !== checked) box.click()
}
