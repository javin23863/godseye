// Deterministic Story-mode closeout proof at the two TraderCockpit target aspects.
// Produces three 6-15 second landscape clips, one still per beat, vertical proofs,
// and a JSON receipt. Live feed contents are never an acceptance dependency.
// Usage: npm run verify:story -- [url]
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://127.0.0.1:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.resolve(process.env.STORY_PROOF_DIR ?? path.join(process.env.TEMP ?? '.', 'godseye-story-proof'))
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const archetypes = [
  {
    id: 'geopolitical-supply-shock',
    lon: 56.25,
    lat: 26.56,
    layers: [
      ['ships', 'SHIPS'],
      ['gate', 'HORMUZ GATE'],
      ['darkvessel', 'DARK VESSELS'],
      ['infra', 'CRITICAL INFRA'],
    ],
    claim: { text: 'Maritime exposure is shown at the Strait of Hormuz.', kind: 'observation', sourceKeys: ['ships', 'gate'] },
  },
  {
    id: 'natural-disaster',
    lon: -120.65,
    lat: 35.36,
    layers: [
      ['fires', 'ACTIVE FIRES'],
      ['alerts', 'WX ALERTS (US)'],
      ['outages', 'NET OUTAGES'],
      ['ginfra', 'GLOBAL INFRA'],
    ],
    claim: { text: 'Hazard observations are placed beside weather, outage, and infrastructure context.', kind: 'observation', sourceKeys: ['fires', 'alerts'] },
  },
  {
    id: 'airspace-security',
    lon: 55.27,
    lat: 25.2,
    layers: [
      ['military', 'MILITARY'],
      ['gpsjam', 'GPS JAMMING'],
      ['aoi', 'SAT AOI LINES'],
      ['zones', 'CONFLICT ZONES'],
    ],
    claim: { text: 'Airspace security context combines raw tracks with explicitly derived signals.', kind: 'inference', sourceKeys: ['military', 'gpsjam'] },
  },
]

await mkdir(OUT, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('Failed to load resource')) pageErrors.push(message.text())
})

const automation = (request) => page.evaluate((value) => window.godseyeAutomationV1(value), request)
const status = () => automation({ op: 'status' })
const readState = () => page.evaluate(() => ({
  presentation: document.body.dataset.presentation ?? null,
  cleanUi: document.body.classList.contains('clean-ui'),
  style: document.getElementById('style-name')?.textContent?.trim() ?? null,
  basemap: document.querySelector('#basemaps button.active')?.dataset.mode ?? null,
  bloom: document.getElementById('fx-bloom')?.checked ?? null,
  sharpen: document.getElementById('fx-sharpen')?.value ?? null,
  pixelate: document.getElementById('fx-pixelate')?.value ?? null,
  resolutionScale: window.__viewer.resolutionScale,
  lighting: window.__viewer.scene.globe.enableLighting,
  screenSpaceErrors: [...Array(window.__viewer.scene.primitives.length).keys()]
    .map((index) => window.__viewer.scene.primitives.get(index)?.maximumScreenSpaceError)
    .filter((value) => typeof value === 'number'),
  orbit: document.getElementById('orbit-toggle')?.classList.contains('active') ?? false,
  layers: [...document.querySelectorAll('#layers label.layer-row')]
    .map((row) => [row.dataset.layer, row.querySelector('input[type=checkbox]')?.checked ?? false]),
}))
const restoreLayers = (layers) => page.evaluate((wanted) => {
  const states = new Map(wanted)
  for (const row of document.querySelectorAll('#layers label.layer-row')) {
    const box = row.querySelector('input[type=checkbox]')
    const checked = states.get(row.dataset.layer)
    if (box && typeof checked === 'boolean' && box.checked !== checked) box.click()
  }
}, layers)
const drain = async () => {
  const buffers = []
  for (;;) {
    const chunk = await automation({ op: 'drain' })
    if (chunk === null) break
    buffers.push(Buffer.from(chunk, 'base64'))
  }
  return Buffer.concat(buffers)
}
const inspectVideo = (file) => {
  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=nb_read_frames', '-show_entries', 'packet=pts_time',
    '-of', 'json', file,
  ], { encoding: 'utf8' }))
  const timestamps = probe.packets.map(({ pts_time }) => Number(pts_time)).filter(Number.isFinite)
  const frames = Number(probe.streams[0]?.nb_read_frames ?? 0)
  const durationSec = timestamps.at(-1) - timestamps[0]
  const fps = (frames - 1) / durationSec
  return { durationSec, frames, fps }
}
const addMarker = (fixture) => page.evaluate(({ id, lon, lat }) => {
  const viewer = window.__viewer
  window.__storyProofMarker && viewer.entities.remove(window.__storyProofMarker)
  const position = viewer.scene.globe.ellipsoid.cartographicToCartesian({
    longitude: lon * Math.PI / 180,
    latitude: lat * Math.PI / 180,
    height: 1_500,
  })
  window.__storyProofMarker = viewer.entities.add({
    id: `story-proof-${id}`,
    position,
    point: { pixelSize: 20, outlineWidth: 4 },
    label: { text: 'PRIMARY OBSERVATION', font: '600 15px Segoe UI' },
  })
}, fixture)
const removeMarker = () => page.evaluate(() => {
  if (window.__storyProofMarker) window.__viewer.entities.remove(window.__storyProofMarker)
  delete window.__storyProofMarker
})
const setGoldenBeat = (beat) => page.evaluate((name) => {
  document.getElementById('story-proof-beat')?.remove()
  if (name === 'proof') return
  const style = document.createElement('style')
  style.id = 'story-proof-beat'
  style.textContent = name === 'signal'
    ? '#story-source-list b:not(:first-child){opacity:0!important}#story-overlay::before{animation:none!important;opacity:0!important}'
    : '#story-source-list b{opacity:1!important;transform:none!important}#story-overlay::before{animation:none!important;opacity:.72!important;transform:scale(1)!important;border-width:2px!important}'
  document.head.appendChild(style)
}, beat)

