import { Cartesian3, Cesium3DTileset, Matrix4, Math as CMath, type ImageryLayer, type Viewer } from 'cesium'
import { createAutomationLifecycle, mergeWarnings } from './automation-core.mjs'
import { isBasemapLabelLayer, isBundledEarthLayer } from './basemaps'
import { createEvidencePacket } from './evidence-packet.mjs'
import { captureState } from './scene-state'
import { SOURCES } from './sources'
import { needsStoryFallback, storySafeBounds, summarizeStoryReadiness, summarizeStoryTiles } from './story-readiness.mjs'
import {
  applyPresentationState,
  captureLayerState,
  focusStoryLayers,
  lockStoryOverlay,
  orderedStoryLabels,
  restoreLayerState,
  updateStoryOverlayView,
  type LayerState,
} from './presentation'

interface CameraRequest {
  lon: number
  lat: number
  height: number
  headingDeg?: number
  pitchDeg?: number
  fromHeight?: number
}
interface BeginRequest {
  op: 'begin'
  camera: CameraRequest
  presentation?: 'analyst' | 'story'
  style?: string
  actions?: string[]
  afterActions?: string[]
  orbitDegPerSec?: number
  settleSec?: number
  flyDurationSec?: number
  actionWaitSec?: number
  quality?: { resolutionScale: number; maximumScreenSpaceError: number }
}
interface FinishRequest {
  op: 'finish'
  claims?: { text: string; kind: 'observation' | 'inference'; sourceKeys: string[] }[]
  artifacts?: { name: string; uri: string; mediaType?: string }[]
  warnings?: string[]
}
type AutomationRequest = { op: 'status' | 'drain' } | BeginRequest | FinishRequest

