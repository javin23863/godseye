// DATA LAYERS panel rows: checkbox + name + live count (CAP-07 minimal shape).
export interface PanelLayer {
  shown: boolean
}

export function addLayerRow(name: string, layer: PanelLayer): (count: number) => void {
  const layersDiv = document.getElementById('layers')!
  const label = document.createElement('label')
  label.className = 'layer-row'
  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = layer.shown
  const countSpan = document.createElement('span')
  countSpan.className = 'count'
  label.append(box, ` ${name} `, countSpan)
  layersDiv.appendChild(label)
  box.onchange = () => (layer.shown = box.checked)
  return (count) => (countSpan.textContent = String(count))
}
