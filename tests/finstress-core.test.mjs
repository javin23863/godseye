import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSeries, pctChange, stressColor, INSTRUMENTS } from '../src/finstress-core.mjs'

const CSV = 'DATE,DCOILWTICO\n2024-01-01,.\n2024-01-02,70.00\n2024-01-03,70.70\n' +
  '2024-01-04,71.40\n2024-01-05,72.10\n2024-01-08,73.50\n2024-01-09,77.00\n'

test('buildSeries parses fredgraph CSV into parallel dates/values, dropping "." rows', () => {
  const s = buildSeries(CSV)
  assert.deepEqual(s.dates, ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08', '2024-01-09'])
  assert.deepEqual(s.values, [70.0, 70.7, 71.4, 72.1, 73.5, 77.0])
})

test('pctChange computes % change over N trading rows (holiday rows already dropped)', () => {
  const s = buildSeries(CSV)
  // 5 rows back from the last (77.00) is 70.00 -> +10%
  assert.equal(Math.round(pctChange(s, 5) * 100) / 100, 10)
  assert.equal(Math.round(pctChange(s, 1) * 100) / 100, Math.round(((77.0 - 73.5) / 73.5) * 100 * 100) / 100)
})

test('pctChange: not enough history -> null', () => {
  const s = buildSeries('DATE,X\n2024-01-02,70.00\n2024-01-03,70.70\n')
  assert.equal(pctChange(s, 5), null)
  assert.equal(pctChange({ values: [] }, 5), null)
})

test('pctChange: zero base -> null (div-by-zero guard)', () => {
  assert.equal(pctChange({ values: [0, 1, 2, 3, 4, 5] }, 5), null)
})

test('stressColor thresholds: ≤0 calm, >2% amber, >5% red', () => {
  assert.equal(stressColor(-3), '#9ccc65')
  assert.equal(stressColor(0), '#9ccc65')
  assert.equal(stressColor(2), '#9ccc65') // boundary: exactly 2% is not yet amber
  assert.equal(stressColor(2.1), '#ffab40')
  assert.equal(stressColor(5), '#ffab40') // boundary: exactly 5% is not yet red
  assert.equal(stressColor(5.1), '#ff5252')
  assert.equal(stressColor(null), '#78909c')
  assert.equal(stressColor(NaN), '#78909c')
})

test('INSTRUMENTS roster has 5 instruments with fred id + hub coords', () => {
  assert.equal(INSTRUMENTS.length, 5)
  for (const inst of INSTRUMENTS) {
    assert.ok(inst.key && inst.fred && inst.hub)
    assert.equal(typeof inst.hub.lat, 'number')
    assert.equal(typeof inst.hub.lon, 'number')
  }
  assert.ok(INSTRUMENTS.find((i) => i.key === 'GOLD'))
})
