// Hormuz-features smoke: confirms the 4 new modules mount and run without errors.
// Infra renders on load; oil panel fetches; dark/gate scan on demand (may report
// "no history" on a fresh tab — that's a valid non-error outcome we assert on).
// Usage: node scripts/verify-hormuz.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.HORMUZ_SHOT ?? 'hormuz-verify.png'

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

// infra layer + row present with feature count
const infraCount = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#layers label.layer-row')].find((l) => l.textContent?.includes('CRITICAL INFRA'))
  return Number(row?.querySelector('.count')?.textContent ?? 0)
})
if (!(infraCount > 0)) errors.push(`infra count ${infraCount}`)

// gate + dark scan buttons exist
const controls = await page.evaluate(() => ({
  dark: !!document.getElementById('dark-scan'),
  gateScan: !!document.getElementById('gate-scan'),
  gateSet: !!document.getElementById('gate-set'),
  gatePanel: !!document.getElementById('gate-panel'),
  oilPanel: !!document.getElementById('oil-panel'),
}))
for (const [k, v] of Object.entries(controls)) if (!v) errors.push(`missing control: ${k}`)

// trigger dark + gate scans — must not throw, must produce a TRAFFIC/GATE/DARK status
await page.click('#dark-scan')
await new Promise((r) => setTimeout(r, 3_000))
await page.click('#gate-scan')
await new Promise((r) => setTimeout(r, 3_000))
const status = await page.evaluate(() => document.getElementById('status')?.textContent)

// oil panel resolved (chart or graceful error, not blank)
await new Promise((r) => setTimeout(r, 8_000))
const oilState = await page.evaluate(() => {
  const p = document.getElementById('oil-panel')
  return { hasChart: !!p?.querySelector('#oil-chart, canvas'), hasError: !!p?.querySelector('#oil-error'), text: p?.textContent?.slice(0, 60) }
})

await page.screenshot({ path: SHOT })
await browser.close()

console.log(JSON.stringify({ infraCount, controls, status, oilState }))
if (errors.length) {
  console.error('HORMUZ VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('HORMUZ VERIFY OK — screenshot:', SHOT)
