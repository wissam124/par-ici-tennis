import test from 'node:test'
import assert from 'node:assert/strict'
import { notify } from '../lib/ntfy.js'

test('notify reports a successful HTTP response', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200 }))
  t.mock.method(console, 'log', () => {})

  assert.equal(await notify(Buffer.from('test'), 'test.txt', 'Test', { topic: 'test' }), true)
})

test('notify rejects an unsuccessful HTTP response', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401 }))
  t.mock.method(console, 'error', () => {})

  assert.equal(await notify(Buffer.from('test'), 'test.txt', 'Test', { topic: 'test' }), false)
})
