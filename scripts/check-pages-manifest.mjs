import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMatchingHashes } from './pages-manifest.mjs'

test('accepts matching file hashes regardless of key order', () => {
  assert.doesNotThrow(() => assertMatchingHashes({ a: '1', b: '2' }, { b: '2', a: '1' }, 'Test'))
})
test('rejects modified source or asset content', () => {
  assert.throws(() => assertMatchingHashes({ a: '1' }, { a: '2' }, 'Test'), /Test changed.*a/)
})
test('rejects missing assets', () => {
  assert.throws(() => assertMatchingHashes({ a: '1', b: '2' }, { a: '1' }, 'Test'), /Test changed.*b/)
})
test('rejects unlisted extra assets', () => {
  assert.throws(() => assertMatchingHashes({ a: '1' }, { a: '1', b: '2' }, 'Test'), /Test changed.*b/)
})
