// M3 smoke: lets the recorder collect snapshots, enters playback, scrubs, plays.
// Usage: node scripts/verify-playback.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.PB_SHOT ?? 'playback-verify.png'

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
// record window: quakes snapshot every 60s; wait for at least two distinct instants
await new Promise((r) => setTimeout(r, 75_000))

await page.click('#pb-toggle')
await new Promise((r) => setTimeout(r, 3_000))
const entered = await page.evaluate(() => document.body.classList.contains('playback'))
if (!entered) {
  const status = await page.evaluate(() => document.getElementById('status')?.textContent)
  errors.push(`did not enter playback (status: ${status})`)
} else {
  // scrub to the end, then play from the start
  await page.evaluate(() => {
    const s = document.getElementById('pb-slider')
    s.value = s.max
    s.dispatchEvent(new Event('input'))
  })
  await new Promise((r) => setTimeout(r, 2_000))
  const timeText = await page.evaluate(() => document.getElementById('pb-time')?.textContent)
  if (!/^\d{4}-\d{2}-\d{2} /.test(timeText ?? '')) errors.push(`bad playback time readout: ${timeText}`)
  await page.click('#pb-play')
  await new Promise((r) => setTimeout(r, 4_000))
  await page.screenshot({ path: SHOT })
  // back to live
  await page.click('#pb-toggle')
  await new Promise((r) => setTimeout(r, 2_000))
  const left = await page.evaluate(() => !document.body.classList.contains('playback'))
  if (!left) errors.push('did not return to live mode')
}
await browser.close()

if (errors.length) {
  console.error('PLAYBACK VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('PLAYBACK VERIFY OK — screenshot:', SHOT)
