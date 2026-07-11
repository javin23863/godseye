// Traffic smoke: fly to London, scan the view, expect vehicles moving.
// Usage: node scripts/verify-traffic.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.TRAFFIC_SHOT ?? 'traffic-verify.png'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90_000 })
await new Promise((r) => setTimeout(r, 10_000))

// London city, Tower Bridge POI (chips are city-scoped; select LONDON = index 2)
await page.select('#city-select', 'LONDON')
await page.evaluate(() => {
  const chip = [...document.querySelectorAll('#poi-chips button')].find((b) => b.textContent?.includes('Tower Bridge'))
  chip?.click()
})
await new Promise((r) => setTimeout(r, 8_000)) // flyTo + tiles

await page.click('#traffic-scan')
// Overpass can take a while
await page.waitForFunction(
  () => (document.getElementById('status')?.textContent ?? '').startsWith('TRAFFIC:') &&
        !(document.getElementById('status')?.textContent ?? '').includes('QUERYING'),
  { timeout: 60_000 },
)
const statusText = await page.evaluate(() => document.getElementById('status')?.textContent)
await new Promise((r) => setTimeout(r, 5_000)) // let particles move
await page.screenshot({ path: SHOT })
await browser.close()

console.log('status:', statusText)
if (errors.length || !/^TRAFFIC: \d+ VEHICLES/.test(statusText ?? '')) {
  console.error('TRAFFIC VERIFY FAILED:', errors.join('; ') || statusText)
  process.exit(1)
}
console.log('TRAFFIC VERIFY OK — screenshot:', SHOT)
