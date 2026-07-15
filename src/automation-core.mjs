const OPS = new Set(['status', 'begin', 'finish', 'drain'])

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function stringList(value, name) {
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))) {
    throw new TypeError(`${name} must be an array of strings`)
  }
}

/** Validate the public browser boundary before it touches DOM, Cesium, or MediaRecorder. */
export function validateAutomationRequest(request) {
  if (!request || typeof request !== 'object' || !OPS.has(request.op)) {
    throw new TypeError('automation request op must be status, begin, finish, or drain')
  }
  if (request.op === 'begin') {
    const c = request.camera
    if (!c || !finite(c.lon) || c.lon < -180 || c.lon > 180 ||
        !finite(c.lat) || c.lat < -90 || c.lat > 90 ||
        !finite(c.height) || c.height <= 0) {
      throw new TypeError('begin requires camera lon/lat/height in range')
    }
    for (const key of ['headingDeg', 'pitchDeg', 'fromHeight']) {
      if (c[key] !== undefined && !finite(c[key])) throw new TypeError(`camera.${key} must be finite`)
    }
    if (c.fromHeight !== undefined && c.fromHeight <= 0) throw new TypeError('camera.fromHeight must be positive')
    for (const key of ['orbitDegPerSec', 'settleSec', 'flyDurationSec', 'actionWaitSec']) {
      if (request[key] !== undefined && (!finite(request[key]) || request[key] < 0)) {
        throw new TypeError(`${key} must be a non-negative number`)
      }
    }
    if (request.style !== undefined && typeof request.style !== 'string') throw new TypeError('style must be a string')
    if (request.presentation !== undefined && !['analyst', 'story'].includes(request.presentation)) {
      throw new TypeError('presentation must be analyst or story')
    }
    stringList(request.actions, 'actions')
    stringList(request.afterActions, 'afterActions')
    if (request.quality !== undefined) {
      const { resolutionScale, maximumScreenSpaceError } = request.quality
      if (!finite(resolutionScale) || resolutionScale <= 0 ||
          !finite(maximumScreenSpaceError) || maximumScreenSpaceError <= 0) {
        throw new TypeError('quality requires positive resolutionScale and maximumScreenSpaceError')
      }
    }
  }
  return request
}

/** Small state machine so every caller gets the same lifecycle and failure behavior. */
export function createAutomationLifecycle(handlers) {
  let phase = 'idle'
  return async (raw) => {
    const request = validateAutomationRequest(raw)
    if (request.op === 'status') {
      return { schema: 'godseye-automation/v1', ok: true, phase, ...handlers.status() }
    }
    if (request.op === 'begin') {
      if (phase !== 'idle') throw new Error(`begin requires idle state; current state is ${phase}`)
      const result = await handlers.begin(request)
      phase = 'recording'
      return { schema: 'godseye-automation/v1', ok: true, phase, ...result }
    }
    if (request.op === 'finish') {
      if (phase !== 'recording') throw new Error(`finish requires recording state; current state is ${phase}`)
      let result
      try {
        result = await handlers.finish(request)
      } finally {
        // The recorder may already be stopped even if evidence validation fails; keep chunks drainable.
        phase = 'draining'
      }
      return { schema: 'godseye-automation/v1', ok: true, phase, ...result }
    }
    if (phase !== 'draining') throw new Error(`drain requires draining state; current state is ${phase}`)
    const chunk = await handlers.drain()
    if (chunk === null) phase = 'idle'
    return chunk
  }
}
