import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWebcams } from '../src/windy-core.mjs'

const cam = (over = {}) => ({
  webcamId: 1,
  title: 'Cam',
  status: 'active',
  viewCount: 5,
  location: { latitude: 43.7, longitude: 7.2, city: 'Nice', country: 'France' },
  images: { current: { preview: 'p', thumbnail: 't' } },
  urls: { detail: 'https://windy.com/webcams/1' },
  ...over,
})

test('keeps active cams with coords, mapping fields', () => {
  const r = normalizeWebcams({ webcams: [cam()] })
  assert.equal(r.length, 1)
  assert.deepEqual(
    { id: r[0].id, lat: r[0].lat, lon: r[0].lon, city: r[0].city, preview: r[0].preview, detail: r[0].detail },
    { id: 1, lat: 43.7, lon: 7.2, city: 'Nice', preview: 'p', detail: 'https://windy.com/webcams/1' },
  )
})

test('drops inactive cams', () => {
  assert.equal(normalizeWebcams({ webcams: [cam({ status: 'inactive' })] }).length, 0)
})

test('drops cams without finite coordinates', () => {
  assert.equal(normalizeWebcams({ webcams: [cam({ location: { city: 'X' } })] }).length, 0)
  assert.equal(normalizeWebcams({ webcams: [cam({ location: { latitude: 'nope', longitude: 2 } })] }).length, 0)
})

test('thumbnail fills in when preview missing, and vice versa', () => {
  const a = normalizeWebcams({ webcams: [cam({ images: { current: { thumbnail: 't' } } })] })
  assert.equal(a[0].preview, 't')
  const b = normalizeWebcams({ webcams: [cam({ images: { current: { preview: 'p' } } })] })
  assert.equal(b[0].thumb, 'p')
})

test('tolerates missing / malformed envelope', () => {
  assert.deepEqual(normalizeWebcams(null), [])
  assert.deepEqual(normalizeWebcams({}), [])
  assert.deepEqual(normalizeWebcams({ webcams: 'x' }), [])
})