type CheckLevel = 'pass' | 'warn' | 'fail'
interface ReadinessCheck { level: CheckLevel; detail: string }
interface StoryReadiness {
  ready: boolean
  fallbackApplied: boolean
  checks: Record<'camera' | 'tiles' | 'sources' | 'overlays' | 'contrast', CheckLevel>
  warnings: string[]
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const STORY_SIGNAL_HOLD_MS = 1_600
const STORY_LOCK_MS = 800

function visibleTilesets(viewer: Viewer): Cesium3DTileset[] {
  const tilesets: Cesium3DTileset[] = []
  for (let index = 0; index < viewer.scene.primitives.length; index++) {
    const primitive = viewer.scene.primitives.get(index)
    if (primitive instanceof Cesium3DTileset && primitive.show) tilesets.push(primitive)
  }
  return tilesets
}

function activeLayers(): { key: string; label: string; registered: boolean }[] {
  const byLabel = new Map(Object.entries(SOURCES).map(([key, source]) => [source.label, key]))
  return [...document.querySelectorAll<HTMLLabelElement>('#layers label.layer-row')]
    .filter((label) => label.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked)
    .map((row) => row.dataset.layer ?? '')
    .filter(Boolean)
    .map((label) => {
      const registered = byLabel.get(label)
      return {
        key: registered ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        label,
        registered: Boolean(registered),
      }
    })
}

async function invoke(element: HTMLElement): Promise<void> {
  if (element.onclick) await element.onclick.call(element, new PointerEvent('click'))
  else element.click()
}

async function applyAction(token: string): Promise<void> {
  if (token.startsWith('layer:')) {
    let name = token.slice(6)
    let wanted = true
    if (name.endsWith(':off')) {
      name = name.slice(0, -4)
      wanted = false
    }
    const label = [...document.querySelectorAll<HTMLLabelElement>('#layers label.layer-row')]
      .find((row) => row.dataset.layer === name)
    const box = label?.querySelector<HTMLInputElement>('input[type=checkbox]')
    if (!box) throw new Error(`unknown layer action: ${token}`)
    if (box.checked !== wanted) box.click()
    return
  }
  if (token.startsWith('basemap:')) {
    const mode = token.slice(8)
    const button = document.querySelector<HTMLButtonElement>(`#basemaps button[data-mode="${CSS.escape(mode)}"]`)
    if (!button) throw new Error(`unknown basemap action: ${token}`)
    if (!button.classList.contains('active')) await invoke(button)
    return
  }
  const element = document.getElementById(token)
  if (!element) throw new Error(`unknown action: ${token}`)
  await invoke(element)
}

/** Install the sole supported browser automation boundary. */
export function installAutomation(viewer: Viewer): void {
  const canvas = viewer.scene.canvas as HTMLCanvasElement & { captureStream?(fps: number): MediaStream }
  let recorder: MediaRecorder | null = null
  let stopped: Promise<void> | null = null
  let chunks: Blob[] = []
  let stopOrbit: (() => void) | null = null
  let readinessWarnings: string[] = []
  let focusWarnings: string[] = []
  let previousPresentation: string | undefined
  let previousCleanUi = false
  let previousLayerState: LayerState[] = []
  let previousStyle: string | undefined
  let previousBasemap: string | undefined
  let previousBloom: boolean | undefined
  let previousSharpen: string | undefined
  let previousPixelate: string | undefined
  let previousResolutionScale: number | undefined
  let previousGlobeScreenSpaceError: number | undefined
  let previousGlobeLighting: boolean | undefined
  let previousScreenSpaceErrors: { primitive: { maximumScreenSpaceError: number }; value: number }[] = []
  let previousImageryShows: { layer: ImageryLayer; show: boolean }[] = []
  let previousManualOrbit = false
  let storyPreferredLabels: string[] = []
  let recordingObservedAt: string | undefined
  let storySourceLabels: string[] = []
  let storyContextText = ''
  let storyLockStartedAt: number | null = null
  let compositeTimer: number | null = null
  let recordingStream: MediaStream | null = null
  const compositeCanvas = document.createElement('canvas')
  const compositeContext = compositeCanvas.getContext('2d')

  const applyStyle = async (name: string) => {
    const button = [...document.querySelectorAll<HTMLButtonElement>('#style-presets button')]
      .find((candidate) => candidate.textContent === name)
    if (!button) throw new Error(`unknown style: ${name}`)
    if (!button.classList.contains('active')) await invoke(button)
  }

  const setEffectValue = (id: string, value: string) => {
    const input = document.getElementById(id) as HTMLInputElement | null
    if (!input || input.value === value) return
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const orderedActiveLayers = () => {
    const active = activeLayers()
    if (storyPreferredLabels.length === 0) return active
    const labels = orderedStoryLabels(active.map(({ label }) => label), storyPreferredLabels)
    return labels.map((label) => active.find((layer) => layer.label === label)!).filter(Boolean)
  }

  const restorePresentation = async () => {
    if (previousStyle) await applyStyle(previousStyle)
    if (previousBasemap) {
      const button = document.querySelector<HTMLButtonElement>(`#basemaps button[data-mode="${CSS.escape(previousBasemap)}"]`)
      if (button && !button.classList.contains('active')) await invoke(button)
    }
    const bloom = document.getElementById('fx-bloom') as HTMLInputElement | null
    if (bloom && previousBloom !== undefined && bloom.checked !== previousBloom) bloom.click()
    if (previousSharpen !== undefined) setEffectValue('fx-sharpen', previousSharpen)
    if (previousPixelate !== undefined) setEffectValue('fx-pixelate', previousPixelate)
    if (previousResolutionScale !== undefined) viewer.resolutionScale = previousResolutionScale
    if (previousGlobeScreenSpaceError !== undefined) viewer.scene.globe.maximumScreenSpaceError = previousGlobeScreenSpaceError
    if (previousGlobeLighting !== undefined) viewer.scene.globe.enableLighting = previousGlobeLighting
    for (const { primitive, value } of previousScreenSpaceErrors) primitive.maximumScreenSpaceError = value
    for (const { layer, show } of previousImageryShows) {
      if (viewer.imageryLayers.contains(layer)) layer.show = show
    }
    applyPresentationState(previousPresentation, previousCleanUi)
    restoreLayerState(previousLayerState)
    const orbitButton = document.getElementById('orbit-toggle') as HTMLButtonElement | null
    if (previousManualOrbit && orbitButton && !orbitButton.classList.contains('active')) await invoke(orbitButton)
    previousLayerState = []
    previousStyle = undefined
    previousBasemap = undefined
    previousBloom = undefined
    previousSharpen = undefined
    previousPixelate = undefined
    previousResolutionScale = undefined
    previousGlobeScreenSpaceError = undefined
    previousGlobeLighting = undefined
    previousScreenSpaceErrors = []
    previousImageryShows = []
    previousManualOrbit = false
    storyPreferredLabels = []
    storyLockStartedAt = null
  }

  const updateStoryOverlay = (observedAt = new Date().toISOString()) => {
    const registered = orderedActiveLayers().filter((layer) => layer.registered)
    storySourceLabels = registered.slice(0, 4).map(({ label }) => label)
    storyContextText = registered.length
      ? `${registered.length} REGISTERED SOURCE${registered.length === 1 ? '' : 'S'} · LIVE SCENE`
      : 'SOURCE READINESS REQUIRED'
    updateStoryOverlayView(observedAt, storyContextText, storySourceLabels)
  }

  const stopComposite = () => {
    if (compositeTimer !== null) window.clearInterval(compositeTimer)
    compositeTimer = null
  }

  const drawComposite = () => {
    if (!compositeContext) return
    const width = canvas.width
    const height = canvas.height
    if (compositeCanvas.width !== width || compositeCanvas.height !== height) {
      compositeCanvas.width = width
      compositeCanvas.height = height
    }
    const scale = Math.max(0.7, Math.min(width / 1600, height / 900))
    const safe = storySafeBounds(width, height)
    const padX = safe.left
    const padY = safe.top
    compositeContext.drawImage(canvas, 0, 0, width, height)
    const shade = compositeContext.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0, 'rgba(2,7,12,.42)')
    shade.addColorStop(0.24, 'rgba(2,7,12,0)')
    shade.addColorStop(0.68, 'rgba(2,7,12,0)')
    shade.addColorStop(1, 'rgba(2,7,12,.74)')
    compositeContext.fillStyle = shade
    compositeContext.fillRect(0, 0, width, height)

    let lockProgress = 1
    if (storyLockStartedAt !== null) {
      const lockElapsed = performance.now() - storyLockStartedAt - STORY_SIGNAL_HOLD_MS
      lockProgress = Math.max(0, Math.min(1, lockElapsed / STORY_LOCK_MS))
      if (lockElapsed >= 0 && lockProgress < 1) {
        const pulse = Math.sin(Math.PI * lockProgress)
        const inset = Math.round(Math.min(width, height) * (0.08 - 0.025 * lockProgress))
        compositeContext.strokeStyle = `rgba(107,211,214,${(0.55 * pulse).toFixed(3)})`
        compositeContext.lineWidth = Math.max(1, 2 * scale)
        compositeContext.strokeRect(inset, inset, width - inset * 2, height - inset * 2)
      } else if (lockProgress >= 1) {
        storyLockStartedAt = null
      }
    }

    compositeContext.textBaseline = 'top'
    compositeContext.fillStyle = '#ffc269'
    compositeContext.font = `700 ${Math.round(12 * scale)}px "Segoe UI", sans-serif`
    compositeContext.fillText('G O D S E Y E', padX, padY)
    compositeContext.fillStyle = '#f5f1e8'
    compositeContext.font = `400 ${Math.round(18 * scale)}px "Segoe UI", sans-serif`
    compositeContext.fillText('T E M P O R A L   E V I D E N C E', padX, padY + 22 * scale)

    compositeContext.textAlign = 'right'
    compositeContext.fillStyle = 'rgba(245,241,232,.7)'
    compositeContext.font = `400 ${Math.round(10 * scale)}px "Segoe UI", sans-serif`
    compositeContext.fillText(storyContextText, safe.right, padY)
    compositeContext.textBaseline = 'bottom'
    compositeContext.textAlign = 'left'
    compositeContext.fillStyle = 'rgba(245,241,232,.48)'
    compositeContext.fillText('OBSERVED', padX, safe.bottom - 28 * scale)
    compositeContext.fillStyle = '#f5f1e8'
    compositeContext.font = `400 ${Math.round(18 * scale)}px "Segoe UI", sans-serif`
    compositeContext.fillText(recordingObservedAt?.replace('.000Z', 'Z') ?? '', padX, safe.bottom)

    compositeContext.textAlign = 'right'
    compositeContext.fillStyle = 'rgba(245,241,232,.48)'
    compositeContext.font = `400 ${Math.round(10 * scale)}px "Segoe UI", sans-serif`
    compositeContext.fillText('ACTIVE SOURCES', safe.right, safe.bottom - 28 * scale)
    compositeContext.fillStyle = '#f5f1e8'
    const visibleSources = lockProgress < 1
      ? storySourceLabels.slice(0, Math.max(1, Math.ceil(lockProgress * storySourceLabels.length)))
      : storySourceLabels
    compositeContext.fillText(visibleSources.join('  ·  '), safe.right, safe.bottom)
    compositeContext.textAlign = 'left'
  }

  const inspectFrameContrast = (): ReadinessCheck => {
    try {
      const context = (viewer.scene as unknown as { context: {
        drawingBufferWidth: number
        drawingBufferHeight: number
        readPixels(options: { x: number; y: number; width: number; height: number }): ArrayLike<number>
      } }).context
      const values: number[] = []
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 6; column++) {
          const pixels = context.readPixels({
            x: Math.floor((column + 0.5) * context.drawingBufferWidth / 6),
            y: Math.floor((row + 0.5) * context.drawingBufferHeight / 4),
            width: 1,
            height: 1,
          })
          values.push(0.2126 * pixels[0] + 0.7152 * pixels[1] + 0.0722 * pixels[2])
        }
      }
      const dark = values.filter((value) => value < 12).length
      const bright = values.filter((value) => value > 244).length
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
      if (dark / values.length > 0.94) return { level: 'fail', detail: `frame is nearly black (mean ${mean.toFixed(1)})` }
      if (bright / values.length > 0.88) return { level: 'fail', detail: `frame is overexposed (mean ${mean.toFixed(1)})` }
      if (spread < 4) return { level: 'fail', detail: `frame has insufficient visual contrast (spread ${spread.toFixed(1)})` }
      return { level: 'pass', detail: `luminance spread ${spread.toFixed(1)}` }
    } catch {
      return { level: 'fail', detail: 'framebuffer sampling is unavailable' }
    }
  }

  const inspectStoryReadiness = (allowRenderedCoverage = false): StoryReadiness => {
    viewer.scene.render()
    const contrast = inspectFrameContrast()
    drawComposite()
    const active = orderedActiveLayers()
    const registered = active.filter((layer) => layer.registered)
    const unregistered = active.filter((layer) => !layer.registered)
    const safe = storySafeBounds(innerWidth, innerHeight)
    const overlayFits = ['#story-mark', '#story-context', '#story-footer'].every((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      const style = element ? getComputedStyle(element) : null
      const bounds = element?.getBoundingClientRect()
      return Boolean(element && style && style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity) > 0 && bounds && bounds.width > 0 && bounds.height > 0 &&
        bounds.left >= safe.left - 1 && bounds.top >= safe.top - 1 && bounds.right <= safe.right + 1 && bounds.bottom <= safe.bottom + 1)
    })
    const cameraHeight = viewer.camera.positionCartographic.height
    const globeVisible = viewer.scene.globe.show && Boolean(viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid))
    const checks = {
      camera: cameraHeight > 100 && globeVisible
        ? { level: 'pass' as const, detail: `globe visible at ${Math.round(cameraHeight)}m` }
        : { level: 'fail' as const, detail: 'camera is below a safe range or the globe is not visible' },
      tiles: summarizeStoryTiles(
        viewer.scene.globe.tilesLoaded,
        visibleTilesets(viewer),
        allowRenderedCoverage && (() => {
          // Cesium's public flag includes medium/low refinement. After the strict
          // wait, require rendered coverage and an empty high-priority queue.
          const surface = (viewer.scene.globe as unknown as {
            _surface?: { _tilesToRender: unknown[]; _tileLoadQueueHigh: unknown[] }
          })._surface
          return Boolean(surface?._tilesToRender.length && surface._tileLoadQueueHigh.length === 0)
        })(),
      ),
      sources: !registered.length
        ? { level: 'fail' as const, detail: 'no active registered source' }
        : unregistered.length
          ? { level: 'warn' as const, detail: `unregistered active layers: ${unregistered.map(({ key }) => key).join(', ')}` }
          : { level: 'pass' as const, detail: `${registered.length} active registered source${registered.length === 1 ? '' : 's'}` },
      overlays: overlayFits
        ? { level: 'pass' as const, detail: 'Story evidence elements fit the responsive safe frame above the caption reserve' }
        : { level: 'fail' as const, detail: 'Story evidence element is hidden, clipped, or inside the caption reserve' },
      contrast,
    }
    return summarizeStoryReadiness(checks) as StoryReadiness
  }

  const startRecorder = (presentation: 'analyst' | 'story') => {
    const surface = presentation === 'story' ? compositeCanvas : canvas
    if (presentation === 'story') {
      if (!compositeContext) throw new Error('Story capture composition is unavailable in this browser')
      stopComposite()
      drawComposite()
    }
    if (typeof surface.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      throw new Error('canvas recording is unavailable in this browser')
    }
    chunks = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    recordingStream = surface.captureStream(presentation === 'story' ? 0 : 30)
    if (presentation === 'story') {
      const track = recordingStream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
      if (typeof track?.requestFrame !== 'function') throw new Error('manual Story frame capture is unavailable in this browser')
      const renderFrame = () => {
        drawComposite()
        track.requestFrame?.()
      }
      renderFrame()
      // Small scheduling margin keeps measured output at or above 30 fps.
      compositeTimer = window.setInterval(renderFrame, 1000 / 32)
    }
    recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 12_000_000 })
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data)
    stopped = new Promise((resolve) => { recorder!.onstop = () => resolve() })
    recorder.start(1000)
  }

  const fly = (camera: CameraRequest, duration: number) => new Promise<void>((resolve, reject) => {
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      viewer.camera.cancelFlight()
    }, Math.max(3_000, duration * 1_000 + 3_000))
    const complete = () => {
      clearTimeout(timeout)
      resolve()
    }
    const cancel = () => {
      clearTimeout(timeout)
      reject(new Error(timedOut ? 'camera flight timed out' : 'camera flight cancelled'))
    }
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(camera.lon, camera.lat, camera.height),
      orientation: {
        heading: CMath.toRadians(camera.headingDeg ?? 0),
        pitch: CMath.toRadians(camera.pitchDeg ?? -30),
        roll: 0,
      },
      duration,
      complete,
      cancel,
    })
  })

  const applySafeCamera = (camera: CameraRequest): number => {
    stopOrbit?.()
    // A fallback is an evidence overview, not a terrain close-up. Staying above
    // 2,500 km keeps the primary region legible and avoids accepting half-loaded detail.
    const height = Math.min(8_000_000, Math.max(2_500_000, camera.height * 2.5))
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(camera.lon, camera.lat, height),
      orientation: {
        heading: CMath.toRadians(camera.headingDeg ?? 0),
        pitch: CMath.toRadians(camera.pitchDeg ?? -55),
        roll: 0,
      },
    })
    return height
  }

  const startOrbit = (camera: CameraRequest, degPerSec?: number) => {
    if (!degPerSec) return
    const target = Cartesian3.fromDegrees(camera.lon, camera.lat, 0)
    const range = Cartesian3.distance(viewer.camera.position, target)
    const pitch = viewer.camera.pitch
    const horizontal = range * Math.cos(-pitch)
    const up = range * Math.sin(-pitch)
    const rate = CMath.toRadians(degPerSec)
    let heading = viewer.camera.heading
    let last = performance.now()
    const remove = viewer.clock.onTick.addEventListener(() => {
      const now = performance.now()
      heading += rate * ((now - last) / 1000)
      last = now
      viewer.camera.lookAt(target, new Cartesian3(-horizontal * Math.sin(heading), -horizontal * Math.cos(heading), up))
    })
    stopOrbit = () => {
      remove()
      viewer.camera.lookAtTransform(Matrix4.IDENTITY)
      stopOrbit = null
    }
  }

  const handler = createAutomationLifecycle({
    status: () => ({
      ready: true,
      recording: typeof canvas.captureStream === 'function' && typeof MediaRecorder !== 'undefined',
      presentations: ['analyst', 'story'],
    }),
    begin: async (request: BeginRequest) => {
      const presentation = request.presentation ?? 'analyst'
      previousPresentation = document.body.dataset.presentation
      previousCleanUi = document.body.classList.contains('clean-ui')
      previousLayerState = presentation === 'story' ? captureLayerState() : []
      previousStyle = presentation === 'story' ? document.getElementById('style-name')?.textContent?.trim() : undefined
      previousBasemap = presentation === 'story'
        ? document.querySelector<HTMLButtonElement>('#basemaps button.active')?.dataset.mode
        : undefined
      const bloom = document.getElementById('fx-bloom') as HTMLInputElement | null
      previousBloom = presentation === 'story' ? bloom?.checked : undefined
      previousSharpen = presentation === 'story'
        ? (document.getElementById('fx-sharpen') as HTMLInputElement | null)?.value
        : undefined
      previousPixelate = presentation === 'story'
        ? (document.getElementById('fx-pixelate') as HTMLInputElement | null)?.value
        : undefined
      previousResolutionScale = presentation === 'story' ? viewer.resolutionScale : undefined
      previousGlobeScreenSpaceError = presentation === 'story' ? viewer.scene.globe.maximumScreenSpaceError : undefined
      previousGlobeLighting = presentation === 'story' ? viewer.scene.globe.enableLighting : undefined
      previousScreenSpaceErrors = []
      previousImageryShows = []
      if (presentation === 'story') {
        for (let i = 0; i < viewer.imageryLayers.length; i++) {
          const layer = viewer.imageryLayers.get(i)
          previousImageryShows.push({ layer, show: layer.show })
        }
        for (let i = 0; i < viewer.scene.primitives.length; i++) {
          const primitive = viewer.scene.primitives.get(i) as { maximumScreenSpaceError?: number }
          if (typeof primitive?.maximumScreenSpaceError === 'number') {
            previousScreenSpaceErrors.push({ primitive: primitive as { maximumScreenSpaceError: number }, value: primitive.maximumScreenSpaceError })
          }
        }
      }
      readinessWarnings = []
      focusWarnings = []
      storyPreferredLabels = []
      storyLockStartedAt = null
      recordingObservedAt = undefined
      applyPresentationState(presentation, previousCleanUi)
      try {
        if (presentation === 'story') {
          viewer.scene.globe.enableLighting = false
          for (let i = 0; i < viewer.imageryLayers.length; i++) {
            const layer = viewer.imageryLayers.get(i)
            if (isBasemapLabelLayer(layer)) layer.show = false
          }
          const orbitButton = document.getElementById('orbit-toggle')
          previousManualOrbit = Boolean(orbitButton?.classList.contains('active'))
          if (previousManualOrbit && orbitButton) await invoke(orbitButton)
          if (bloom && !bloom.checked) bloom.click()
          setEffectValue('fx-sharpen', '0')
          setEffectValue('fx-pixelate', '0')
        }
        const legacyOrbitCount = [...(request.actions ?? []), ...(request.afterActions ?? [])]
          .filter((token) => token === 'orbit-toggle').length
        if (request.quality) {
          viewer.resolutionScale = request.quality.resolutionScale
          viewer.scene.globe.maximumScreenSpaceError = request.quality.maximumScreenSpaceError
          for (let i = 0; i < viewer.scene.primitives.length; i++) {
            const primitive = viewer.scene.primitives.get(i) as { maximumScreenSpaceError?: number }
            if (primitive?.maximumScreenSpaceError !== undefined) {
              primitive.maximumScreenSpaceError = request.quality.maximumScreenSpaceError
            }
          }
        } else if (presentation === 'story') {
          viewer.scene.globe.maximumScreenSpaceError = 8
        }
        if (request.style || presentation === 'story') await applyStyle(request.style ?? 'DUSK')
        for (const token of request.actions ?? []) {
          if (presentation === 'story' && token === 'orbit-toggle') continue
          await applyAction(token)
        }

        if (presentation === 'analyst' && request.camera.fromHeight) {
          viewer.camera.setView({ destination: Cartesian3.fromDegrees(request.camera.lon, request.camera.lat, request.camera.fromHeight) })
          await wait(2500)
          startRecorder(presentation)
          await fly(request.camera, request.flyDurationSec ?? 6)
          startOrbit(request.camera, request.orbitDegPerSec)
        } else {
          let flightFallbackHeight: number | undefined
          try {
            await fly(request.camera, request.flyDurationSec ?? 3)
          } catch (error) {
            if (presentation !== 'story') throw error
            flightFallbackHeight = applySafeCamera(request.camera)
            focusWarnings.push(`safe camera fallback applied after ${error instanceof Error ? error.message : 'camera flight failed'}`)
          }
          await wait((request.settleSec ?? 4) * 1000)
          for (const token of request.afterActions ?? []) {
            if (presentation === 'story' && token === 'orbit-toggle') continue
            await applyAction(token)
          }
          if (request.afterActions?.length) await wait((request.actionWaitSec ?? 5) * 1000)
          let readiness: StoryReadiness | undefined
          if (presentation === 'story') {
            const explicitLabels = [...(request.actions ?? []), ...(request.afterActions ?? [])]
              .filter((token) => token.startsWith('layer:') && !token.endsWith(':off'))
              .map((token) => token.slice(6))
            const hiddenLayers = focusStoryLayers(explicitLabels)
            storyPreferredLabels = orderedStoryLabels(activeLayers().map(({ label }) => label), explicitLabels)
            if (hiddenLayers) focusWarnings.push(`Story focus hid ${hiddenLayers} extra active layer${hiddenLayers === 1 ? '' : 's'}`)
            recordingObservedAt = new Date().toISOString()
            updateStoryOverlay(recordingObservedAt)
            readiness = inspectStoryReadiness()
            let fallbackWarning: string | undefined
            if (flightFallbackHeight !== undefined) {
              fallbackWarning = `safe camera fallback applied at ${Math.round(flightFallbackHeight)}m`
            } else if (!readiness.ready && (
              readiness.checks.camera === 'fail' ||
              (readiness.checks.contrast === 'fail' && readiness.checks.tiles !== 'fail')
            )) {
              const fallbackHeight = applySafeCamera(request.camera)
              await wait(2_000)
              updateStoryOverlay()
              readiness = inspectStoryReadiness()
              fallbackWarning = `safe camera fallback applied at ${Math.round(fallbackHeight)}m`
            }
            const tilesBlocking = () => readiness!.checks.tiles === 'fail' && Object.entries(readiness!.checks)
              .every(([name, level]) => level !== 'fail' || name === 'tiles' || name === 'contrast')
            const tileDeadline = performance.now() + 6_000
            while (tilesBlocking() && performance.now() < tileDeadline) {
              await wait(500)
              updateStoryOverlay()
              readiness = inspectStoryReadiness()
            }
            if (tilesBlocking()) {
              for (let i = 0; i < viewer.imageryLayers.length; i++) {
                const layer = viewer.imageryLayers.get(i)
                layer.show = isBundledEarthLayer(layer)
              }
              const offlineDeadline = performance.now() + 6_000
              while (tilesBlocking() && performance.now() < offlineDeadline) {
                await wait(500)
                updateStoryOverlay()
                readiness = inspectStoryReadiness()
              }
              if (tilesBlocking()) readiness = inspectStoryReadiness(true)
              if (readiness.ready) fallbackWarning ??= 'bundled Earth fallback applied after remote imagery timeout'
            }
            if (!readiness.ready && !fallbackWarning && needsStoryFallback(readiness) && readiness.checks.tiles !== 'fail') {
              const fallbackHeight = applySafeCamera(request.camera)
              await wait(2_000)
              updateStoryOverlay()
              readiness = inspectStoryReadiness(true)
              fallbackWarning = `safe camera fallback applied at ${Math.round(fallbackHeight)}m`
            }
            if (fallbackWarning) {
              readiness.fallbackApplied = true
              readiness.warnings.unshift(fallbackWarning)
            }
            if (!readiness.ready) {
              throw new Error(`Story frame is not capture-ready: ${readiness.warnings.join('; ')}`)
            }
            readinessWarnings = [...focusWarnings, ...readiness.warnings]
            recordingObservedAt = new Date().toISOString()
            updateStoryOverlay(recordingObservedAt)
            lockStoryOverlay()
            if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) storyLockStartedAt = performance.now()
          }
          if (presentation !== 'story') startOrbit(request.camera, request.orbitDegPerSec)
          startRecorder(presentation)
          if (presentation === 'story' && !readiness?.fallbackApplied) {
            const effectiveOrbitDegPerSec = request.orbitDegPerSec === undefined && legacyOrbitCount % 2 === 1
              ? 2
              : request.orbitDegPerSec
            startOrbit(request.camera, effectiveOrbitDegPerSec)
          }
          return { presentation, ...(readiness ? { readiness } : {}) }
        }
        return { presentation }
      } catch (error) {
        stopOrbit?.()
        if (recorder?.state === 'recording') {
          recorder.stop()
          await stopped
        }
        recorder = null
        stopped = null
        recordingStream?.getTracks().forEach((track) => track.stop())
        recordingStream = null
        chunks = []
        stopComposite()
        await restorePresentation()
        throw error
      }
    },
    finish: async (request: FinishRequest) => {
      stopOrbit?.()
      recorder!.stop()
      await stopped
      stopComposite()
      recordingStream?.getTracks().forEach((track) => track.stop())
      recordingStream = null
      const scene = captureState(viewer, {
        observedAt: recordingObservedAt,
        layers: orderedActiveLayers().map(({ key }) => key),
        style: document.getElementById('style-name')?.textContent?.trim() || undefined,
        basemap: document.querySelector<HTMLButtonElement>('#basemaps button.active')?.dataset.mode,
      })
      return {
        scene,
        evidence: createEvidencePacket({
          scene,
          claims: request.claims,
          artifacts: request.artifacts,
          warnings: mergeWarnings(request.warnings, readinessWarnings),
        }),
      }
    },
    drain: async () => {
      const blob = chunks.shift()
      if (!blob) {
        recorder = null
        stopped = null
        recordingStream?.getTracks().forEach((track) => track.stop())
        recordingStream = null
        recordingObservedAt = undefined
        await restorePresentation()
        return null
      }
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(reader.error)
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.readAsDataURL(blob)
      })
    },
  }) as (request: AutomationRequest) => Promise<unknown>

  ;(window as Window & { godseyeAutomationV1?: typeof handler }).godseyeAutomationV1 = handler
}
