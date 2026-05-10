import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDrugClass } from './drug-db.ts';

describe('getDrugClass', () => {
  it('should return the correct drug class for a known drug', () => {
    assert.strictEqual(getDrugClass('fluoxetine'), 'SSRIs');
    assert.strictEqual(getDrugClass('lisinopril'), 'Antihypertensives (ACE inhibitors)');
    assert.strictEqual(getDrugClass('adalimumab'), 'Biologics (TNF inhibitors)');
  });

  it('should be case-insensitive and handle whitespace', () => {
    assert.strictEqual(getDrugClass('  Fluoxetine  '), 'SSRIs');
    assert.strictEqual(getDrugClass('FLUOXETINE'), 'SSRIs');
    assert.strictEqual(getDrugClass('lIsInOpRiL'), 'Antihypertensives (ACE inhibitors)');
  });

  it('should return null for unknown drugs', () => {
    assert.strictEqual(getDrugClass('unknownDrug123'), null);
    assert.strictEqual(getDrugClass('aspirin'), null); // Assuming aspirin is not in the db
  });

  it('should return null for empty or whitespace-only inputs', () => {
    assert.strictEqual(getDrugClass(''), null);
    assert.strictEqual(getDrugClass('   '), null);
  });
});
