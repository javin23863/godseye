import { test } from 'node:test'
import assert from 'node:assert/strict'
import { heightToZoom, mapUrl } from '../src/windy-map-core.mjs'

test('heightToZoom maps camera height to a sane Leaflet zoom', () => {
  assert.equal(heightToZoom(20_000_000), 3) // whole-earth view clamps low
  assert.equal(heightToZoom(1_000_000), 6) // country scale
  assert.equal(heightToZoom(100_000), 9) // metro scale
  assert.equal(heightToZoom(1_000), 11) // close-in clamps high
  assert.equal(heightToZoom(NaN), 5)
  assert.equal(heightToZoom(-5), 5)
})

test('mapUrl builds the proxied page URL', () => {
  assert.equal(mapUrl(26.5, 56.3, 1_000_000), '/feeds/windymap?lat=26.5000&lon=56.3000&zoom=6&overlay=wind')
  assert.match(mapUrl(-33.86, 151.2, 500_000, 'temp'), /overlay=temp$/)
})
