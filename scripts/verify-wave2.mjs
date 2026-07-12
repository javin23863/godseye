// Wave 2 smoke: GIBS imagery rows + date, imaging-pass scheduler, GDELT news scan,
// kiosk mode, saved boards, global infra + submarine cables. Zero pageerrors required.
// Usage: node scripts/verify-wave2.mjs [url]   (vite preview so /feeds/* proxies live)
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
await new Promise((r) => setTimeout(r, 12_000))

const controls = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#layers .layer-row')].map((r) => r.textContent ?? '')
  const has = (name) => rows.some((t) => t.includes(name))
  return {
    gibsRows: rows.filter((t) => t.includes('GIBS')).length, // 3 imagery overlays
    gibsDate: !!document.querySelector('.gibs-date input[type=date]'),
    passScan: !!document.getElementById('pass-scan'),
    newsRow: has('NEWS HOTSPOTS'),
    newsScan: !!document.getElementById('news-scan'),
    newsQuery: !!document.getElementById('news-query'),
    kioskToggle: !!document.getElementById('kiosk-toggle'),
    boardsPanel: !!document.getElementById('boards'),
    ginfraRow: has('GLOBAL INFRA'),
    cablesRow: has('SUBMARINE CABLES'),
    cableLoad: !!document.getElementById('cable-load'),
  }
})
if (controls.gibsRows !== 3) errors.push(`expected 3 GIBS rows, got ${controls.gibsRows}`)
for (const [k, v] of Object.entries(controls)) if (!v) errors.push(`missing control: ${k}`)

// passes: empty TLE cache -> deterministic honest message
await page.click('#pass-scan')
const passText = await page.evaluate(() => document.getElementById('pass-list')?.textContent ?? '')
if (!/NO TLEs/i.test(passText)) errors.push(`pass-list without TLE cache: "${passText}"`)

// boards: save -> row appears -> load flies without throwing
await page.type('#board-name', 'smoke test')
await page.click('#board-save')
await new Promise((r) => setTimeout(r, 500))
const boardRow = await page.evaluate(() => document.querySelector('#boards-list .board-load')?.textContent ?? '')
if (boardRow !== 'smoke test') errors.push(`board not saved: "${boardRow}"`)
await page.click('#boards-list .board-load')
await new Promise((r) => setTimeout(r, 1_000))

// cables: LOAD via /feeds/cables proxy -> real segment count
await page.click('#cable-load')
await new Promise((r) => setTimeout(r, 15_000))
const cableStatus = await page.evaluate(() => document.getElementById('status')?.textContent ?? '')
const cableCount = Number((/(\d+) SEGMENTS/.exec(cableStatus) ?? [])[1] ?? 0)
if (cableCount < 100) errors.push(`cables: "${cableStatus}"`)

// news: SCAN via /feeds/gdelt proxy -> hotspots or an honest no-match/unavailable line
await page.click('#news-scan')
await new Promise((r) => setTimeout(r, 20_000))
const newsStatus = await page.evaluate(() => document.getElementById('status')?.textContent ?? '')
if (!newsStatus.startsWith('NEWS:')) errors.push(`news status: "${newsStatus}"`)

// kiosk: K enters (ticker shows a stop), K exits — fullscreen may reject headless, that's caught
await page.keyboard.press('k')
await new Promise((r) => setTimeout(r, 1_500))
const kiosk = await page.evaluate(() => ({
  on: document.body.classList.contains('kiosk'),
  ticker: document.getElementById('kiosk-ticker')?.textContent ?? '',
}))
if (!kiosk.on) errors.push('kiosk did not engage on K')
if (!kiosk.ticker) errors.push('kiosk ticker empty')
await page.keyboard.press('k')
await new Promise((r) => setTimeout(r, 500))
const kioskOff = await page.evaluate(() => !document.body.classList.contains('kiosk'))
if (!kioskOff) errors.push('kiosk did not exit on K')

await browser.close()
console.log(JSON.stringify({ controls, passText, boardRow, cableStatus, newsStatus, kiosk }))
if (errors.length) {
  console.error('WAVE2 VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('WAVE2 VERIFY OK')
