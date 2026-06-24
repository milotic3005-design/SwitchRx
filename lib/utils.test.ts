import test from 'node:test';
import assert from 'node:assert';
import { parseCitationNumbers } from './utils.ts';

test('parseCitationNumbers', () => {
  assert.deepStrictEqual(parseCitationNumbers("1"), [1]);
  assert.deepStrictEqual(parseCitationNumbers("1, 2"), [1, 2]);
  assert.deepStrictEqual(parseCitationNumbers("1,3"), [1, 3]);
  assert.deepStrictEqual(parseCitationNumbers("1-3"), [1, 2, 3]);
  assert.deepStrictEqual(parseCitationNumbers("1–3"), [1, 2, 3]);
  assert.deepStrictEqual(parseCitationNumbers("1, 3-5, 7"), [1, 3, 4, 5, 7]);
});
