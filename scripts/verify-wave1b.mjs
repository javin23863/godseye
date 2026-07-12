// Wave 1b smoke: shareable moments, sourced brief, AI analyst. Confirms the controls
// mount, a BRIEF renders (template path, no key needed), attention runs without throwing,
// and there are zero pageerrors. Usage: node scripts/verify-wave1b.mjs [url]
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

const controls = await page.evaluate(() => ({
  shareLink: !!document.getElementById('share-link'),
  recClip: !!document.getElementById('rec-clip'),
  briefBtn: !!document.getElementById('brief-btn'),
  analyst: !!document.getElementById('analyst'),
  attentionRun: !!document.getElementById('attention-run'),
  nlq: !!document.getElementById('nlq'),
}))
for (const [k, v] of Object.entries(controls)) if (!v) errors.push(`missing control: ${k}`)

// BRIEF must render something (LLM narrative or the deterministic template) without a key
await page.click('#brief-btn')
await new Promise((r) => setTimeout(r, 4_000))
const briefText = await page.evaluate(() => document.getElementById('brief-panel')?.textContent ?? '')
if (briefText.trim().length < 10) errors.push(`brief panel empty: "${briefText}"`)

// attention ranking must run without throwing (may honestly flag nothing on a fresh session)
await page.click('#attention-run')
await new Promise((r) => setTimeout(r, 2_000))
const attentionText = await page.evaluate(() => document.getElementById('attention')?.textContent ?? '')

// share link click must not throw (clipboard may be denied headless — that's fine)
await page.click('#share-link')
await new Promise((r) => setTimeout(r, 800))
const hash = await page.evaluate(() => location.hash)
if (!hash.startsWith('#s=')) errors.push(`share did not set #s= hash: "${hash}"`)

await browser.close()
console.log(JSON.stringify({ controls, briefLen: briefText.length, attentionText, hashLen: hash.length }))
if (errors.length) {
  console.error('WAVE1B VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('WAVE1B VERIFY OK')
