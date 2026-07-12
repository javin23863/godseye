// God's Eye desktop launcher (Electron) — SELF-CONTAINED to the godseye repo.
// Not related to any other program's desktop app.
//
// The browser app calls same-origin /feeds/* for feeds that lack CORS or hold a
// secret (only vite dev/preview provided that). This launcher runs a tiny local
// server that (a) serves the built Vite dist/ and (b) reproduces the /feeds/*
// proxy — including the LLM route that injects OLLAMA_API_KEY server-side so the
// key never reaches the renderer bundle. Then a Chromium window loads it.
//
// The proxy route table mirrors vite.config.ts's feed()/oil/llm config; keep the
// two in sync (six stable routes).
const { app, BrowserWindow } = require('electron')
const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')

// clean  -> strip origin/referer/cookie/sec-* (volunteer mirrors bot-detect
//           forwarded browser headers) and send a clean s2s GET with our UA.
// keepQuery -> preserve the ?id= query (FRED oil CSV).
// auth   -> inject Authorization: Bearer <OLLAMA_API_KEY> on POST /api/chat.
const ROUTES = [
  { prefix: '/feeds/opensky', target: 'https://opensky-network.org', path: '/api/states/all', clean: true },
  { prefix: '/feeds/mil', target: 'https://api.adsb.lol', path: '/v2/mil', clean: true },
  { prefix: '/feeds/mil2', target: 'https://opendata.adsb.fi', path: '/api/v2/mil', clean: true },
  { prefix: '/feeds/mil3', target: 'https://api.airplanes.live', path: '/v2/mil', clean: true },
  { prefix: '/feeds/oil', target: 'https://fred.stlouisfed.org', path: '/graph/fredgraph.csv', keepQuery: true },
  { prefix: '/feeds/llm', target: 'https://ollama.com', path: '/api/chat', auth: true },
]
const UA = 'godseye/0.1 (+https://github.com/javin23863/godseye)'
const DIST = path.join(__dirname, '..', 'dist')

// OLLAMA_API_KEY: process.env, else a .env next to the installed exe (prod) or the
// repo root (dev). Never bundled; the LLM caption/Q&A degrades gracefully without it.
function loadKey() {
  if (process.env.OLLAMA_API_KEY) return process.env.OLLAMA_API_KEY
  for (const f of [path.join(path.dirname(process.execPath), '.env'), path.join(__dirname, '..', '.env')]) {
    try {
      const m = fs.readFileSync(f, 'utf8').match(/^\s*OLLAMA_API_KEY\s*=\s*(.+?)\s*$/m)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    } catch {}
  }
  return null
}
const OLLAMA_API_KEY = loadKey()

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.b3dm': 'application/octet-stream', '.map': 'application/json',
  '.txt': 'text/plain', '.xml': 'application/xml', '.czml': 'application/json',
}

function proxyFeed(route, req, res, u) {
  const target = new URL(route.target)
  const headers = { host: target.host, 'user-agent': UA, accept: req.headers.accept || '*/*' }
  if (!route.clean && req.headers['content-type']) headers['content-type'] = req.headers['content-type']
  if (route.auth && OLLAMA_API_KEY) headers.authorization = `Bearer ${OLLAMA_API_KEY}`
  const preq = https.request(
    { method: req.method, hostname: target.hostname, port: 443, path: route.keepQuery ? route.path + u.search : route.path, headers },
    (pres) => {
      res.writeHead(pres.statusCode || 502, pres.headers)
      pres.pipe(res)
    },
  )
  preq.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502)
    res.end(`feed proxy error: ${e.message}`)
  })
  req.pipe(preq) // forwards the LLM POST body; a no-op for the GET feeds
}

function serveStatic(req, res, u) {
  let rel = decodeURIComponent(u.pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const full = path.join(DIST, path.normalize(rel).replace(/^(\.\.[\\/])+/, ''))
  if (!full.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      // fall back to index.html (single-page app)
      return fs.readFile(path.join(DIST, 'index.html'), (e2, idx) => {
        if (e2) {
          res.writeHead(404)
          res.end('not found')
        } else {
          res.writeHead(200, { 'content-type': 'text/html' })
          res.end(idx)
        }
      })
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream' })
    res.end(data)
  })
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1')
      const route = ROUTES.find((r) => u.pathname === r.prefix) // exact match: /feeds/mil !== /feeds/mil2
      if (route) return proxyFeed(route, req, res, u)
      serveStatic(req, res, u)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

let win
async function createWindow() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    // dist missing — surface it instead of a blank window
    win = new BrowserWindow({ width: 900, height: 400, title: "GOD'S EYE" })
    win.loadURL('data:text/html,' + encodeURIComponent('<body style="background:#000;color:#f55;font:16px monospace;padding:2rem">dist/ not built. Run <b>npm run build</b> then relaunch.</body>'))
    return
  }
  const port = await startServer()
  win = new BrowserWindow({
    width: 1600,
    height: 950,
    backgroundColor: '#000000',
    title: "GOD'S EYE",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  win.removeMenu()
  win.loadURL(`http://127.0.0.1:${port}/`)
}

app.whenReady().then(createWindow)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
