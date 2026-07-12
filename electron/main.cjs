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
const { app, BrowserWindow, Menu, shell, screen } = require('electron')
const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')

// FIXED port (not listen(0)): Chromium keys IndexedDB + localStorage by origin
// (scheme://host:PORT). A random port would mint a new origin every launch and
// orphan the 4D recordings (IndexedDB), saved camera shots, and TLE/boundary
// caches (localStorage) each restart. A fixed port keeps one stable origin so
// that state persists — the same reason the browser build (vite 5173/4173) does.
// Collisions are prevented by the single-instance lock below; a genuine third-
// party collision surfaces as an error page rather than silent origin churn.
const PORT = 39847
const DIST = path.join(__dirname, '..', 'dist')
const ICON = path.join(__dirname, '..', 'build', 'icon.ico')
const UA = 'godseye/0.1 (+https://github.com/javin23863/godseye)'
const FEED_TIMEOUT_MS = 15000
// hop-by-hop / framing headers must not be re-emitted: Node already decoded the
// upstream framing, so forwarding transfer-encoding/content-length verbatim can
// double-frame the piped body. content-encoding/content-length stay (body is raw).
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection', 'te', 'trailer', 'proxy-authenticate'])

// clean  -> strip origin/referer/cookie/sec-* (volunteer mirrors bot-detect
//           forwarded browser headers) by sending only host/UA/accept.
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

// OLLAMA_API_KEY: process.env, else a .env in userData (durable, user-writable,
// survives installer updates), beside a portable exe, or the repo root (dev).
// Never bundled; the LLM caption/Q&A degrades gracefully without it.
function loadKey() {
  if (process.env.OLLAMA_API_KEY) return process.env.OLLAMA_API_KEY
  const files = [
    path.join(app.getPath('userData'), '.env'),
    path.join(path.dirname(process.execPath), '.env'),
    path.join(__dirname, '..', '.env'),
  ]
  for (const f of files) {
    try {
      const m = fs.readFileSync(f, 'utf8').match(/^\s*OLLAMA_API_KEY\s*=\s*(.+?)\s*$/m)
      if (m) return m[1].replace(/^["']|["']$/g, '')
    } catch {}
  }
  return null
}
let OLLAMA_API_KEY = null // resolved in createWindow (after app is ready, so getPath works)

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
      const clean = {}
      for (const [k, v] of Object.entries(pres.headers)) if (!HOP_BY_HOP.has(k.toLowerCase())) clean[k] = v
      res.writeHead(pres.statusCode || 502, clean)
      // mid-stream upstream RST / the timeout-destroy below make `pres` emit 'error';
      // .pipe() attaches no handler to the source, so without this the unhandled
      // 'error' would crash the whole main process. destroy (not end) avoids a
      // content-length mismatch on the already-sent headers.
      pres.on('error', () => res.destroy())
      pres.pipe(res)
    },
  )
  // a hung upstream (OpenSky / volunteer mirrors stall often) must not leave the
  // renderer fetch pending forever — time out -> 502 -> renderer fails over.
  preq.setTimeout(FEED_TIMEOUT_MS, () => preq.destroy(new Error('upstream timeout')))
  preq.on('error', (e) => {
    if (res.headersSent) res.destroy()
    else {
      res.writeHead(502)
      res.end(`feed proxy error: ${e.message}`)
    }
  })
  res.on('error', () => {}) // swallow client abort / EPIPE
  req.pipe(preq) // forwards the LLM POST body; a no-op for the GET feeds
}

function serveStatic(req, res, u) {
  let rel = decodeURIComponent(u.pathname)
  if (rel === '/' || rel === '') rel = '/index.html'
  const full = path.join(DIST, path.normalize(rel).replace(/^(\.\.[\\/])+/, ''))
  if (full !== DIST && !full.startsWith(DIST + path.sep)) {
    res.writeHead(403)
    return res.end('forbidden')
  }
  fs.readFile(full, (err, data) => {
    if (err) {
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
    server.listen(PORT, '127.0.0.1', () => resolve(server))
  })
}

// -- window bounds persistence --------------------------------------------------
function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json')
}
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'))
  } catch {
    return null
  }
}
function saveState(w) {
  try {
    // getNormalBounds() = the un-maximized rect even while maximized, so we restore
    // to a sensible size when the user later un-maximizes (getBounds would save the
    // full-screen dims as the "normal" size).
    const b = w.getNormalBounds()
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: w.isMaximized() }))
  } catch {}
}
// only restore a rect that still intersects a connected display (survives unplugged monitors)
function onScreen(s) {
  if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return null
  const hit = screen.getAllDisplays().some((d) => {
    const w = d.workArea
    return s.x < w.x + w.width && s.x + s.width > w.x && s.y < w.y + w.height && s.y + s.height > w.y
  })
  return hit ? s : null
}

function buildMenu() {
  // hidden bar (autoHideMenuBar), but the role accelerators still fire — restores
  // reload / fullscreen / zoom / devtools / quit that removeMenu() had stripped.
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'toggleDevTools' },
        ],
      },
      { label: 'App', submenu: [{ role: 'quit' }] },
    ]),
  )
}

let win
let server

function showError(w, msg) {
  w.show()
  w.loadURL('data:text/html,' + encodeURIComponent(`<body style="background:#000;color:#f55;font:16px monospace;padding:2rem">${msg}</body>`))
}

async function createWindow() {
  OLLAMA_API_KEY = loadKey()
  buildMenu()

  const saved = onScreen(loadState())
  const opts = {
    width: saved?.width ?? 1600,
    height: saved?.height ?? 950,
    backgroundColor: '#000000',
    title: "GOD'S EYE",
    autoHideMenuBar: true,
    show: false, // reveal on ready-to-show to avoid an empty-window flash
    icon: fs.existsSync(ICON) ? ICON : undefined,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  }
  if (saved) {
    opts.x = saved.x
    opts.y = saved.y
  }
  win = new BrowserWindow(opts)
  if (saved?.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())
  win.on('close', () => saveState(win))

  // external links (Cesium/ion credit attributions) -> system browser; keep the
  // window pinned to the local origin instead of navigating away into a dead end.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) {
      e.preventDefault()
      shell.openExternal(url)
    }
  })

  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    return showError(win, 'dist/ not built. Run <b>npm run build</b> then relaunch.')
  }
  if (!server) {
    try {
      server = await startServer()
    } catch (err) {
      return showError(win, `Local server could not start on port ${PORT}: ${err.message}`)
    }
  }
  win.loadURL(`http://127.0.0.1:${PORT}/`)
}

// single-instance: a second launch focuses the running window instead of spinning
// up a duplicate server+Cesium window (and colliding on the fixed port).
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  app.whenReady().then(createWindow).catch((e) => console.error('startup failed:', e))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('before-quit', () => {
    try {
      server?.close()
    } catch {}
  })
}
