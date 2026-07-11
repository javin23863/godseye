import { test } from 'node:test'
import assert from 'node:assert/strict'
import { elevationAngle, llToEcefKm } from '../src/aoi-geom.mjs'

test('satellite directly overhead is ~90 deg', () => {
  const ground = llToEcefKm(10, 20)
  const overhead = ground.map((c) => c * 1.1) // same direction, higher radius
  const el = elevationAngle(overhead, 10, 20)
  assert.ok(el > 89.9, `expected ~90, got ${el}`)
})

test('satellite on the opposite side of Earth is negative', () => {
  const sat = llToEcefKm(0, 180, 6371 + 500) // antipodal LEO altitude
  const el = elevationAngle(sat, 0, 0)
  assert.ok(el < 0, `expected negative, got ${el}`)
})

test('elevation increases monotonically as a sat moves toward zenith', () => {
  const alt = 6371 + 500
  const thetas = [60, 45, 30, 15, 5, 0] // degrees off the ground point's zenith ray, decreasing
  const els = thetas.map((theta) => {
    const rad = (theta * Math.PI) / 180
    const satEcef = [alt * Math.cos(rad), alt * Math.sin(rad), 0]
    return elevationAngle(satEcef, 0, 0)
  })
  for (let i = 1; i < els.length; i++) {
    assert.ok(els[i] > els[i - 1], `not monotonic at i=${i}: ${els}`)
  }
})

test('satellite on the local horizon is ~0 deg', () => {
  const ground = llToEcefKm(0, 0)
  const satEcef = [ground[0], ground[1] + 1000, ground[2]] // perpendicular to local up
  const el = elevationAngle(satEcef, 0, 0)
  assert.ok(Math.abs(el) < 0.1, `expected ~0, got ${el}`)
})
