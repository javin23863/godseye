// Visual-richness smoke: boot splash present, panel scrolls, night-side city lights,
// oriented glyphs + glow trails after two military polls. Screenshots for eyeball verify.
// Usage: node scripts/verify-visuals.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = process.env.STYLE_SHOT_DIR ?? '.'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })

// boot splash must exist early and be gone later
const bootSeen = await page.evaluate(() => !!document.getElementById('boot'))
await new Promise((r) => setTimeout(r, 15_000))
if (!bootSeen) errors.push('boot splash never appeared')
if (await page.evaluate(() => !!document.getElementById('boot'))) errors.push('boot splash never removed')

// panel must scroll, not overflow the viewport
const panelOk = await page.evaluate(() => {
  const p = document.getElementById('panel')
  return p.scrollHeight >= p.clientHeight && p.getBoundingClientRect().bottom <= innerHeight
})
if (!panelOk) errors.push('layer panel overflows viewport')

// scene flags + night-lights layer, straight off the viewer
const scene = await page.evaluate(() => {
  const v = window.__viewer
  const layers = []
  for (let i = 0; i < v.imageryLayers.length; i++) layers.push(v.imageryLayers.get(i).nightAlpha)
  return {
    lighting: v.scene.globe.enableLighting,
    hdr: v.scene.highDynamicRange,
    msaa: v.scene.msaaSamples,
    shadows: v.shadowMap.enabled && v.shadowMap.softShadows,
    bloom: v.scene.postProcessStages.bloom.enabled,
    nightLayer: layers.some((a) => a === 1),
  }
})
for (const [k, ok] of Object.entries(scene)) if (!ok && k !== 'msaa') errors.push(`scene.${k} not enabled`)
if (scene.msaa !== 4) errors.push(`msaa ${scene.msaa} != 4`)

// quake pulse rings render on the first refresh (M4+ quakes are a near-certainty in any 24h window)
const rings = await page.evaluate(
  () =>
    window.__viewer.dataSources
      .getByName('earthquakes')[0]
      .entities.values.filter((e) => e.id.endsWith('-ring')).length,
)
if (rings === 0) errors.push('no quake impact rings')

// fly to the night side (Tokyo is dark at the 13-14Z verify window) for Black Marble lights
await page.type('#search-box', 'Tokyo')
await page.keyboard.press('Enter')
await new Promise((r) => setTimeout(r, 12_000))
await page.screenshot({ path: `${OUT}/visuals_night_tokyo.png` })

// two more military polls -> glow trails on moving aircraft
await new Promise((r) => setTimeout(r, 135_000))
const trails = await page.evaluate(
  () =>
    window.__viewer.dataSources
      .getByName('military')[0]
      .entities.values.filter((e) => e.id.endsWith('-trail')).length,
)
if (trails === 0) errors.push('no military glow trails after two polls')
console.log(`rings=${rings} trails=${trails}`)
await page.screenshot({ path: `${OUT}/visuals_trails.png` })
await browser.close()

if (errors.length) {
  console.error('VISUALS VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('VISUALS VERIFY OK — screenshots in', OUT)
