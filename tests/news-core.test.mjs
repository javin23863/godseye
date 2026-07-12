import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGeo } from '../src/news-core.mjs'

const fc = (features) => ({ type: 'FeatureCollection', features })
const pt = (lon, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props })

test('aggregates mentions at the same coord into one pin with a count', () => {
  const pins = normalizeGeo(
    fc([
      pt(13.4, 52.5, { name: 'Berlin, Germany', mentionedthemes: ';KILL;' }),
      pt(13.4, 52.5, { name: 'Berlin, Germany', mentionedthemes: ';PROTEST;' }),
      pt(35.2, 31.7, { name: 'Jerusalem', mentionedthemes: ';CONFLICT;' }),
    ]),
  )
  assert.equal(pins.length, 2)
  assert.deepEqual(pins[0], { lat: 52.5, lon: 13.4, name: 'Berlin, Germany', count: 2 })
  // sorted by count desc
  assert.equal(pins[1].count, 1)
})

test('query filters over name + themes + url (OR terms), else keeps all', () => {
  const data = fc([
    pt(1, 1, { name: 'Kyiv', mentionedthemes: ';ARMEDCONFLICT;' }),
    pt(2, 2, { name: 'Paris fashion week', mentionedthemes: ';ARTS;', url: 'https://x/style' }),
    pt(3, 3, { name: 'Reef report', mentionedthemes: ';ENV;', url: 'https://x/protest-ban' }),
  ])
  assert.equal(normalizeGeo(data).length, 3) // no query -> all
  const war = normalizeGeo(data, 'conflict protest')
  assert.deepEqual(
    war.map((p) => p.name).sort(),
    ['Kyiv', 'Reef report'], // Kyiv via themes, Reef via url; Paris excluded
  )
})

test('skips malformed / out-of-range features, never throws', () => {
  assert.deepEqual(normalizeGeo(null), [])
  assert.deepEqual(normalizeGeo({}), [])
  const pins = normalizeGeo(
    fc([
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} },
      pt(NaN, 5, {}),
      pt(999, 5, {}),
      pt(10, 20, {}), // the only valid one; missing name -> 'Unknown'
    ]),
  )
  assert.deepEqual(pins, [{ lat: 20, lon: 10, name: 'Unknown', count: 1 }])
})
