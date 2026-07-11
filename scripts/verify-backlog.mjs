// Backlog-features smoke: GPS-jamming (CAP-21), satellite AOI lines (CAP-12),
// CCTV mesh (CAP-20). Confirms the three modules mount, their rows/controls
// render, a GPS-jam scan runs without throwing, and CCTV markers are present.
// SAT AOI LINES needs live TLEs to draw access lines — if CelesTrak is throttling
// this IP (its documented 2h window) the SATELLITES layer also reads 0; that's a
// network state, not a code fault, so we assert on mount + controls, not line count.
// Usage: node scripts/verify-backlog.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.BACKLOG_SHOT ?? 'backlog-verify.png'

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
await new Promise((r) => setTimeout(r, 12_000))

const rows = await page.evaluate(() =>
  [...document.querySelectorAll('#layers label.layer-row')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
)
const has = (name) => rows.some((r) => r.startsWith(name))
if (!has('GPS JAMMING')) errors.push('missing row: GPS JAMMING')
if (!has('SAT AOI LINES')) errors.push('missing row: SAT AOI LINES')
if (!has('CCTV MESH')) errors.push('missing row: CCTV MESH')

const controls = await page.evaluate(() => ({
  jamScan: !!document.getElementById('jam-scan'),
  maskInput: !!document.querySelector('#layers input[type=range]'),
  cctvCoverage: !!document.getElementById('cctv-coverage'),
  cctvDrape: !!document.getElementById('cctv-drape'),
}))
for (const [k, v] of Object.entries(controls)) if (!v) errors.push(`missing control: ${k}`)

// CCTV markers rendered on load (count in the row cell)
const cctvCount = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#layers label.layer-row')].find((l) => l.textContent?.includes('CCTV MESH'))
  return Number(row?.querySelector('.count')?.textContent ?? 0)
})
if (!(cctvCount > 0)) errors.push(`CCTV markers ${cctvCount}`)

// GPS-jam scan must run without throwing and leave a GPS JAM status
await page.click('#jam-scan')
await new Promise((r) => setTimeout(r, 6_000))
const jamStatus = await page.evaluate(() => document.getElementById('status')?.textContent)
if (!/GPS JAM/i.test(jamStatus ?? '')) errors.push(`unexpected status after jam scan: ${jamStatus}`)
// toggle CCTV coverage + drape (renders wedge polygons/polylines) — sets its own status
await page.click('#cctv-coverage')
await page.click('#cctv-drape')
await new Promise((r) => setTimeout(r, 1_500))
const status = await page.evaluate(() => document.getElementById('status')?.textContent)

await page.screenshot({ path: SHOT })
await browser.close()

console.log(JSON.stringify({ rows, controls, cctvCount, status }))
if (errors.length) {
  console.error('BACKLOG VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('BACKLOG VERIFY OK — screenshot:', SHOT)
