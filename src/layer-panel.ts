// DATA LAYERS panel rows: checkbox + name + live count (CAP-07 minimal shape)
// + per-row SOLO isolation (CAP-30: "isolate all the military planes").
export interface PanelLayer {
  shown: boolean
}

const rows: { layer: PanelLayer; box: HTMLInputElement }[] = []

export function addLayerRow(
  name: string,
  layer: PanelLayer,
  opts?: { noCount?: boolean; onDemand?: boolean },
): (count: number) => void {
  const layersDiv = document.getElementById('layers')!
  const label = document.createElement('label')
  label.className = 'layer-row'
  label.dataset.layer = name
  if (opts?.onDemand) label.dataset.onDemand = 'true' // populates on user action / slow stream — verify won't require >0
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = layer.shown
  label.append(box, ` ${name} `)

  const solo = document.createElement('button')
  solo.className = 'solo'
  solo.textContent = 'S'
  solo.title = `show only ${name}`
  solo.onclick = (e) => {
    e.preventDefault()
    for (const r of rows) {
      r.layer.shown = r.box === box
      r.box.checked = r.box === box
    }
  }
  label.appendChild(solo)

  let update: (count: number) => void = () => {}
  if (!opts?.noCount) {
    const countSpan = document.createElement('span')
    countSpan.className = 'count'
    label.insertBefore(countSpan, solo)
    update = (count) => {
      const s = String(count)
      if (s === countSpan.textContent) return
      countSpan.textContent = s
      countSpan.classList.remove('flash')
      void countSpan.offsetWidth // restart the CSS animation
      countSpan.classList.add('flash')
    }
  }
  layersDiv.appendChild(label)
  box.onchange = () => (layer.shown = box.checked)
  rows.push({ layer, box })
  return update
}
