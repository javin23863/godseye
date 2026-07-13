// News-intel wave smoke: the 7 video-gap modules mount and run without errors.
// Zones render on load (hidden by default but counted); fires/alerts/outages/fin
// scan on demand; the live feed panel fetches GDELT+RSS; region intel arms and
// resolves a click to a report (template fallback when no LLM key — still a pass).
// Usage: node scripts/verify-newsint.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.NEWSINT_SHOT ?? 'newsint-verify.png'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('response', (r) => {
  if (r.url().includes('/feeds/rssnews') || r.url().includes('/feeds/newsdoc')) console.log('[net]', r.status(), r.url().slice(21, 60))
})
page.on('console', (m) => {
  if (m.type() === 'warning' && m.text().includes('newsfeed')) console.log('[warn]', m.text().slice(0, 160))
})

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90_000 })
await new Promise((r) => setTimeout(r, 12_000))

// zones rendered at load (curated data, no network)
const zonesCount = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#layers label.layer-row')].find((l) => l.textContent?.includes('CONFLICT ZONES'))
  return Number(row?.querySelector('.count')?.textContent ?? 0)
})
if (!(zonesCount >= 16)) errors.push(`zones count ${zonesCount}`)

// all new controls exist
const controls = await page.evaluate(() => ({
  feedToggle: !!document.getElementById('newsfeed-toggle'),
  firesScan: !!document.getElementById('fires-scan'),
  alertsScan: !!document.getElementById('alerts-scan'),
  outagesScan: !!document.getElementById('outages-scan'),
  finScan: !!document.getElementById('finstress-scan'),
  intelArm: !!document.getElementById('intel-arm'),
  finPanel: !!document.getElementById('finstress-panel'),
}))
for (const [k, v] of Object.entries(controls)) if (!v) errors.push(`missing control: ${k}`)

// live feed: toggle on, wait a fetch cycle, expect rows (or an honest empty state)
await page.click('#newsfeed-toggle')
await new Promise((r) => setTimeout(r, 10_000))
const feedRows = await page.evaluate(() => document.querySelectorAll('#newsfeed .newsfeed-row').length)
const feedItems = await page.evaluate(() => document.getElementById('newsfeed')?.dataset.items)
console.log(`feed rows=${feedRows} items=${feedItems}`)
if (feedRows === 0) errors.push(`news feed: 0 rows after fetch cycle (merged items=${feedItems})`)

// on-demand scans — each must resolve to a non-throwing status, counts may be 0 honestly
for (const [btn, row] of [
  ['#fires-scan', 'ACTIVE FIRES'],
  ['#alerts-scan', 'WX ALERTS (US)'],
  ['#outages-scan', 'NET OUTAGES'],
  ['#finstress-scan', 'FIN. STRESS'],
]) {
  await page.click(btn)
  await new Promise((r) => setTimeout(r, 8_000))
  const n = await page.evaluate((label) => {
    const r = [...document.querySelectorAll('#layers label.layer-row')].find((l) => l.textContent?.includes(label))
    return Number(r?.querySelector('.count')?.textContent ?? 0)
  }, row)
  console.log(`${row}: ${n}`)
  if (row === 'ACTIVE FIRES' && n === 0) errors.push('fires: 0 detections (feed empty or proxy broken)')
  if (row === 'FIN. STRESS' && n === 0) errors.push('finstress: 0/5 instruments (FRED proxy broken)')
}

// region intel: arm + click globe center -> panel appears with a report body
await page.click('#intel-arm')
await page.mouse.click(700, 450)
await new Promise((r) => setTimeout(r, 26_000)) // covers the module's 20s LLM deadline + fallback render
const intel = await page.evaluate(() => {
  const p = document.getElementById('regionintel')
  return { visible: p ? p.style.display !== 'none' : false, body: p?.querySelector('.regionintel-body')?.textContent?.length ?? 0 }
})
if (!intel.visible || intel.body < 40) errors.push(`region intel: visible=${intel.visible} bodyLen=${intel.body}`)

await page.screenshot({ path: SHOT })
await browser.close()

if (errors.length) {
  console.error('FAIL:\n' + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`OK — zones=${zonesCount}, feed rows=${feedRows}, intel body=${intel.body} chars. Shot: ${SHOT}`)
