import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GIBS_LAYERS, gibsTemplate, gibsTileUrl, maxLevel, utcDay } from '../src/gibs-core.mjs'

test('utcDay offsets whole days in UTC', () => {
  const now = Date.UTC(2026, 6, 12, 3, 0, 0) // 2026-07-12T03:00Z
  assert.equal(utcDay(0, now), '2026-07-12')
  assert.equal(utcDay(-1, now), '2026-07-11')
})

test('maxLevel derives N-1 from GoogleMapsCompatible_LevelN', () => {
  assert.equal(maxLevel('GoogleMapsCompatible_Level9'), 8)
  assert.equal(maxLevel('GoogleMapsCompatible_Level6'), 5)
})

test('template carries the WMTS placeholders Cesium substitutes', () => {
  const t = gibsTemplate(GIBS_LAYERS[0])
  for (const p of ['{Time}', '{TileMatrix}', '{TileRow}', '{TileCol}']) assert.ok(t.includes(p))
})

test('tile URL matches the verified-live GIBS request (200 image/jpeg)', () => {
  const truecolor = GIBS_LAYERS.find((l) => l.id === 'VIIRS_NOAA20_CorrectedReflectance_TrueColor')
  assert.equal(
    gibsTileUrl(truecolor, '2026-07-10', 3, 3, 4),
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/2026-07-10/GoogleMapsCompatible_Level9/3/3/4.jpg',
  )
})
