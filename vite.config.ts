import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'

// OpenSky + adsb.lol don't serve CORS headers for third-party origins, so the app
// calls same-origin /feeds/* and vite proxies (dev AND preview). A production deploy
// needs the same two routes on its host (thin proxy per docs/02-architecture.md).
const proxy = {
  '/feeds/opensky': {
    target: 'https://opensky-network.org',
    changeOrigin: true,
    rewrite: () => '/api/states/all',
  },
  '/feeds/mil': {
    target: 'https://api.adsb.lol',
    changeOrigin: true,
    rewrite: () => '/v2/mil',
  },
  '/feeds/mil2': {
    target: 'https://opendata.adsb.fi',
    changeOrigin: true,
    rewrite: () => '/api/v2/mil',
    headers: { 'User-Agent': 'godseye/0.1 (+https://github.com/javin23863/godseye)' },
  },
}

export default defineConfig({
  plugins: [cesium()],
  server: { proxy },
  preview: { proxy },
})
