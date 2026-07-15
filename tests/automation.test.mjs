import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAutomationLifecycle, mergeWarnings, validateAutomationRequest } from '../src/automation-core.mjs'

test('automation validates begin input and enforces record/drain lifecycle', async () => {
  assert.throws(
    () => validateAutomationRequest({ op: 'begin', camera: { lon: 0, lat: 100, height: 1 } }),
    /camera lon\/lat\/height/,
  )
  assert.throws(
    () => validateAutomationRequest({ op: 'begin', presentation: 'cinematic', camera: { lon: 0, lat: 0, height: 1 } }),
    /presentation must be analyst or story/,
  )

  const touched = []
  const guarded = createAutomationLifecycle({
    status: () => { touched.push('status'); return {} },
    begin: async () => { touched.push('begin'); return {} },
    finish: async () => { touched.push('finish'); return {} },
    drain: async () => { touched.push('drain'); return null },
  })
  await assert.rejects(
    () => guarded({ op: 'begin', presentation: 'cinematic', camera: { lon: 0, lat: 0, height: 1 } }),
    /presentation must be analyst or story/,
  )
  assert.deepEqual(touched, [])

  let omittedPresentation
  const analyst = createAutomationLifecycle({
    status: () => ({}),
    begin: async (request) => { omittedPresentation = request.presentation; return { presentation: request.presentation ?? 'analyst' } },
    finish: async () => ({}),
    drain: async () => null,
  })
  const omitted = await analyst({ op: 'begin', camera: { lon: 0, lat: 0, height: 1 } })
  assert.equal(omitted.presentation, 'analyst')
  assert.equal(omittedPresentation, undefined)
  await analyst({ op: 'finish' })
  await analyst({ op: 'drain' })
  assert.deepEqual(
    mergeWarnings(['caller warning', 'shared warning'], ['readiness warning', 'shared warning']),
    ['caller warning', 'shared warning', 'readiness warning'],
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

  const failedBegin = createAutomationLifecycle({
    status: () => ({}), begin: async () => { throw new Error('recorder unavailable') },
    finish: async () => ({}), drain: async () => null,
  })
  await assert.rejects(
    () => failedBegin({ op: 'begin', presentation: 'story', camera: { lon: 0, lat: 0, height: 1 } }),
    /recorder unavailable/,
  )
  assert.equal((await failedBegin({ op: 'status' })).phase, 'idle')
})
