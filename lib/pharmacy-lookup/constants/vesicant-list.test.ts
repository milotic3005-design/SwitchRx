import { test, describe } from 'node:test';
import assert from 'node:assert';
import { classifyVesicant } from './vesicant-list.ts';

describe('classifyVesicant', () => {
  test('exact matches', () => {
    assert.strictEqual(classifyVesicant('doxorubicin'), 'dna_binding');
    assert.strictEqual(classifyVesicant('vincristine'), 'non_dna_binding');
    assert.strictEqual(classifyVesicant('vancomycin'), 'irritant');
  });

  test('partial matches (fallback)', () => {
    assert.strictEqual(classifyVesicant('doxorubicin hydrochloride'), 'dna_binding');
    assert.strictEqual(classifyVesicant('vincristine sulfate'), 'non_dna_binding');
    assert.strictEqual(classifyVesicant('vancomycin hcl'), 'irritant');
  });

  test('whitespace and case insensitivity', () => {
    assert.strictEqual(classifyVesicant('  DOXORUBICIN  '), 'dna_binding');
    assert.strictEqual(classifyVesicant('Vincristine'), 'non_dna_binding');
    assert.strictEqual(classifyVesicant('  Vancomycin  '), 'irritant');
  });

  test('no match', () => {
    assert.strictEqual(classifyVesicant('acetaminophen'), null);
    assert.strictEqual(classifyVesicant('normal saline'), null);
    assert.strictEqual(classifyVesicant(''), null);
  });
});
