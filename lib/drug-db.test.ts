import { describe, test } from 'node:test';
import assert from 'node:assert';
import { getDrugClass } from './drug-db.ts';

describe('drug-db', () => {
  describe('getDrugClass', () => {
    test('returns correct class for known drugs', () => {
      assert.strictEqual(getDrugClass('fluoxetine'), 'SSRIs');
      assert.strictEqual(getDrugClass('venlafaxine'), 'SNRIs');
      assert.strictEqual(getDrugClass('lithium'), 'Mood Stabilizers / Anticonvulsants');
      assert.strictEqual(getDrugClass('adalimumab'), 'Biologics (TNF inhibitors)');
    });

    test('handles case-insensitivity and whitespace', () => {
      assert.strictEqual(getDrugClass('  FluOxetine  '), 'SSRIs');
      assert.strictEqual(getDrugClass('LITHIUM'), 'Mood Stabilizers / Anticonvulsants');
      assert.strictEqual(getDrugClass('\n\tvenlafaxine\r\n'), 'SNRIs');
    });

    test('returns null for unknown drugs', () => {
      assert.strictEqual(getDrugClass('unknown_drug'), null);
      assert.strictEqual(getDrugClass('magic_potion'), null);
    });

    test('returns null for empty or whitespace-only strings', () => {
      assert.strictEqual(getDrugClass(''), null);
      assert.strictEqual(getDrugClass('   '), null);
    });
  });
});
