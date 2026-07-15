import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAutomationLifecycle, validateAutomationRequest } from '../src/automation-core.mjs'

test('automation validates begin input and enforces record/drain lifecycle', async () => {
  assert.throws(
    () => validateAutomationRequest({ op: 'begin', camera: { lon: 0, lat: 100, height: 1 } }),
    /camera lon\/lat\/height/,
  )
  assert.throws(
    () => validateAutomationRequest({ op: 'begin', presentation: 'cinematic', camera: { lon: 0, lat: 0, height: 1 } }),
    /presentation must be analyst or story/,
  )

  const calls = []
  const chunks = ['YQ==', null]
  const run = createAutomationLifecycle({
    status: () => ({ ready: true, presentations: ['analyst', 'story'] }),
    begin: async (request) => {
      calls.push('begin')
      return request.presentation === 'story'
        ? { presentation: 'story', readiness: { ready: true, fallbackApplied: false } }
        : { presentation: 'analyst' }
    },
    finish: async () => { calls.push('finish'); return { scene: { v: 2 }, evidence: { schema: 'evidence-packet/v1' } } },
    drain: async () => chunks.shift(),
  })

  await assert.rejects(() => run({ op: 'finish' }), /requires recording/)
  const status = await run({ op: 'status' })
  assert.deepEqual(status.presentations, ['analyst', 'story'])
  const begun = await run({ op: 'begin', presentation: 'story', camera: { lon: 0, lat: 0, height: 1 } })
  assert.equal(begun.phase, 'recording')
  assert.equal(begun.readiness.ready, true)
  const finished = await run({ op: 'finish' })
  assert.equal(finished.evidence.schema, 'evidence-packet/v1')
  assert.equal(await run({ op: 'drain' }), 'YQ==')
  assert.equal(await run({ op: 'drain' }), null)
  assert.equal((await run({ op: 'status' })).phase, 'idle')
  assert.deepEqual(calls, ['begin', 'finish'])

  const failedFinish = createAutomationLifecycle({
    status: () => ({}), begin: async () => ({}),
    finish: async () => { throw new Error('bad evidence') }, drain: async () => null,
  })
  await failedFinish({ op: 'begin', camera: { lon: 0, lat: 0, height: 1 } })
  await assert.rejects(() => failedFinish({ op: 'finish' }), /bad evidence/)
  assert.equal((await failedFinish({ op: 'status' })).phase, 'draining')
  assert.equal(await failedFinish({ op: 'drain' }), null)
})
