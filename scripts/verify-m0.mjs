// M0 smoke: drives the built app in headless Edge, checks exit criteria observable
// without keys (fallback basemap active, quakes rendered, no page errors), screenshots.
// Usage: node scripts/verify-m0.mjs [url] (default http://localhost:4321)
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.M0_SHOT ?? 'm0-verify.png'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
// Optional TLE cache seed (CelesTrak throttles group downloads to ~1/2h per IP,
// so CI-ish runs exercise the localStorage cache path instead of the network).
if (process.env.M0_TLE_FILE) {
  const text = await (await import('node:fs/promises')).readFile(process.env.M0_TLE_FILE, 'utf-8')
  await page.evaluateOnNewDocument(
    (payload) => localStorage.setItem('godseye-tle-active', payload),
    JSON.stringify({ at: Date.now(), text }),
  )
}
const logs = []
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90_000 })
// every layer row shows a count once its first fetch lands
try {
  await page.waitForFunction(
    () => {
      const rows = document.querySelectorAll('#layers label.layer-row .count')
      return rows.length > 0 && [...rows].every((c) => /\d/.test(c.textContent ?? ''))
    },
    { timeout: 120_000 },
  )
} catch {
  console.warn('timeout waiting for all layer counts — reporting partial state')
}
// let imagery tiles stream in
await new Promise((r) => setTimeout(r, 20_000))

const state = await page.evaluate(() => ({
  activeBasemap: document.querySelector('#basemaps button.active')?.textContent ?? null,
  layers: Object.fromEntries(
    [...document.querySelectorAll('#layers label.layer-row')].map((l) => [
      l.textContent?.replace(/\d+\s*$/, '').trim(),
      Number(l.querySelector('.count')?.textContent ?? 0),
    ]),
  ),
}))
await page.screenshot({ path: SHOT })
await browser.close()

const problems = []
if (!state.activeBasemap) problems.push('no active basemap button')
for (const [name, n] of Object.entries(state.layers)) if (!(n > 0)) problems.push(`layer ${name}: 0 entities`)
const pageErrors = logs.filter((l) => l.startsWith('pageerror'))
if (pageErrors.length) problems.push(...pageErrors)

console.log(JSON.stringify(state))
console.log('console (errors/warnings):')
for (const l of logs.filter((l) => /^(error|warning|pageerror)/.test(l))) console.log(' ', l)
console.log('screenshot:', SHOT)
if (problems.length) {
  console.error('M0 VERIFY FAILED:', problems.join('; '))
  process.exit(1)
}
console.log('M0 VERIFY OK')
