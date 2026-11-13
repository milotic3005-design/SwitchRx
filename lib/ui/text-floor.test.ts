import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// The readability floor: no text below 13px. One block in app/globals.css raises every small text-size
// class to 13px. These tests read the source from disk, so a small size added later without the floor
// covering it fails here rather than shipping.
const ROOT = path.resolve(import.meta.dirname, '../..');
const FLOOR = 13;

function tsxFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return tsxFiles(rel);
    return entry.name.endsWith('.tsx') ? [rel] : [];
  });
}

const sources = [...tsxFiles('app'), ...tsxFiles('components')].map(file => ({
  file,
  text: readFileSync(path.join(ROOT, file), 'utf8'),
}));
const css = readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');
const floorBlock = css.slice(css.indexOf('READABILITY FLOOR'), css.indexOf('END READABILITY FLOOR'));

/** A class as a selector in the floor block, e.g. `html .text-\[10\.5px\]`. */
const selector = (cls: string) => `html .${cls.replace(/([\[\].:])/g, '\\$1')}`;

/** The body of the rule for `name` that sets a font size. */
function ruleBody(name: string): string {
  const rule = new RegExp(`${name.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.matchAll(rule)].map(m => m[1]).find(body => body.includes('font-size')) ?? '';
}

describe('readability floor', () => {
  it('covers every text-size class below 13px in the floor block', () => {
    const classes = new Set<string>();
    for (const { text } of sources) {
      // Any variant prefix counts, bracketed ones included (`[&_table]:text-[12px]`, `md:text-xs`).
      for (const m of text.matchAll(/(?<![\w-])((?:[^\s"'`:]+:)*)text-(?:xs|\[(\d+(?:\.\d+)?)px\])(?![\w-])/g)) {
        // text-xs is 12px in Tailwind.
        const size = m[2] === undefined ? 12 : parseFloat(m[2]);
        if (size < FLOOR) classes.add(m[0]);
      }
    }
    expect(classes.size).toBeGreaterThan(0);
    // A variant (`hover:`, `md:`, `[&_th]:`) generates its own selector that the floor block does not match,
    // so a small size behind a variant would render small. Such a class has to be raised at its source.
    const behindVariant = [...classes].filter(cls => cls.lastIndexOf(':') > 0);
    expect(behindVariant).toEqual([]);
    for (const cls of classes) expect(floorBlock, cls).toContain(selector(cls));
  });

  it('sets every small class in the block to 13px', () => {
    expect(floorBlock).toMatch(/font-size:\s*13px/);
    expect(floorBlock).not.toMatch(/font-size:\s*(?:[0-9]|1[0-2])(?:\.\d+)?px/);
  });

  it('has no numeric inline font size below 13', () => {
    const inlineSizes = sources.flatMap(({ file, text }) =>
      [...text.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)].map(m => ({ file, size: parseFloat(m[1]) })),
    );
    for (const { file, size } of inlineSizes) expect(size, file).toBeGreaterThanOrEqual(FLOOR);
  });

  it('builds a font size from a formula only on the Solitaire cards', () => {
    const filesWithComputedSizes = sources.filter(({ text }) => /fontSize:\s*`/.test(text)).map(s => s.file);
    expect(filesWithComputedSizes).toEqual(['components/BreakRoom.tsx']);
  });

  it('keeps the eyebrow and nav-link helpers at the floor', () => {
    for (const name of ['.cc-eyebrow', '.cc-navlink']) expect(ruleBody(name), name).toMatch(/font-size:\s*13px/);
  });
});
