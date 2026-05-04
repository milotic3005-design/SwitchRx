import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizePHI } from './sanitization.ts';

describe('sanitizePHI', () => {
  test('should redact dates in various formats', () => {
    assert.strictEqual(sanitizePHI('Patient DOB is 01/15/1980.'), 'Patient DOB is [DATE].');
    assert.strictEqual(sanitizePHI('Admission date: 1-15-20'), 'Admission date: [DATE]');
    assert.strictEqual(sanitizePHI('Date: 12/5/2023'), 'Date: [DATE]');
    assert.strictEqual(sanitizePHI('Discharge: 1-5-23'), 'Discharge: [DATE]');
    assert.strictEqual(sanitizePHI('Not a date: 12345'), 'Not a date: 12345');
  });

  test('should redact Social Security Numbers', () => {
    assert.strictEqual(sanitizePHI('My SSN is 123-45-6789.'), 'My SSN is [SSN].');
    assert.strictEqual(sanitizePHI('SSN 000-00-0000'), 'SSN [SSN]');
    assert.strictEqual(sanitizePHI('Not an SSN: 123456789'), 'Not an SSN: 123456789'); // No dashes
  });

  test('should redact phone numbers in various formats', () => {
    assert.strictEqual(sanitizePHI('Call me at 555-123-4567.'), 'Call me at [PHONE].');
    assert.strictEqual(sanitizePHI('Phone: 555.123.4567'), 'Phone: [PHONE]');
    assert.strictEqual(sanitizePHI('Direct: 1234567890'), 'Direct: [PHONE]');
    assert.strictEqual(sanitizePHI('Not a phone: 12345'), 'Not a phone: 12345');
  });

  test('should redact MRNs (Medical Record Numbers)', () => {
    assert.strictEqual(sanitizePHI('Patient MRN 1234567.'), 'Patient [MRN].');
    assert.strictEqual(sanitizePHI('MRN# 987654321'), '[MRN]');
    assert.strictEqual(sanitizePHI('mrn 12345678'), '[MRN]');
    assert.strictEqual(sanitizePHI('MRN # 1234567'), '[MRN]');
    assert.strictEqual(sanitizePHI('MRN1234567'), '[MRN]');
    assert.strictEqual(sanitizePHI('Patient number is 1234567'), 'Patient number is 1234567'); // Does not contain MRN prefix
  });

  test('should redact multiple PHI types in a single string', () => {
    const input = 'Patient MRN 1234567 was admitted on 10/12/2023. SSN: 987-65-4321. Phone: 555-999-0000.';
    const expected = 'Patient [MRN] was admitted on [DATE]. SSN: [SSN]. Phone: [PHONE].';
    assert.strictEqual(sanitizePHI(input), expected);
  });

  test('should not alter strings without PHI', () => {
    assert.strictEqual(sanitizePHI('Patient has a headache and fever.'), 'Patient has a headache and fever.');
    assert.strictEqual(sanitizePHI('The dosage is 500mg daily.'), 'The dosage is 500mg daily.');
  });
});
