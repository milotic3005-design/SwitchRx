import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import { classifyVesicant } from './vesicant-list.ts';

describe('classifyVesicant', () => {
  test('returns correct class for exact matches', () => {
    assert.equal(classifyVesicant('doxorubicin'), 'dna_binding');
    assert.equal(classifyVesicant('vincristine'), 'non_dna_binding');
    assert.equal(classifyVesicant('vancomycin'), 'irritant');
  });

  test('handles case-insensitivity and whitespace', () => {
    assert.equal(classifyVesicant('  DOXOrubicin '), 'dna_binding');
    assert.equal(classifyVesicant('\tVINcristine\n'), 'non_dna_binding');
    assert.equal(classifyVesicant(' Vancomycin  '), 'irritant');
  });

  test('returns correct class for partial matches', () => {
    // Contains "doxorubicin" (dna_binding)
    assert.equal(classifyVesicant('doxorubicin hydrochloride'), 'dna_binding');

    // Contains "vincristine" (non_dna_binding)
    assert.equal(classifyVesicant('vincristine sulfate'), 'non_dna_binding');

    // Contains "calcium gluconate" (irritant)
    assert.equal(classifyVesicant('calcium gluconate injection'), 'irritant');
  });

  test('returns null for non-matches', () => {
    assert.equal(classifyVesicant('acetaminophen'), null);
    assert.equal(classifyVesicant('ibuprofen'), null);
    assert.equal(classifyVesicant(''), null);
    assert.equal(classifyVesicant('   '), null);
  });
});
