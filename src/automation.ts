import { Cartesian3, Matrix4, Math as CMath, type Viewer } from 'cesium'
import { createAutomationLifecycle } from './automation-core.mjs'
import { createEvidencePacket } from './evidence-packet.mjs'
import { captureState } from './scene-state'
import { SOURCES } from './sources'

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function activeLayerKeys(): string[] {
  const byLabel = new Map(Object.entries(SOURCES).map(([key, source]) => [source.label, key]))
  return [...document.querySelectorAll<HTMLLabelElement>('#layers label.layer-row')]
    .filter((label) => label.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked)
    .map((label) => label.dataset.layer ?? '')
    .filter(Boolean)
    .map((label) => byLabel.get(label) ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
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

  const startRecorder = () => {
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      throw new Error('canvas recording is unavailable in this browser')
    }
    chunks = []
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
    recorder = new MediaRecorder(canvas.captureStream(30), { mimeType, videoBitsPerSecond: 12_000_000 })
    recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data)
    stopped = new Promise((resolve) => { recorder!.onstop = () => resolve() })
    recorder.start(1000)
  }

  const fly = (camera: CameraRequest, duration: number) => new Promise<void>((resolve, reject) => {
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(camera.lon, camera.lat, camera.height),
      orientation: {
        heading: CMath.toRadians(camera.headingDeg ?? 0),
        pitch: CMath.toRadians(camera.pitchDeg ?? -30),
        roll: 0,
      },
      duration,
      complete: resolve,
      cancel: () => reject(new Error('camera flight cancelled')),
    })
  })

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
    }),
    begin: async (request: BeginRequest) => {
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

        if (request.camera.fromHeight) {
          viewer.camera.setView({ destination: Cartesian3.fromDegrees(request.camera.lon, request.camera.lat, request.camera.fromHeight) })
          await wait(2500)
          startRecorder()
          await fly(request.camera, request.flyDurationSec ?? 6)
          startOrbit(request.camera, request.orbitDegPerSec)
        } else {
          await fly(request.camera, request.flyDurationSec ?? 3)
          await wait((request.settleSec ?? 4) * 1000)
          for (const token of request.afterActions ?? []) await applyAction(token)
          if (request.afterActions?.length) await wait((request.actionWaitSec ?? 5) * 1000)
          startOrbit(request.camera, request.orbitDegPerSec)
          startRecorder()
        }
        return {}
      } catch (error) {
        stopOrbit?.()
        if (recorder?.state === 'recording') {
          recorder.stop()
          await stopped
        }
        recorder = null
        stopped = null
        chunks = []
        throw error
      }
    },
    finish: async (request: FinishRequest) => {
      stopOrbit?.()
      recorder!.stop()
      await stopped
      const scene = captureState(viewer, {
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
          warnings: request.warnings,
        }),
      }
    },
    drain: async () => {
      const blob = chunks.shift()
      if (!blob) {
        recorder = null
        stopped = null
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
