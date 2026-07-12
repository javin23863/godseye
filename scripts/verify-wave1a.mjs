// Wave 1a smoke: tripwires+sentinel (CAP-22), cross-layer fusion, pattern-of-life.
// Confirms the three modules mount their rows/controls, a fusion scan runs without
// throwing, and there are zero pageerrors. Usage: node scripts/verify-wave1a.mjs [url]
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

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90_000 })
await new Promise((r) => setTimeout(r, 10_000))

const rows = await page.evaluate(() =>
  [...document.querySelectorAll('#layers label.layer-row')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
)
const has = (name) => rows.some((r) => r.startsWith(name))
for (const n of ['TRIPWIRES', 'FUSION']) if (!has(n)) errors.push(`missing row: ${n}`)

const controls = await page.evaluate(() => ({
  twArm: !!document.getElementById('tw-arm'),
  twPreset: !!document.getElementById('tw-preset'),
  twAdd: !!document.getElementById('tw-add'),
  twPresetOptions: document.getElementById('tw-preset')?.options.length ?? 0,
  fusionScan: !!document.getElementById('fusion-scan'),
}))
for (const [k, v] of Object.entries(controls)) if (!v) errors.push(`missing/empty control: ${k}`)

// fusion scan must run without throwing (honest "not enough activity" on a fresh session is fine)
await page.click('#fusion-scan')
await new Promise((r) => setTimeout(r, 4_000))
const fusionStatus = await page.evaluate(() => document.getElementById('status')?.textContent)
if (!/FUSION/i.test(fusionStatus ?? '')) errors.push(`unexpected status after fusion scan: ${fusionStatus}`)

await browser.close()
console.log(JSON.stringify({ rows, controls, fusionStatus }))
if (errors.length) {
  console.error('WAVE1A VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('WAVE1A VERIFY OK')
