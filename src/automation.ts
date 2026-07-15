import { Cartesian3, Cesium3DTileset, Matrix4, Math as CMath, type Viewer } from 'cesium'
import { createAutomationLifecycle, mergeWarnings } from './automation-core.mjs'
import { createEvidencePacket } from './evidence-packet.mjs'
import { captureState } from './scene-state'
import { SOURCES } from './sources'
import { needsStoryFallback, storySafeBounds, summarizeStoryReadiness, summarizeStoryTiles } from './story-readiness.mjs'
import {
  applyPresentationState,
  captureLayerState,
  focusStoryLayers,
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

const activeLayerKeys = () => activeLayers().map(({ key }) => key)

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
  let recordingObservedAt: string | undefined
  let storySourceLabels: string[] = []
  let storyContextText = ''
  let compositeFrame: number | null = null
  const compositeCanvas = document.createElement('canvas')
  const compositeContext = compositeCanvas.getContext('2d')

  const restorePresentation = () => {
    applyPresentationState(previousPresentation, previousCleanUi)
    restoreLayerState(previousLayerState)
    previousLayerState = []
  }

  const updateStoryOverlay = (observedAt = new Date().toISOString()) => {
    const registered = activeLayers().filter((layer) => layer.registered)
    storySourceLabels = registered.slice(0, 4).map(({ label }) => label)
    storyContextText = registered.length
      ? `${registered.length} REGISTERED SOURCE${registered.length === 1 ? '' : 'S'} · LIVE SCENE`
      : 'SOURCE READINESS REQUIRED'
    updateStoryOverlayView(observedAt, storyContextText, storySourceLabels)
  }

  const stopComposite = () => {
    if (compositeFrame !== null) cancelAnimationFrame(compositeFrame)
    compositeFrame = null
  }

  const drawComposite = (scheduleNext = false) => {
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
    compositeContext.fillText(storySourceLabels.join('  ·  '), safe.right, safe.bottom)
    compositeContext.textAlign = 'left'
    if (scheduleNext) compositeFrame = requestAnimationFrame(() => drawComposite(true))
  }

  const inspectFrameContrast = (surface: HTMLCanvasElement = canvas): ReadinessCheck => {
    const sample = document.createElement('canvas')
    sample.width = 12
    sample.height = 8
    const context = sample.getContext('2d', { willReadFrequently: true })
    if (!context) return { level: 'fail', detail: 'frame sampling is unavailable' }
    try {
      context.drawImage(surface, 0, 0, sample.width, sample.height)
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data
      const values: number[] = []
      let dark = 0
      let bright = 0
      for (let i = 0; i < pixels.length; i += 4) {
        const value = 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]
        values.push(value)
        if (value < 12) dark++
        if (value > 244) bright++
      }
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const spread = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
      if (dark / values.length > 0.94) return { level: 'fail', detail: 'frame is nearly black' }
      if (bright / values.length > 0.88) return { level: 'fail', detail: 'frame is overexposed' }
      if (spread < 4) return { level: 'fail', detail: 'frame has insufficient visual contrast' }
      return { level: 'pass', detail: `luminance spread ${spread.toFixed(1)}` }
    } catch {
      return { level: 'fail', detail: 'cross-origin imagery prevented contrast sampling' }
    }
  }

  const inspectStoryReadiness = (): StoryReadiness => {
    viewer.scene.render()
    drawComposite(false)
    const active = activeLayers()
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
      tiles: summarizeStoryTiles(viewer.scene.globe.tilesLoaded, visibleTilesets(viewer)),
      sources: !registered.length
        ? { level: 'fail' as const, detail: 'no active registered source' }
        : unregistered.length
          ? { level: 'warn' as const, detail: `unregistered active layers: ${unregistered.map(({ key }) => key).join(', ')}` }
          : { level: 'pass' as const, detail: `${registered.length} active registered source${registered.length === 1 ? '' : 's'}` },
      overlays: overlayFits
        ? { level: 'pass' as const, detail: 'Story evidence elements fit the responsive safe frame above the caption reserve' }
        : { level: 'fail' as const, detail: 'Story evidence element is hidden, clipped, or inside the caption reserve' },
      contrast: inspectFrameContrast(canvas),
    }
    return summarizeStoryReadiness(checks) as StoryReadiness
  }

  const startRecorder = (presentation: 'analyst' | 'story') => {
    const surface = presentation === 'story' ? compositeCanvas : canvas
    if (presentation === 'story') {
      if (!compositeContext) throw new Error('Story capture composition is unavailable in this browser')
      stopComposite()
      drawComposite(true)
    }
    if (typeof surface.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      throw new Error('canvas recording is unavailable in this browser')
    }
    chunks = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    recorder = new MediaRecorder(surface.captureStream(30), { mimeType, videoBitsPerSecond: 12_000_000 })
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
    const height = Math.min(2_500_000, Math.max(250_000, camera.height * 2.5))
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(camera.lon, camera.lat, height),
      orientation: {
        heading: CMath.toRadians(camera.headingDeg ?? 0),
        pitch: CMath.toRadians(-45),
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
      readinessWarnings = []
      focusWarnings = []
      recordingObservedAt = undefined
      applyPresentationState(presentation, previousCleanUi)
      try {
        if (request.quality) {
          viewer.resolutionScale = request.quality.resolutionScale
          for (let i = 0; i < viewer.scene.primitives.length; i++) {
            const primitive = viewer.scene.primitives.get(i) as { maximumScreenSpaceError?: number }
            if (primitive?.maximumScreenSpaceError !== undefined) {
              primitive.maximumScreenSpaceError = request.quality.maximumScreenSpaceError
            }
          }
        }
        if (request.style) {
          const button = [...document.querySelectorAll<HTMLButtonElement>('#style-presets button')]
            .find((candidate) => candidate.textContent === request.style)
          if (!button) throw new Error(`unknown style: ${request.style}`)
          await invoke(button)
        }
        for (const token of request.actions ?? []) await applyAction(token)

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
          if (presentation === 'story' && flightFallbackHeight === undefined) startOrbit(request.camera, request.orbitDegPerSec)
          await wait((request.settleSec ?? 4) * 1000)
          for (const token of request.afterActions ?? []) await applyAction(token)
          if (request.afterActions?.length) await wait((request.actionWaitSec ?? 5) * 1000)
          let readiness: StoryReadiness | undefined
          if (presentation === 'story') {
            const explicitLabels = [...(request.actions ?? []), ...(request.afterActions ?? [])]
              .filter((token) => token.startsWith('layer:') && !token.endsWith(':off'))
              .map((token) => token.slice(6))
            const registeredLabels = activeLayers().filter((layer) => layer.registered).map((layer) => layer.label)
            const hiddenLayers = focusStoryLayers([...explicitLabels, ...registeredLabels])
            if (hiddenLayers) focusWarnings.push(`Story focus hid ${hiddenLayers} extra active layer${hiddenLayers === 1 ? '' : 's'}`)
            recordingObservedAt = new Date().toISOString()
            updateStoryOverlay(recordingObservedAt)
            readiness = inspectStoryReadiness()
            if (flightFallbackHeight !== undefined) {
              readiness.fallbackApplied = true
              readiness.warnings.unshift(`safe camera fallback applied at ${Math.round(flightFallbackHeight)}m`)
            } else if (!readiness.ready && needsStoryFallback(readiness)) {
              const fallbackHeight = applySafeCamera(request.camera)
              await wait(2_000)
              updateStoryOverlay()
              readiness = inspectStoryReadiness()
              readiness.fallbackApplied = true
              readiness.warnings.unshift(`safe camera fallback applied at ${Math.round(fallbackHeight)}m`)
            }
            if (!readiness.ready) {
              throw new Error(`Story frame is not capture-ready: ${readiness.warnings.join('; ')}`)
            }
            readinessWarnings = [...focusWarnings, ...readiness.warnings]
            recordingObservedAt = new Date().toISOString()
            updateStoryOverlay(recordingObservedAt)
          }
          if (presentation !== 'story') startOrbit(request.camera, request.orbitDegPerSec)
          startRecorder(presentation)
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
        chunks = []
        stopComposite()
        restorePresentation()
        throw error
      }
    },
    finish: async (request: FinishRequest) => {
      stopOrbit?.()
      recorder!.stop()
      await stopped
      stopComposite()
      const scene = captureState(viewer, {
        observedAt: recordingObservedAt,
        layers: activeLayerKeys(),
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
        recordingObservedAt = undefined
        restorePresentation()
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
