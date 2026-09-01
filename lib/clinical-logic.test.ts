import { test } from 'node:test';
import * as assert from 'node:assert';
import { suggestReplacements } from './clinical-logic';

test('suggestReplacements returns expected results for antidepressant', () => {
  const req = {
    fromDrug: 'fluoxetine',
    currentDose: '20',
    duration: '6 months',
    reason: 'Weight Gain',
    secondaryEffect: 'none',
  };
  const results = suggestReplacements(req);
  assert.ok(results.length > 0);
  const isBupropionSuggested = results.some(r => r.drug === 'Bupropion');
  assert.ok(isBupropionSuggested);

  const isHaloperidolSuggested = results.some(r => r.drug === 'Haloperidol');
  assert.strictEqual(isHaloperidolSuggested, false);
});

test('suggestReplacements returns expected results for biologic', () => {
  const req = {
    fromDrug: 'adalimumab',
    currentDose: '40',
    duration: '1 year',
    reason: 'Lack of efficacy',
    secondaryEffect: 'none',
    indication: 'Rheumatoid Arthritis'
  };
  const results = suggestReplacements(req);
  assert.ok(results.length > 0);

  const isSarilumabSuggested = results.some(r => r.drug === 'Sarilumab');
  assert.ok(isSarilumabSuggested);
});
