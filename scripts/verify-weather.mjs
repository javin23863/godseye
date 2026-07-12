// Windy point-weather live check (needs WINDY_POINT_FORECAST_KEY in .env so the /feeds/weather
// middleware registers). Flies to a location, clicks WEATHER (VIEW), asserts the key-injected
// proxy returns a real GFS forecast and the readout renders current conditions + a sparkline.
// Usage: node scripts/verify-weather.mjs [url]
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

const hasBtn = await page.evaluate(() => !!document.getElementById('weather-scan'))
if (!hasBtn) errors.push('missing weather-scan button')

// fly somewhere concrete, then forecast the view center
await page.type('#search-box', 'Nice, France')
await page.keyboard.press('Enter')
await new Promise((r) => setTimeout(r, 6_000))
await page.click('#weather-scan')
await new Promise((r) => setTimeout(r, 8_000))

const out = await page.evaluate(() => ({
  status: document.getElementById('status')?.textContent ?? '',
  now: document.getElementById('wx-now')?.textContent ?? '',
  hasSpark: !!document.getElementById('wx-spark'),
}))
if (/NO KEY/.test(out.status)) errors.push('proxy reported NO KEY — point-forecast key not loaded')
if (!/°C/.test(out.now)) errors.push(`readout has no temperature: "${out.now}"`)
if (!/WEATHER: .*°C/.test(out.status)) errors.push(`status line not a forecast: "${out.status}"`)
if (!out.hasSpark) errors.push('temperature sparkline not drawn')

await browser.close()
console.log(JSON.stringify(out))
if (errors.length) {
  console.error('WEATHER VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('WEATHER VERIFY OK')
