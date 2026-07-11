// DATA LAYERS panel rows: checkbox + name + live count (CAP-07 minimal shape).
export interface PanelLayer {
  shown: boolean
}

export function addLayerRow(name: string, layer: PanelLayer, opts?: { noCount?: boolean }): (count: number) => void {
  const layersDiv = document.getElementById('layers')!
  const label = document.createElement('label')
  label.className = 'layer-row'
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = layer.shown
  label.append(box, ` ${name} `)
  if (opts?.noCount) {
    layersDiv.appendChild(label)
    box.onchange = () => (layer.shown = box.checked)
    return () => {}
  }
  const countSpan = document.createElement('span')
  countSpan.className = 'count'
  label.append(countSpan)
  layersDiv.appendChild(label)
  box.onchange = () => (layer.shown = box.checked)
  return (count) => (countSpan.textContent = String(count))
}
