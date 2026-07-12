import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextPass } from '../src/passes-core.mjs'
import { elevationAngle } from '../src/aoi-geom.mjs'

const AOI = { lat: 0, lon: 0 } // ground target at [R,0,0]
const RSAT = 6371 + 500 // LEO altitude, km

// Satellite on the equatorial plane at longitude theta(ms); overhead the AOI when theta = 0.
function equatorial(thetaDegAt) {
  return (ms) => {
    const th = (thetaDegAt(ms) * Math.PI) / 180
    return { x: RSAT * Math.cos(th), y: RSAT * Math.sin(th), z: 0 }
  }
}

test('straight-overhead pass is found within the horizon', () => {
  // starts well below the horizon (theta -80deg), sweeps overhead at 1 deg/min
  const prop = equatorial((ms) => -80 + ms / 60_000)
  const ms = nextPass(prop, AOI, { fromMs: 0, horizonMin: 120, stepSec: 30, maskDeg: 20 })
  assert.equal(typeof ms, 'number')
  assert.ok(ms > 0 && ms <= 120 * 60_000, `pass ms ${ms} out of window`)
  const p = prop(ms)
  assert.ok(elevationAngle([p.x, p.y, p.z], AOI.lat, AOI.lon) > 20, 'returned sample must clear the mask')
})

test('sat that never rises above the mask yields null', () => {
  const prop = equatorial(() => 180) // parked at the antipode
  const ms = nextPass(prop, AOI, { fromMs: 0, horizonMin: 360, stepSec: 30, maskDeg: 20 })
  assert.equal(ms, null)
})

test('null propagator samples are skipped, not counted as a pass', () => {
  const ms = nextPass(() => null, AOI, { fromMs: 0, horizonMin: 60, stepSec: 30, maskDeg: 20 })
  assert.equal(ms, null)
})
