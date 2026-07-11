import { test } from 'node:test'
import assert from 'node:assert/strict'
import { binIntegrity } from '../src/gpsjam-bin.mjs'

test('all-clean cluster yields no cells', () => {
  const reports = Array.from({ length: 5 }, (_, i) => ({ lat: 26.5 + i * 0.01, lon: 56.3, nic: 8, nac_p: 9 }))
  assert.deepEqual(binIntegrity(reports, 0.25), [])
})

test('all-low cluster yields a cell with frac=1', () => {
  const reports = Array.from({ length: 5 }, (_, i) => ({ lat: 26.5 + i * 0.01, lon: 56.3, nic: 4, nac_p: 5 }))
  const cells = binIntegrity(reports, 0.25)
  assert.equal(cells.length, 1)
  assert.equal(cells[0].total, 5)
  assert.equal(cells[0].low, 5)
  assert.equal(cells[0].frac, 1)
})

test('sparse cell below minAircraft is dropped', () => {
  const reports = [
    { lat: 26.5, lon: 56.3, nic: 3, nac_p: 4 },
    { lat: 26.51, lon: 56.3, nic: 2, nac_p: 3 },
  ]
  assert.deepEqual(binIntegrity(reports, 0.25, { minAircraft: 3 }), [])
})

test('undefined nic/nac_p counts as not-low', () => {
  const reports = [
    { lat: 26.5, lon: 56.3 },
    { lat: 26.51, lon: 56.3 },
    { lat: 26.52, lon: 56.3 },
  ]
  assert.deepEqual(binIntegrity(reports, 0.25), [])
})

test('mixed cluster below minFrac is dropped, cell SW corner reported', () => {
  const reports = [
    { lat: 26.5, lon: 56.3, nic: 8, nac_p: 9 },
    { lat: 26.51, lon: 56.3, nic: 8, nac_p: 9 },
    { lat: 26.52, lon: 56.3, nic: 3, nac_p: 4 },
  ]
  assert.deepEqual(binIntegrity(reports, 0.25), [])
  const cells = binIntegrity(reports, 0.25, { minFrac: 0.3 })
  assert.equal(cells.length, 1)
  assert.equal(cells[0].lat, 26.5) // floor(26.5/0.25)*0.25 == 26.5, SW corner
  assert.equal(cells[0].lon, 56.25)
})
