import test from 'node:test';
import assert from 'node:assert';
import { getDrugProfile } from './drug-db.ts';

test('getDrugProfile - Empty or invalid input', () => {
  assert.strictEqual(getDrugProfile(''), null);
  // @ts-expect-error - testing invalid input
  assert.strictEqual(getDrugProfile(null), null);
  // @ts-expect-error - testing invalid input
  assert.strictEqual(getDrugProfile(undefined), null);
});

test('getDrugProfile - Exact match', () => {
  const profile = getDrugProfile('citalopram');
  assert.notStrictEqual(profile, null);
  assert.strictEqual(profile?.name, 'Citalopram');

  // Test case insensitivity and whitespace handling
  const profile2 = getDrugProfile('  Citalopram  ');
  assert.notStrictEqual(profile2, null);
  assert.strictEqual(profile2?.name, 'Citalopram');
});

test('getDrugProfile - Partial match (query contains key)', () => {
  const profile = getDrugProfile('Citalopram 20mg');
  assert.notStrictEqual(profile, null);
  assert.strictEqual(profile?.name, 'Citalopram');
});

test('getDrugProfile - Partial match (key contains query)', () => {
  const profile = getDrugProfile('cital');
  assert.notStrictEqual(profile, null);
  assert.strictEqual(profile?.name, 'Citalopram');
});

test('getDrugProfile - No match', () => {
  const profile = getDrugProfile('NonExistentDrug123');
  assert.strictEqual(profile, null);
});
