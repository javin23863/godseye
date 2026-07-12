import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import cesium from 'vite-plugin-cesium'

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
  return {
    plugins: [cesium()],
    server: { proxy },
    preview: { proxy },
  }
})
