// Shareable moments (the growth loop — cinematic is the brand): restore a deep-linked view
// on load, copy a share link, and record a ~6s webm clip of the globe. Camera + which layers
// were on only — time/AOI restore is an explicit documented ceiling (scene-state carries t/aois
// but nothing here re-applies them). DOM/cesium/MediaRecorder seam; the URL math lives in
// share-core.mjs (headless, node --test'able).
import type { Viewer } from 'cesium'
import { applyState, captureState, readHashState, stateToHash } from './scene-state'
import { shareUrl } from './share-core.mjs'

export interface ShareOpts {
  /** names of the layers currently toggled on (main.ts owns the name<->layer mapping). */
  activeLayers(): string[]
  /** turn exactly the named layers on and the rest off. */
  applyLayers(names: string[]): void
}

const CLIP_MS = 6_000

/** Wire the #share-bar buttons and, on load, restore a shared #s= deep-link. */
export function initShare(viewer: Viewer, opts: ShareOpts): void {
  const status = document.getElementById('status')!

  // (1) deep-link restore: a shared #s= hash rebuilds camera pose + which layers were on.
  const restored = readHashState()
  if (restored) {
    const extras = applyState(viewer, restored) // flies the camera
    if (extras.layers) opts.applyLayers(extras.layers)
  }

  // (2) SHARE: snapshot camera + active layers -> hash -> address bar + clipboard.
  const shareBtn = document.getElementById('share-link') as HTMLButtonElement
  shareBtn.onclick = async () => {
    const hash = stateToHash(captureState(viewer, { layers: opts.activeLayers() }))
    location.hash = hash
    try {
      await navigator.clipboard.writeText(shareUrl(location.href, hash))
      status.textContent = 'SHARE LINK COPIED'
    } catch {
      // clipboard blocked (no https / denied): the link is already in the URL bar regardless.
      status.textContent = 'SHARE LINK IN ADDRESS BAR'
    }
  }

  // (3) REC CLIP: ~6s of the globe canvas -> downloaded webm. Guard when the browser lacks
  // canvas.captureStream or MediaRecorder (older/headless — disable rather than throw on click).
  const recBtn = document.getElementById('rec-clip') as HTMLButtonElement
  const canvas = viewer.scene.canvas as HTMLCanvasElement & { captureStream?(fps: number): MediaStream }
  if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    recBtn.disabled = true
    recBtn.title = 'clip recording unavailable in this browser'
    return
  }
  let recording = false
  recBtn.onclick = () => {
    if (recording) return
    recording = true
    recBtn.classList.add('active')
    recBtn.textContent = 'REC ●'
    // ponytail: captureStream grabs whatever the compositor paints during the window — a static
    // globe yields a short valid clip, motion (orbit/fly) yields the cinematic one. Good enough.
    const chunks: Blob[] = []
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm' })
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(chunks, { type: 'video/webm' }))
      a.download = `godseye-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(a.href)
      recording = false
      recBtn.classList.remove('active')
      recBtn.textContent = 'REC CLIP'
      status.textContent = 'CLIP SAVED'
    }
    rec.start()
    status.textContent = 'RECORDING 6S CLIP…'
    setTimeout(() => rec.stop(), CLIP_MS)
  }
}
