// Windy webcam layer live check (needs WINDY_API_KEY in .env so the preview proxy registers).
// Flies to Nice (79 public cams), SCANs, asserts the key-injected /feeds/windy proxy returns
// real cams end-to-end (proxy -> normalize -> draw) and the preview host serves an image.
// Usage: node scripts/verify-windy.mjs [url]
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

// controls present
const has = await page.evaluate(() => ({
  row: [...document.querySelectorAll('#layers .layer-row')].some((r) => (r.textContent ?? '').includes('PUBLIC WEBCAMS')),
  scan: !!document.getElementById('webcam-scan'),
}))
if (!has.row) errors.push('missing PUBLIC WEBCAMS row')
if (!has.scan) errors.push('missing webcam-scan button')

// fly to Nice (dense cam coverage), then SCAN VIEW
await page.type('#search-box', 'Nice, France')
await page.keyboard.press('Enter')
await new Promise((r) => setTimeout(r, 6_000))
await page.click('#webcam-scan')
await new Promise((r) => setTimeout(r, 10_000))

const result = await page.evaluate(() => {
  const row = [...document.querySelectorAll('#layers .layer-row')].find((r) => (r.textContent ?? '').includes('PUBLIC WEBCAMS'))
  return {
    status: document.getElementById('status')?.textContent ?? '',
    count: Number(row?.querySelector('.count')?.textContent ?? '0'),
  }
})
if (!result.status.startsWith('WEBCAMS:')) errors.push(`status not WEBCAMS: "${result.status}"`)
if (/NO WINDY KEY/.test(result.status)) errors.push('proxy reported NO WINDY KEY — key not loaded by preview')
if (result.count < 1) errors.push(`no cams drawn (count=${result.count}) status="${result.status}"`)

// the preview image host must serve an actual image to the browser <img> (not proxied)
const imgOk = await page.evaluate(async () => {
  try {
    const r = await fetch('https://imgproxy.windy.com/_/preview/plain/current/1351011472/original.jpg', { method: 'GET' })
    return r.ok
  } catch {
    return false
  }
})
if (!imgOk) errors.push('windy preview image host not reachable from browser')

await browser.close()
console.log(JSON.stringify({ has, result, imgOk }))
if (errors.length) {
  console.error('WINDY VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('WINDY VERIFY OK')
