import {
  applyPresentationState,
  captureLayerState,
  focusStoryLayers,
  restoreLayerState,
  updateStoryOverlayView,
  type LayerState,
} from './presentation'

// Manual Story presentation for the current analyst-selected scene. Camera
// movement for recorded clips stays behind godseyeAutomationV1 readiness checks.
export function setupKiosk() {
  let layerState: LayerState[] = []

  const enter = () => {
    if (document.body.classList.contains('kiosk')) return
    layerState = captureLayerState()
    focusStoryLayers()
    document.body.classList.add('kiosk')
    applyPresentationState('story', true)
    updateStoryOverlayView(
      new Date().toISOString(),
      'CURRENT ANALYST SCENE · NOT EVIDENCE CAPTURE',
      ['NO EVIDENCE PACKET'],
    )
  }

  const exit = () => {
    if (!document.body.classList.contains('kiosk')) return
    document.body.classList.remove('kiosk')
    applyPresentationState(undefined, false)
    restoreLayerState(layerState)
    layerState = []
  }

  const toggle = () => (document.body.classList.contains('kiosk') ? exit() : enter())

  const btn = document.createElement('button')
  btn.id = 'kiosk-toggle'
  btn.textContent = 'STORY MODE'
  btn.title = 'Frame the current analyst scene for capture (K)'
  btn.onclick = toggle
  document.body.appendChild(btn)

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault()
      toggle()
    } else if (e.key === 'Escape' && document.body.classList.contains('kiosk')) {
      exit()
    }
  })

  return { toggle, enter, exit }
}
