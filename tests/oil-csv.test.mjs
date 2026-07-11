import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFredCsv } from '../src/oil-csv.mjs'

test('parses value rows, skips header and the "." missing-day sentinel', () => {
  const csv = 'DATE,DCOILBRENTEU\n2024-01-01,.\n2024-01-02,75.78\n2024-01-03,76.10\n'
  const out = parseFredCsv(csv)
  assert.deepEqual(out, [
    { date: '2024-01-02', value: 75.78 },
    { date: '2024-01-03', value: 76.1 },
  ])
})

test('header only / empty body -> empty array', () => {
  assert.deepEqual(parseFredCsv('DATE,X\n'), [])
  assert.deepEqual(parseFredCsv(''), [])
})
