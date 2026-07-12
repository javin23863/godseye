import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shareUrl } from '../src/share-core.mjs'

test('shareUrl appends hash to a clean URL', () => {
  assert.equal(shareUrl('http://x/y', '#s=abc'), 'http://x/y#s=abc')
})

test('shareUrl replaces an existing hash', () => {
  assert.equal(shareUrl('http://x/y#s=old', '#s=new'), 'http://x/y#s=new')
})

test('shareUrl adds the missing # prefix', () => {
  assert.equal(shareUrl('http://x/y', 's=abc'), 'http://x/y#s=abc')
})
