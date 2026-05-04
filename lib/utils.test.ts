import { test, describe } from 'node:test';
import assert from 'node:assert';
import { formatDomain } from './utils.ts';

describe('formatDomain', () => {
  test('returns hostname from valid URL', () => {
    assert.strictEqual(formatDomain('https://example.com/path'), 'example.com');
  });

  test('strips "www." from valid URL', () => {
    assert.strictEqual(formatDomain('https://www.example.com/path'), 'example.com');
  });

  test('returns original string when URL is invalid', () => {
    // Missing scheme, so new URL() throws
    assert.strictEqual(formatDomain('invalid-url-string'), 'invalid-url-string');
  });

  test('handles different schemes', () => {
    assert.strictEqual(formatDomain('http://test.com'), 'test.com');
    assert.strictEqual(formatDomain('ftp://www.ftp-server.net'), 'ftp-server.net');
  });

  test('handles ports in URL', () => {
    assert.strictEqual(formatDomain('http://www.domain.com:8080/path'), 'domain.com');
  });
});
