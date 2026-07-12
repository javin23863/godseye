// M2 smoke: cycles every style preset via its hotkey and screenshots each.
// Fails if the shader stage throws (Cesium disables the stage and logs an error).
// Usage: node scripts/verify-styles.mjs [url]
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
  // network noise (feed throttles/outages) is verify-m0's concern; here only shader/runtime errors matter
  if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90_000 })
await new Promise((r) => setTimeout(r, 15_000)) // let the globe render

const presets = ['NORMAL', 'CRT', 'NVG', 'FLIR', 'ANIME', 'NOIR', 'IRONBOW', 'DUSK', 'CINEMA']
for (let i = 0; i < presets.length; i++) {
  await page.keyboard.press(String(i + 1))
  await new Promise((r) => setTimeout(r, 2_500))
  const active = await page.evaluate(() => document.getElementById('style-name')?.textContent)
  if (active !== presets[i]) errors.push(`preset ${presets[i]}: ACTIVE STYLE shows ${active}`)
  await page.screenshot({ path: `${OUT}/style_${presets[i].toLowerCase()}.png` })
}
await browser.close()

if (errors.length) {
  console.error('STYLE VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('STYLE VERIFY OK —', presets.length, 'presets cycled, screenshots in', OUT)
