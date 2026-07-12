// Windy Map-Forecast live check (needs WINDY_MAP_KEY in .env so /feeds/windymap serves).
// Clicks WEATHER MAP, asserts the panel opens, the keyed iframe page boots windyInit
// (title flips to WINDY-MAP-OK only when Windy accepts the key), and Leaflet rendered.
// Usage: node scripts/verify-windymap.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90_000 })
await new Promise((r) => setTimeout(r, 11_000))

const hasBtn = await page.evaluate(() => !!document.getElementById('windy-map-toggle'))
if (!hasBtn) errors.push('missing windy-map-toggle button')

await page.click('#windy-map-toggle')
await new Promise((r) => setTimeout(r, 20_000)) // libBoot + leaflet + first tiles

const out = await page.evaluate(() => ({
  status: document.getElementById('status')?.textContent ?? '',
  panelShown: document.getElementById('windy-map')?.style.display === 'block',
}))
const frame = page.frames().find((f) => f.url().includes('/feeds/windymap'))
if (!frame) errors.push('windy map iframe not loaded')
const inner = frame
  ? await frame.evaluate(() => ({
      title: document.title,
      leaflet: !!document.querySelector('#windy .leaflet-container, #windy canvas'),
    }))
  : { title: '', leaflet: false }

if (/NO KEY/.test(out.status)) errors.push('proxy reported NO KEY — WINDY_MAP_KEY not loaded')
if (!out.panelShown) errors.push('panel did not open')
if (inner.title !== 'WINDY-MAP-OK') errors.push(`windyInit callback never fired (key rejected?) title="${inner.title}"`)
if (!inner.leaflet) errors.push('no leaflet/canvas rendered inside iframe')

await browser.close()
console.log(JSON.stringify({ ...out, ...inner }))
if (errors.length) {
  console.error('WINDYMAP VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('WINDYMAP VERIFY OK')
