import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Calculator } from 'lucide-react';
import { describe, it, expect } from 'vitest';
import { fieldClass, labelClass, primaryButtonClass, quietButtonClass } from '@/components/ui/styles';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { SectionCard } from '@/components/ui/SectionCard';

// "Match": every tool in scope uses the shared header, field, button, switch and card pieces in
// components/ui. These tests read the source from disk, so a tool that styles its own field or primary
// button again fails here. Each task of the Match plan adds the files it migrates to the lists below.
const ROOT = path.resolve(import.meta.dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

/** Tools whose fields, primary buttons and switches must come from components/ui. */
const IN_SCOPE: string[] = [];

/** Tool pages whose header must be the shared PageHeader. */
const PAGES: string[] = [
  'app/page.tsx', // the Switching Protocols tab
  'components/ClinicalCalculators.tsx',
  'components/DrugReference.tsx',
  'components/MixingGuide.tsx',
  'components/BreakRoom.tsx',
];

/** Search boxes keep their own large style (spec section 2). Matched against the placeholder text. */
const SEARCH_EXEMPT = [
  'Search by generic name, brand name, or drug class', // Drug Reference
  'Search a drug', // Mixing Guide
  'Generic or brand name', // Diluent drug search
];

/** Each `<input>`, `<select>` and `<textarea>` opening tag, up to the `>` that closes it outside any `{…}`. */
function fieldTags(text: string): string[] {
  const tags: string[] = [];
  for (const m of text.matchAll(/<(?:input|select|textarea)(?![\w-])/g)) {
    let depth = 0;
    let quote: string | null = null;
    let i = m.index + m[0].length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(text.slice(m.index, i + 1));
  }
  return tags;
}

const ownBackground = (tag: string) => /(?<![\w-])bg-/.test(tag);
const exempt = (tag: string) =>
  /type="(?:checkbox|radio|range)"/.test(tag) || SEARCH_EXEMPT.some(placeholder => tag.includes(placeholder));

describe('Match: tools use the shared pieces', () => {
  it.each(IN_SCOPE)('%s defines no field or label class of its own', file => {
    expect(read(file)).not.toMatch(/const (?:inputCls|labelCls)\s*=/);
  });

  it.each(IN_SCOPE)('%s uses the shared primary button', file => {
    expect(read(file)).not.toContain('btn-premium');
  });

  it.each(IN_SCOPE)('%s styles no input or select itself', file => {
    const styledHere = fieldTags(read(file)).filter(tag => !exempt(tag) && ownBackground(tag));
    expect(styledHere).toEqual([]);
  });

  it.each(PAGES)('%s renders PageHeader and no h1 of its own', file => {
    const text = read(file);
    expect(text).toMatch(/import\s*\{[^}]*\bPageHeader\b[^}]*\}\s*from\s*['"]@\/components\/ui\/PageHeader['"]/);
    expect(text).not.toMatch(/<h1(?![\w-])/);
  });

  it('finds every field tag, even one whose handler contains an arrow', () => {
    const tags = fieldTags('<input onChange={e => set(e.target.value)} className="bg-black/30" /><select value={v}>');
    expect(tags).toHaveLength(2);
    expect(ownBackground(tags[0])).toBe(true);
    expect(ownBackground(tags[1])).toBe(false);
  });
});

describe('Match: the shared pieces', () => {
  it('keeps the shared class strings as specified', () => {
    expect(fieldClass).toContain('bg-black/30');
    expect(fieldClass).toContain('text-base');
    expect(labelClass).toContain('text-[13px]');
    expect(primaryButtonClass).toContain('btn-premium');
    expect(quietButtonClass).toContain('bg-white/5');
  });

  it('PageHeader renders one h1 with the title, and the description', () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, { icon: Calculator, title: 'Clinical Calculators', description: 'Dosing tools.' }),
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('Clinical Calculators</h1>');
    expect(html).toContain('Dosing tools.');
  });

  it('Button gives each variant its class and keeps the caller’s classes after it', () => {
    const primary = renderToStaticMarkup(createElement(Button, { variant: 'primary', className: 'px-3.5' }, 'Check'));
    const quiet = renderToStaticMarkup(createElement(Button, { variant: 'quiet', disabled: true }, 'Copy'));
    expect(primary).toContain(`class="${primaryButtonClass} px-3.5"`);
    expect(primary).toContain('type="button"');
    expect(quiet).toContain(`class="${quietButtonClass}"`);
    expect(quiet).toContain('disabled=""');
  });

  const units = [
    { value: 'kg', label: 'kg' },
    { value: 'lb', label: 'lb' },
  ] as const;
  const segmented = (value: 'kg' | 'lb' | '', disabled = false) =>
    renderToStaticMarkup(
      createElement(Segmented<'kg' | 'lb'>, { options: units, value, onChange: () => {}, ariaLabel: 'Weight unit', disabled }),
    );

  it('Segmented is a labelled group that presses only the chosen option', () => {
    const html = segmented('lb');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Weight unit"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*>lb</);
  });

  it('Segmented presses nothing before a choice, and disables every option when disabled', () => {
    expect(segmented('')).not.toContain('aria-pressed="true"');
    expect(segmented('kg', true).match(/disabled=""/g)).toHaveLength(2);
  });

  it('SectionCard shows its title and switches to the violet tint', () => {
    const neutral = renderToStaticMarkup(SectionCard({ icon: Calculator, title: 'Condition', children: 'x' }));
    const violet = renderToStaticMarkup(
      SectionCard({ icon: Calculator, title: 'Administration Summary', tone: 'violet', children: 'x' }),
    );
    expect(neutral).toContain('Condition');
    expect(neutral).toContain('bg-white/5');
    expect(violet).toContain('bg-violet-500/10');
  });
});
