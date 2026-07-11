import { test } from 'node:test'
import assert from 'node:assert/strict'
import { footprintWedge } from '../src/cctv-geom.mjs'

const LAT = 30.27
const LON = -97.74 // Austin

test('apex is the first point and equals the camera', () => {
  const ring = footprintWedge(LAT, LON, 45, 60, 300, 4)
  assert.deepEqual(ring[0], [LON, LAT])
})

test('due-north heading puts the arc centre north of the camera', () => {
  const ring = footprintWedge(LAT, LON, 0, 60, 300, 4)
  // ring = [apex, arc0..arc4, apex]; centre arc bearing = heading -> index 1 + 4/2
  const centre = ring[3]
  assert.ok(centre[1] > LAT, 'latitude increases going north')
  assert.ok(Math.abs(centre[0] - LON) < 1e-6, 'longitude ~ unchanged')
})

test('wider fov spans more longitude at fixed range', () => {
  const span = (fov) => {
    // heading north: the arc spreads symmetrically east-west, so a wider FOV
    // widens the longitude extent.
    const lons = footprintWedge(LAT, LON, 0, fov, 300, 12).map((p) => p[0])
    return Math.max(...lons) - Math.min(...lons)
  }
  assert.ok(span(120) > span(30))
})

test('ring is closed — last point returns to the apex', () => {
  const ring = footprintWedge(LAT, LON, 200, 45, 500, 8)
  assert.deepEqual(ring[ring.length - 1], [LON, LAT])
})
