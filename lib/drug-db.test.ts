import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDrugClass } from './drug-db.ts';

describe('getDrugClass', () => {
  it('should return the correct class for a known drug', () => {
    assert.strictEqual(getDrugClass('citalopram'), 'SSRIs');
    assert.strictEqual(getDrugClass('lisinopril'), 'Antihypertensives (ACE inhibitors)');
    assert.strictEqual(getDrugClass('haloperidol'), 'Antipsychotics (Typical)');
  });

  it('should handle case insensitivity', () => {
    assert.strictEqual(getDrugClass('CITALOPRAM'), 'SSRIs');
    assert.strictEqual(getDrugClass('Lisinopril'), 'Antihypertensives (ACE inhibitors)');
    assert.strictEqual(getDrugClass('hAlOpErIdOl'), 'Antipsychotics (Typical)');
  });

  it('should handle leading and trailing whitespaces', () => {
    assert.strictEqual(getDrugClass('  citalopram  '), 'SSRIs');
    assert.strictEqual(getDrugClass('\tlisinopril\n'), 'Antihypertensives (ACE inhibitors)');
  });

  it('should return null for unknown or invalid drugs', () => {
    assert.strictEqual(getDrugClass('unknown_drug'), null);
    assert.strictEqual(getDrugClass('vitamin c'), null);
    assert.strictEqual(getDrugClass(''), null);
    assert.strictEqual(getDrugClass('   '), null);
  });
});
