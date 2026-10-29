import { describe, it, expect } from 'vitest';
import { safeHttpUrl } from './safe-url';

describe('safeHttpUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(safeHttpUrl('https://www.fda.gov/label?id=1')).toBe('https://www.fda.gov/label?id=1');
    expect(safeHttpUrl('http://example.org/a')).toBe('http://example.org/a');
  });

  it('rejects script, data, file and other protocols in any case', () => {
    for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://example.org/x', 'mailto:a@b.co']) {
      expect(safeHttpUrl(url)).toBeNull();
    }
  });

  it('rejects relative, protocol-relative, empty and non-string values', () => {
    for (const url of ['/relative/path', '//example.org/x', 'example.org', '', '   ', null, undefined]) {
      expect(safeHttpUrl(url)).toBeNull();
    }
    expect(safeHttpUrl(42 as unknown as string)).toBeNull();
  });
});