try {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForFunction(() => window.godseyeAutomationV1 && window.__viewer && !document.getElementById('boot'), { timeout: 90_000 })
  assert.deepEqual((await status()).presentations, ['analyst', 'story'])

  const captureFps = await page.evaluate(() => {
    const stream = window.__viewer.scene.canvas.captureStream(30)
    const frameRate = stream.getVideoTracks()[0]?.getSettings().frameRate ?? 0
    for (const track of stream.getTracks()) track.stop()
    return frameRate
  })
  assert.ok(captureFps >= 30, `captureStream requested 30fps but reported ${captureFps}`)

  // A missing-source frame must fail before MediaRecorder starts and return to idle.
  const beforeInvalid = await readState()
  await page.evaluate(() => {
    for (const box of document.querySelectorAll('#layers label.layer-row input[type=checkbox]')) if (box.checked) box.click()
  })
  await assert.rejects(
    automation({
      op: 'begin', presentation: 'story', camera: { lon: 0, lat: 0, height: 500_000, pitchDeg: -90 },
      flyDurationSec: 0.1, settleSec: 0.2,
    }),
    /not capture-ready|no active registered source/,
  )
  assert.equal((await status()).phase, 'idle', 'invalid Story frame entered recording state')
  await restoreLayers(beforeInvalid.layers)

  // Unsafe camera fallback plus a rejected claim exercise failure/cancellation restoration.
  const beforeFallback = await readState()
  const fallback = await automation({
    op: 'begin', presentation: 'story', camera: { lon: 56.25, lat: 26.56, height: 1, pitchDeg: -90 },
    actions: ['layer:SHIPS'], flyDurationSec: 0.1, settleSec: 0.3,
  })
  assert.equal(fallback.readiness.ready, true)
  assert.equal(fallback.readiness.fallbackApplied, true)
  await assert.rejects(
    automation({ op: 'finish', claims: [{ text: 'Unsupported cancellation probe.', kind: 'observation', sourceKeys: ['alerts'] }] }),
    /outside captured scene/,
  )
  assert.equal((await status()).phase, 'draining')
  await drain()
  assert.deepEqual(await readState(), beforeFallback, 'failed/cancelled capture did not restore Analyst state')

  // The failure probes intentionally churn Cesium's private tile queues. Public
  // state is restored above; use a fresh renderer for deterministic golden frames.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.waitForFunction(() => window.godseyeAutomationV1 && window.__viewer && !document.getElementById('boot'), { timeout: 90_000 })

  const receipts = []
  for (const viewport of [
    { name: 'landscape', width: 1920, height: 1080, reducedMotion: false },
    { name: 'vertical', width: 1080, height: 1920, reducedMotion: true },
  ]) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: viewport.reducedMotion ? 'reduce' : 'no-preference' }])
    if (viewport.name === 'vertical') {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 })
      await page.waitForFunction(() => window.godseyeAutomationV1 && window.__viewer && !document.getElementById('boot'), { timeout: 90_000 })
    }

    for (const fixture of archetypes) {
      await addMarker(fixture)
      const before = await readState()
      const layerLabels = fixture.layers.map(([, label]) => label)
      const layerKeys = fixture.layers.map(([key]) => key)
      const clipName = `${fixture.id}.webm`
      const begun = await automation({
        op: 'begin',
        presentation: 'story',
        camera: { lon: fixture.lon, lat: fixture.lat, height: 2_500_000, headingDeg: 0, pitchDeg: -90 },
        actions: layerLabels.map((label) => `layer:${label}`),
        orbitDegPerSec: viewport.reducedMotion ? 0 : 0.25,
        flyDurationSec: 0.2,
        settleSec: 0.8,
        quality: { resolutionScale: 1, maximumScreenSpaceError: 8 },
      })
      assert.equal(begun.presentation, 'story')
      assert.equal(begun.readiness.ready, true)
      assert.notEqual(begun.readiness.checks.tiles, 'fail')
      assert.equal(begun.readiness.checks.sources, 'pass')
      assert.equal(begun.readiness.checks.overlays, 'pass')
      assert.equal(begun.readiness.checks.contrast, 'pass')

      const live = await page.evaluate(() => {
        const viewer = window.__viewer
        const marker = window.__storyProofMarker
        const position = marker?.position?.getValue(viewer.clock.currentTime)
        const screen = position && viewer.scene.cartesianToCanvasCoordinates(position)
        const chrome = ['#panel', '#style-dock', '#status', '#timeline', '#hud-tl', '#hud-bl', '#gate-panel', '#oil-panel', '#pol-panel', '#share-bar', '#brief-btn', '#analyst']
          .filter((selector) => document.querySelector(selector))
          .map((selector) => [selector, getComputedStyle(document.querySelector(selector)).display])
        const overlay = document.getElementById('story-overlay')
        return {
          activeLayers: [...document.querySelectorAll('#layers label.layer-row')]
            .filter((row) => row.querySelector('input[type=checkbox]')?.checked)
            .map((row) => row.dataset.layer),
          sources: [...document.querySelectorAll('#story-source-list b')].map((item) => item.textContent),
          sourceVisibility: [...document.querySelectorAll('#story-source-list b')]
            .map((item) => ({ opacity: Number(getComputedStyle(item).opacity), bounds: item.getBoundingClientRect().toJSON() })),
          presentation: document.body.dataset.presentation,
          cleanUi: document.body.classList.contains('clean-ui'),
          style: document.getElementById('style-name')?.textContent?.trim(),
          bloom: document.getElementById('fx-bloom')?.checked,
          sharpen: document.getElementById('fx-sharpen')?.value,
          pixelate: document.getElementById('fx-pixelate')?.value,
          lighting: viewer.scene.globe.enableLighting,
          overlayVisible: getComputedStyle(overlay).display !== 'none' && overlay.getAttribute('aria-hidden') === 'false',
          chrome,
          point: screen ? { x: screen.x, y: screen.y } : null,
          pulseAnimation: getComputedStyle(overlay, '::before').animationName,
        }
      })
      assert.deepEqual([...live.activeLayers].sort(), [...layerLabels].sort(), `${fixture.id} inherited unrelated layers`)
      assert.ok(live.activeLayers.length >= 1 && live.activeLayers.length <= 4)
      assert.deepEqual(live.sources, layerLabels)
      if (viewport.reducedMotion) {
        assert.ok(live.sourceVisibility.every(({ opacity, bounds }) => opacity > 0.9 && bounds.width > 0 && bounds.height > 0),
          `reduced-motion Story source is not visible: ${JSON.stringify(live.sourceVisibility)}`)
      }
      assert.equal(live.presentation, 'story')
      assert.equal(live.cleanUi, true)
      assert.equal(live.style, 'DUSK')
      assert.equal(live.bloom, true)
      assert.equal(live.sharpen, '0')
      assert.equal(live.pixelate, '0')
      assert.equal(live.lighting, false)
      assert.equal(live.overlayVisible, true)
      assert.ok(live.chrome.every(([, display]) => display === 'none'), `Analyst chrome visible: ${JSON.stringify(live.chrome)}`)
      assert.ok(live.point, `${fixture.id} primary observation is not visible`)
      assert.ok(live.point.x >= viewport.width * 0.1 && live.point.x <= viewport.width * 0.9 &&
        live.point.y >= viewport.height * 0.1 && live.point.y <= viewport.height * 0.7,
      `${fixture.id} primary observation is outside shared crop-safe region: ${JSON.stringify(live.point)}`)
      if (viewport.reducedMotion) assert.equal(live.pulseAnimation, 'none', 'reduced motion retained the source-lock pulse')

      const startedAt = Date.now()
      await wait(viewport.reducedMotion ? 1_600 : 6_200)
      const finished = await automation({
        op: 'finish',
        claims: [fixture.claim],
        artifacts: viewport.name === 'landscape'
          ? [{ name: clipName, uri: `artifact://${clipName}`, mediaType: 'video/webm' }]
          : [],
      })
      const recordingElapsedMs = Date.now() - startedAt

      // Screenshots are deliberately post-finish so slow PNG encoding cannot
      // stretch the 6-15 second product clip. Story remains visible until drain.
      if (!viewport.reducedMotion) {
        await setGoldenBeat('signal')
        await page.screenshot({ path: path.join(OUT, `${fixture.id}-signal.png`) })
        await setGoldenBeat('exposure')
        await page.screenshot({ path: path.join(OUT, `${fixture.id}-exposure.png`) })
        await setGoldenBeat('proof')
        await page.screenshot({ path: path.join(OUT, `${fixture.id}-proof.png`) })
      } else {
        await page.screenshot({ path: path.join(OUT, `${fixture.id}-vertical-proof.png`) })
      }
      assert.deepEqual(finished.scene.layers, layerKeys)
      assert.equal(finished.scene.v, 2)
      assert.equal(finished.scene.observedAt, finished.evidence.observedAt)
      assert.deepEqual(finished.evidence.scene, finished.scene)
      assert.deepEqual(finished.evidence.sources.map(({ key }) => key), layerKeys)
      assert.deepEqual(finished.evidence.claims, [fixture.claim])
      assert.ok(finished.evidence.warnings.every((warning) => !warning.includes('No provenance registered')))
      for (const warning of begun.readiness.warnings) assert.ok(finished.evidence.warnings.includes(warning))

      const video = await drain()
      assert.ok(video.length > 10_000, `${fixture.id} produced a blank/empty recording`)
      let encoded
      if (viewport.name === 'landscape') {
        const clipPath = path.join(OUT, clipName)
        await writeFile(clipPath, video)
        encoded = inspectVideo(clipPath)
        assert.ok(encoded.durationSec >= 6 && encoded.durationSec <= 15,
          `${fixture.id} encoded duration ${encoded.durationSec.toFixed(3)}s is outside 6-15s`)
        assert.ok(encoded.fps >= 30, `${fixture.id} encoded ${encoded.fps.toFixed(2)}fps is below 30fps`)
      }
      assert.equal((await status()).phase, 'idle')
      assert.deepEqual(await readState(), before, `${fixture.id} completion did not restore Analyst state`)
      await removeMarker()
      receipts.push({
        archetype: fixture.id,
        viewport: viewport.name,
        dimensions: [viewport.width, viewport.height],
        reducedMotion: viewport.reducedMotion,
        readiness: begun.readiness,
        observedAt: finished.scene.observedAt,
        layers: finished.scene.layers,
        sourceKeys: finished.evidence.sources.map(({ key }) => key),
        warnings: finished.evidence.warnings,
        primaryScreenPoint: live.point,
        recordingElapsedMs,
        ...(encoded ? { encoded } : {}),
        videoBytes: video.length,
      })
    }
  }

  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join(' | ')}`)
  const receipt = {
    schema: 'godseye-story-verification/v1',
    verifiedAt: new Date().toISOString(),
    url: URL,
    captureFps,
    archetypes: receipts,
  }
  await writeFile(path.join(OUT, 'verification-receipt.json'), JSON.stringify(receipt, null, 2))
  console.log(`STORY VERIFY OK — ${archetypes.length} archetypes × 2 aspects, capture ${captureFps}fps`)
  console.log(`Artifacts: ${OUT}`)
} finally {
  await browser.close()
}
