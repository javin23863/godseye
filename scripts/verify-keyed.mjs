// Keyed smoke: verifies the three operator-key features actually light up —
// Google 3D basemap active, AIS ships stream in, LLM caption replaces the template.
// Requires .env with VITE_GOOGLE_TILES_KEY, VITE_AISSTREAM_KEY, OLLAMA_API_KEY.
// Usage: node scripts/verify-keyed.mjs [url]
import puppeteer from 'puppeteer-core'

const URL = process.argv[2] ?? 'http://localhost:4321'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT = process.env.KEYED_SHOT ?? 'keyed-verify.png'

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

// 1) Google 3D basemap resolved (not the keyless fallback)
await page.waitForFunction(() => document.querySelector('#basemaps button.active')?.textContent === 'GOOGLE 3D', {
  timeout: 30_000,
})

// 2) AIS ships stream in over the WebSocket (Gulf default bbox) within 90s
let shipCount = 0
try {
  await page.waitForFunction(
    () => {
      const row = [...document.querySelectorAll('#layers label.layer-row')].find((l) => l.textContent?.includes('SHIPS'))
      return Number(row?.querySelector('.count')?.textContent ?? 0) > 0
    },
    { timeout: 90_000 },
  )
  shipCount = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#layers label.layer-row')].find((l) => l.textContent?.includes('SHIPS'))
    return Number(row?.querySelector('.count')?.textContent ?? 0)
  })
} catch {
  errors.push('no AIS ships within 90s')
}

// 3) LLM caption replaces the template SUMMARY (query it directly to avoid the 60s interval)
const caption = await page.evaluate(async () => {
  const res = await fetch('/feeds/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'minimax-m3:cloud',
      messages: [{ role: 'user', content: 'Reply with exactly five words in caps.' }],
      stream: false,
    }),
  })
  if (!res.ok) return null
  return (await res.json())?.message?.content ?? null
})
if (!caption) errors.push('LLM proxy returned no caption')

await page.screenshot({ path: SHOT })
await browser.close()

console.log(JSON.stringify({ ships: shipCount, caption }))
if (errors.length) {
  console.error('KEYED VERIFY FAILED:')
  for (const e of errors) console.error(' ', e)
  process.exit(1)
}
console.log('KEYED VERIFY OK — screenshot:', SHOT)
