import { test } from 'node:test'
import assert from 'node:assert/strict'
import { windVector, compass, summarizeForecast, kToC, msToKnots, paToHpa } from '../src/weather-core.mjs'

test('unit conversions', () => {
  assert.equal(kToC(297.3012086033107).toFixed(2), '24.15')
  assert.equal(msToKnots(1).toFixed(4), '1.9438')
  assert.equal(paToHpa(101325), 1013.25)
})

test('windVector: speed = hypot, dir = FROM bearing', () => {
  // wind blowing to the north (v>0) comes FROM the south = 180
  assert.deepEqual(round(windVector(0, 5)), { speedMs: 5, dirDeg: 180 })
  // blowing to the east (u>0) comes FROM the west = 270
  assert.deepEqual(round(windVector(3, 0)), { speedMs: 3, dirDeg: 270 })
})

test('compass 16-point labels', () => {
  assert.equal(compass(0), 'N')
  assert.equal(compass(90), 'E')
  assert.equal(compass(180), 'S')
  assert.equal(compass(270), 'W')
  assert.equal(compass(360), 'N')
})

test('summarizeForecast maps parallel arrays + now shortcut', () => {
  const resp = {
    ts: [1000, 2000],
    'temp-surface': [297.3012086033107, 290],
    'wind_u-surface': [0, 3],
    'wind_v-surface': [5, 0],
    'gust-surface': [null, 10],
    'rh-surface': [55, 60],
    'pressure-surface': [101325, 100000],
  }
  const { steps, now } = summarizeForecast(resp)
  assert.equal(steps.length, 2)
  assert.equal(now.tempC.toFixed(2), '24.15')
  assert.equal(now.dir, 'S') // from south
  assert.equal(now.gustKt, null) // null gust preserved, not 0
  assert.equal(now.hpa, 1013.25)
  assert.equal(steps[1].dir, 'W')
  assert.equal(steps[1].gustKt.toFixed(2), '19.44')
})

test('tolerates missing arrays / bad envelope', () => {
  assert.deepEqual(summarizeForecast(null), { steps: [], now: null })
  const partial = summarizeForecast({ ts: [1], 'temp-surface': [300] })
  assert.equal(partial.steps[0].tempC.toFixed(2), '26.85')
  assert.equal(partial.steps[0].windMs, null) // no wind arrays -> null, not NaN
  assert.equal(partial.steps[0].dir, '')
})

const round = (o) => ({ speedMs: +o.speedMs.toFixed(6), dirDeg: +o.dirDeg.toFixed(6) })
