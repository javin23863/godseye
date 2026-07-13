import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFirmsCsv } from '../src/fires-core.mjs'

const VIIRS = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
1.56819,31.71493,295.63,0.41,0.61,2026-07-11,0003,N20,n,2.0NRT,283.56,0.95,N
3.90036,15.8923,303.48,0.5,0.49,2026-07-11,0130,N20,h,2.0NRT,290.1,12.4,N
40.1,-100.2,310.0,0.4,0.4,2026-07-11,1245,N20,l,2.0NRT,280.0,3.2,N`

const MODIS = `latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight
10.5,20.5,320.1,1.0,1.0,2026-07-11,0500,Terra,15,6.1NRT,290.0,1.1,D
11.5,21.5,330.1,1.0,1.0,2026-07-11,0500,Terra,55,6.1NRT,290.0,20.0,D
12.5,22.5,340.1,1.0,1.0,2026-07-11,0500,Terra,95,6.1NRT,290.0,50.0,D`

test('parses VIIRS header variant, sorts by frp desc', () => {
  const rows = parseFirmsCsv(VIIRS)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((r) => r.frp), [12.4, 3.2, 0.95])
  assert.equal(rows[0].conf, 'h')
  assert.equal(rows[2].conf, 'n')
  assert.ok(rows[0].ts > 0)
})

test('parses MODIS header variant, buckets numeric confidence to l/n/h', () => {
  const rows = parseFirmsCsv(MODIS)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((r) => r.conf), ['h', 'n', 'l']) // sorted by frp desc: 50(95->h), 20(55->n), 1.1(15->l)
})

test('caps at maxRows and skips malformed lines without throwing', () => {
  const capped = parseFirmsCsv(VIIRS, { maxRows: 2 })
  assert.equal(capped.length, 2)

  const withGarbage = `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight
not,a,real,row
1.5,2.5,300,0.4,0.4,2026-07-11,0010,N20,n,2.0NRT,280,5.0,N
999,999,300,0.4,0.4,2026-07-11,0010,N20,n,2.0NRT,280,5.0,N`
  const rows = parseFirmsCsv(withGarbage)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].lat, 1.5)

  assert.deepEqual(parseFirmsCsv(''), [])
  assert.deepEqual(parseFirmsCsv('not,a,csv,at,all'), [])
})
