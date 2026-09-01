import test from 'node:test';
import assert from 'node:assert';
import { cn } from './utils.ts';

test('cn utility', async (t) => {
  await t.test('merges basic classes', () => {
    assert.strictEqual(cn('p-4', 'm-4'), 'p-4 m-4');
  });

  await t.test('merges tailwind classes and resolves conflicts', () => {
    assert.strictEqual(cn('p-4', 'p-8'), 'p-8');
  });

  await t.test('handles conditional classes', () => {
    assert.strictEqual(cn('p-4', true && 'm-4', false && 'hidden'), 'p-4 m-4');
  });

  await t.test('handles arrays', () => {
    assert.strictEqual(cn(['p-4', 'm-4']), 'p-4 m-4');
  });

  await t.test('handles objects', () => {
    assert.strictEqual(cn({ 'p-4': true, 'm-4': false }), 'p-4');
  });

  await t.test('handles undefined and null', () => {
    assert.strictEqual(cn('p-4', undefined, null, 'm-4'), 'p-4 m-4');
  });
});
