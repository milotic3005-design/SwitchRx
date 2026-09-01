import assert from 'node:assert';
import test from 'node:test';
import { parseCitationNumbers } from './utils.ts';

test('parseCitationNumbers - comma separated', () => {
  assert.deepStrictEqual(parseCitationNumbers('1, 2'), [1, 2]);
  assert.deepStrictEqual(parseCitationNumbers('1, 3, 5'), [1, 3, 5]);
});

test('parseCitationNumbers - hyphen ranges', () => {
  assert.deepStrictEqual(parseCitationNumbers('1-3'), [1, 2, 3]);
  assert.deepStrictEqual(parseCitationNumbers('2-4'), [2, 3, 4]);
  assert.deepStrictEqual(parseCitationNumbers('10 - 12'), [10, 11, 12]);
});

test('parseCitationNumbers - en-dash ranges', () => {
  assert.deepStrictEqual(parseCitationNumbers('1–3'), [1, 2, 3]);
});

test('parseCitationNumbers - mixed', () => {
  assert.deepStrictEqual(parseCitationNumbers('1, 3-5, 7'), [1, 3, 4, 5, 7]);
  assert.deepStrictEqual(parseCitationNumbers('1, 3–5, 8'), [1, 3, 4, 5, 8]);
});

test('parseCitationNumbers - single numbers', () => {
  assert.deepStrictEqual(parseCitationNumbers('4'), [4]);
});

test('parseCitationNumbers - edge cases', () => {
  // Max range cap test (end <= start + 20)
  assert.deepStrictEqual(parseCitationNumbers('1-25'), Array.from({ length: 21 }, (_, i) => i + 1));
  assert.deepStrictEqual(parseCitationNumbers('invalid'), []);
  assert.deepStrictEqual(parseCitationNumbers(''), []);
});
