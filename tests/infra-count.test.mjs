import assert from 'assert'
import { countByKind } from '../src/infra-count.mjs'

const testData = [
  { type: 'Feature', properties: { name: 'Strait of Hormuz', kind: 'chokepoint' } },
  { type: 'Feature', properties: { name: 'Bab-el-Mandeb', kind: 'chokepoint' } },
  { type: 'Feature', properties: { name: 'East-West Petroline', kind: 'pipeline' } },
  { type: 'Feature', properties: { name: 'Habshan–Fujairah', kind: 'pipeline' } },
  { type: 'Feature', properties: { name: 'Yanbu', kind: 'port' } },
  { type: 'Feature', properties: { name: 'Fujairah', kind: 'refinery' } },
  { type: 'Feature', properties: { name: 'Ras Tanura', kind: 'refinery' } },
  { type: 'Feature', properties: { name: 'Kharg Island', kind: 'refinery' } },
  { type: 'Feature', properties: { name: 'Jebel Ali', kind: 'desalination' } },
  { type: 'Feature', properties: { name: 'Ras Al Khair', kind: 'desalination' } },
]

// Test countByKind
const counts = countByKind(testData)
assert.deepStrictEqual(counts, {
  chokepoint: 2,
  pipeline: 2,
  port: 1,
  refinery: 3,
  desalination: 2,
})

// Test empty list
assert.deepStrictEqual(countByKind([]), {
  chokepoint: 0,
  pipeline: 0,
  port: 0,
  refinery: 0,
  desalination: 0,
})

// Test with missing kind
const mixedData = [
  { type: 'Feature', properties: { name: 'Valid', kind: 'chokepoint' } },
  { type: 'Feature', properties: { name: 'Invalid' } }, // no kind
  { type: 'Feature', properties: { name: 'Wrong', kind: 'unknown' } }, // wrong kind
]
assert.deepStrictEqual(countByKind(mixedData), {
  chokepoint: 1,
  pipeline: 0,
  port: 0,
  refinery: 0,
  desalination: 0,
})

console.log('✓ infra-count tests passed')
