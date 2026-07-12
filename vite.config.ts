import https from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import cesium from 'vite-plugin-cesium'

// Windy Point-Forecast auth is body-only (POST with `key` in the JSON, no header/query works),
// so a plain proxy can't inject it. This middleware takes GET /feeds/weather?lat=&lon= and
// synthesizes the full POST body server-side — the key never reaches the browser bundle.
// Registered on both the dev and preview servers, only when the key is set.
function windyWeather(key: string): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const u = new URL(req.url ?? '', 'http://x')
    const lat = Number(u.searchParams.get('lat'))
    const lon = Number(u.searchParams.get('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.statusCode = 400
      return res.end('bad coords')
    }
    const body = JSON.stringify({
      lat, lon, model: 'gfs',
      parameters: ['temp', 'wind', 'windGust', 'rh', 'pressure'], levels: ['surface'], key,
    })
    const preq = https.request(
      { hostname: 'api.windy.com', path: '/api/point-forecast/v2', method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
      (pres) => {
        res.writeHead(pres.statusCode ?? 502, { 'content-type': 'application/json' })
        pres.pipe(res)
      },
    )
    preq.on('error', (e) => {
      res.statusCode = 502
      res.end(String(e))
    })
    preq.end(body)
  }
  return {
    // block bodies: returning s.middlewares.use()'s value (the connect app) makes Vite
    // treat it as a post-hook and invoke it with the wrong args -> crash on start.
    name: 'windy-weather-proxy',
    configureServer(s) {
      s.middlewares.use('/feeds/weather', handler)
    },
    configurePreviewServer(s) {
      s.middlewares.use('/feeds/weather', handler)
    },
  }
}

// OpenSky + the military-ADS-B mirrors don't serve CORS headers for third-party
// origins, so the app calls same-origin /feeds/* and vite proxies (dev AND preview).
// A production deploy needs the same routes on its host (thin proxy, docs/02).
// Browser headers (origin/referer/sec-*) forwarded through node TLS trip bot
// detection on the volunteer mirrors — strip them so the request is a clean s2s GET.
function feed(target: string, path: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: () => path,
    headers: { 'User-Agent': 'godseye/0.1 (+https://github.com/javin23863/godseye)' },
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq) => {
        for (const h of ['origin', 'referer', 'cookie']) proxyReq.removeHeader(h)
        for (const h of proxyReq.getHeaderNames()) if (h.startsWith('sec-')) proxyReq.removeHeader(h)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy: Record<string, ProxyOptions> = {
    '/feeds/opensky': feed('https://opensky-network.org', '/api/states/all'),
    '/feeds/mil': feed('https://api.adsb.lol', '/v2/mil'),
    '/feeds/mil2': feed('https://opendata.adsb.fi', '/api/v2/mil'),
    '/feeds/mil3': feed('https://api.airplanes.live', '/v2/mil'),
    // GDELT v1 GKG GeoJSON (news hotspots) — no CORS header; v2 /api/v2/geo/geo is 404 upstream
    '/feeds/gdelt': feed('https://api.gdeltproject.org', '/api/v1/gkg_geojson'),
    // TeleGeography submarine-cable set — no CORS header
    '/feeds/cables': feed('https://www.submarinecablemap.com', '/api/v3/cable/cable-geo.json'),
    // FRED oil-price CSV — no CORS header, proxy preserves the ?id= query (DS-17)
    '/feeds/oil': {
      target: 'https://fred.stlouisfed.org',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/feeds\/oil/, '/graph/fredgraph.csv'),
    },
  }
  if (env.WINDY_API_KEY) {
    // Windy Webcams v3 — key injected as a header server-side, never in the bundle.
    // rewrite only swaps the prefix so the ?nearby=&include= query is preserved.
    proxy['/feeds/windy'] = {
      target: 'https://api.windy.com',
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/feeds\/windy/, '/webcams/api/v3/webcams'),
      headers: { 'x-windy-api-key': env.WINDY_API_KEY },
    }
  }
  if (env.OLLAMA_API_KEY) {
    // LLM key never reaches the bundle — proxy injects the Authorization header
    proxy['/feeds/llm'] = {
      target: 'https://ollama.com',
      changeOrigin: true,
      rewrite: () => '/api/chat',
      headers: { Authorization: `Bearer ${env.OLLAMA_API_KEY}` },
    }
  }
  const plugins: Plugin[] = [cesium()]
  if (env.WINDY_POINT_FORECAST_KEY) plugins.push(windyWeather(env.WINDY_POINT_FORECAST_KEY))
  return {
    plugins,
    server: { proxy },
    preview: { proxy },
  }
})
