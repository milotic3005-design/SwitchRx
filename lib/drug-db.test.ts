import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getDrugProfile, getAllDrugs, getDrugClass } from './drug-db.ts';

describe('drug-db', () => {
  describe('getDrugProfile', () => {
    it('should return null for empty or null input', () => {
      assert.strictEqual(getDrugProfile(''), null);
      // @ts-ignore
      assert.strictEqual(getDrugProfile(null), null);
    });

    it('should return the correct profile for exact lowercase match', () => {
      const profile = getDrugProfile('citalopram');
      assert.ok(profile);
      assert.strictEqual(profile.name, 'Citalopram');
    });

    it('should be case-insensitive and handle whitespace', () => {
      const profile = getDrugProfile('  CITALOPRAM  ');
      assert.ok(profile);
      assert.strictEqual(profile.name, 'Citalopram');
    });

    it('should handle partial matches where input contains the key (e.g., "Citalopram 20mg")', () => {
      const profile = getDrugProfile('Citalopram 20mg');
      assert.ok(profile);
      assert.strictEqual(profile.name, 'Citalopram');
    });

    it('should handle partial matches where key contains the input (e.g., "citalo")', () => {
      const profile = getDrugProfile('citalo');
      assert.ok(profile);
      assert.strictEqual(profile.name, 'Citalopram');
    });

    it('should return null for non-existent drug', () => {
      assert.strictEqual(getDrugProfile('non-existent-drug'), null);
    });
  });

  describe('getAllDrugs', () => {
    it('should return an array of drug keys', () => {
      const allDrugs = getAllDrugs();
      assert.ok(Array.isArray(allDrugs));
      assert.ok(allDrugs.includes('citalopram'));
      assert.ok(allDrugs.length > 0);
    });
  });

  describe('getDrugClass', () => {
    it('should return the correct class for a known drug', () => {
      assert.strictEqual(getDrugClass('citalopram'), 'SSRIs');
      assert.strictEqual(getDrugClass('quetiapine'), 'Antipsychotics (Atypical)');
    });

    it('should be case-insensitive', () => {
      assert.strictEqual(getDrugClass('  CITALOPRAM  '), 'SSRIs');
    });

    it('should return null for unknown drug', () => {
      assert.strictEqual(getDrugClass('non-existent-drug'), null);
    });
  });
});
