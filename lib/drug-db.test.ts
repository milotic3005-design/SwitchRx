import { test } from 'node:test';
import assert from 'node:assert';
import { getDrugProfile, getAllDrugs, getDrugClass } from './drug-db.ts';

test('getDrugProfile', async (t) => {
  await t.test('returns null for empty string', () => {
    assert.strictEqual(getDrugProfile(''), null);
  });

  await t.test('returns profile for exact match (lowercase)', () => {
    const profile = getDrugProfile('citalopram');
    assert.ok(profile);
    assert.strictEqual(profile?.name, 'Citalopram');
  });

  await t.test('returns profile for exact match (case insensitive)', () => {
    const profile = getDrugProfile('Citalopram');
    assert.ok(profile);
    assert.strictEqual(profile?.name, 'Citalopram');
  });

  await t.test('returns profile for exact match (with whitespace)', () => {
    const profile = getDrugProfile('  citalopram  ');
    assert.ok(profile);
    assert.strictEqual(profile?.name, 'Citalopram');
  });

  await t.test('returns profile for partial match (input contains drug name)', () => {
    const profile = getDrugProfile('Citalopram 20mg');
    assert.ok(profile);
    assert.strictEqual(profile?.name, 'Citalopram');
  });

  await t.test('returns profile for partial match (drug name contains input)', () => {
    const profile = getDrugProfile('citalo');
    assert.ok(profile);
    assert.strictEqual(profile?.name, 'Citalopram');
  });

  await t.test('returns null for non-existent drug', () => {
    assert.strictEqual(getDrugProfile('nonexistent-drug'), null);
  });
});

test('getAllDrugs', () => {
  const drugs = getAllDrugs();
  assert.ok(Array.isArray(drugs));
  assert.ok(drugs.includes('citalopram'));
  assert.ok(drugs.includes('escitalopram'));
});

test('getDrugClass', async (t) => {
  await t.test('returns correct class for known drug', () => {
    assert.strictEqual(getDrugClass('citalopram'), 'SSRIs');
  });

  await t.test('handles case sensitivity and whitespace', () => {
    assert.strictEqual(getDrugClass('  Citalopram  '), 'SSRIs');
  });

  await t.test('returns null for unknown drug', () => {
    assert.strictEqual(getDrugClass('unknown'), null);
  });
});
