import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Calculator } from 'lucide-react';
import { describe, it, expect } from 'vitest';
import {
  fieldClass,
  labelClass,
  largeFieldClass,
  primaryButtonClass,
  quietButtonClass,
  smallPrimaryButtonClass,
} from '@/components/ui/styles';
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
const IN_SCOPE: string[] = [
  'components/ClinicalCalculators.tsx',
  'components/IVIGRateCalculator.tsx',
  'components/InfusionRateCalculator.tsx',
  'components/DiluentVolumeAdvisor.tsx',
  'components/IDSAAntibioticAdvisor.tsx',
  'components/SwitchingProtocols.tsx',
  'components/BreakRoom.tsx',
];

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
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    if (text.slice(lineStart, m.index).includes('//')) continue; // named in a comment, not a tag
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
/** Whether a field tag takes the shared field style. A field styled through any other constant fails. */
const sharedField = (tag: string) => /\b(?:fieldClass|largeFieldClass)\b/.test(tag);
/** A disabled field must mute itself with opacity: the theme remaps text colours, so a disabled: colour loses. */
const disabledTag = (tag: string) => /\sdisabled(?=[\s=/>])/.test(tag);
/** Hand-built switches: an either/or choice in scope uses Segmented, which lives in components/ui. */
const ownSwitches = (text: string) => text.match(/aria-pressed|role="group"/g)?.length ?? 0;
/** The calculator picker is a menu of chips, not an either/or choice. It marks the open calculator with aria-pressed. */
const SWITCHES_ALLOWED: Record<string, number> = { 'components/ClinicalCalculators.tsx': 1 };
const exempt = (tag: string) =>
  /type="(?:checkbox|radio|range)"/.test(tag) || SEARCH_EXEMPT.some(placeholder => tag.includes(placeholder));

describe('Match: tools use the shared pieces', () => {
  it.each(IN_SCOPE)('%s defines no field or label class of its own', file => {
    expect(read(file).match(/const (?:inputCls|labelCls)\s*=/)?.[0]).toBeUndefined();
  });

  it.each(IN_SCOPE)('%s uses the shared primary button', file => {
    expect(read(file).match(/btn-premium/g)?.length ?? 0).toBe(0);
  });

  it.each(IN_SCOPE)('%s styles no input or select itself', file => {
    const styledHere = fieldTags(read(file)).filter(tag => !exempt(tag) && ownBackground(tag));
    expect(styledHere).toEqual([]);
  });

  it.each(IN_SCOPE)('%s styles every field with the shared field class', file => {
    const notShared = fieldTags(read(file)).filter(tag => !exempt(tag) && !sharedField(tag));
    expect(notShared).toEqual([]);
  });

  it.each(IN_SCOPE)('%s builds no either/or switch of its own', file => {
    expect(ownSwitches(read(file))).toBeLessThanOrEqual(SWITCHES_ALLOWED[file] ?? 0);
  });

  it.each(IN_SCOPE)('%s mutes each disabled field with opacity', file => {
    const unmuted = fieldTags(read(file)).filter(tag => disabledTag(tag) && !/opacity-/.test(tag));
    expect(unmuted).toEqual([]);
  });

  it('flags a field styled through another constant, a hand-built switch and an unmuted disabled field', () => {
    const [table, shared] = fieldTags('<input className={tableInputCls} /><input className={`${fieldClass} pr-24`} />');
    expect(sharedField(table)).toBe(false);
    expect(sharedField(shared)).toBe(true);
    expect(ownSwitches('<div role="group"><button aria-pressed={on}>A</button></div>')).toBe(2);
    expect(disabledTag('<input value={x} disabled className={fieldClass} />')).toBe(true);
    expect(disabledTag('<input disabled={!ok} className="x" />')).toBe(true);
    expect(disabledTag('<input value={disabledText} />')).toBe(false);
  });

  it.each(PAGES)('%s renders PageHeader and no h1 of its own', file => {
    const text = read(file);
    expect(/import\s*\{[^}]*\bPageHeader\b[^}]*\}\s*from\s*['"]@\/components\/ui\/PageHeader['"]/.test(text)).toBe(true);
    expect(text.match(/<h1(?![\w-])/g)?.length ?? 0).toBe(0);
  });

  it('finds every field tag, even one whose handler contains an arrow', () => {
    const tags = fieldTags('<input onChange={e => set(e.target.value)} className="bg-black/30" /><select value={v}>');
    expect(tags).toHaveLength(2);
    expect(fieldTags('// Build groupings for the <select> dropdown\n')).toEqual([]);
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

  it('makes the large number field the shared field with large, light text and nothing else changed', () => {
    expect(largeFieldClass).toContain('bg-black/30');
    expect(largeFieldClass).toContain('text-3xl font-light');
    expect(largeFieldClass).not.toContain('text-base');
    expect(largeFieldClass.replace('text-3xl font-light', 'text-base font-medium')).toBe(fieldClass);
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
    const primary = renderToStaticMarkup(createElement(Button, { variant: 'primary', className: 'absolute' }, 'Find'));
    const quiet = renderToStaticMarkup(createElement(Button, { variant: 'quiet', disabled: true }, 'Copy'));
    expect(primary).toContain(`class="${primaryButtonClass} absolute"`);
    expect(primary).toContain('type="button"');
    expect(quiet).toContain(`class="${quietButtonClass}"`);
    expect(quiet).toContain('disabled=""');
  });

  it('Button has a small primary size whose padding replaces the large one rather than fighting it', () => {
    const small = renderToStaticMarkup(createElement(Button, { variant: 'primary', size: 'sm' }, 'Check'));
    expect(small).toContain(`class="${smallPrimaryButtonClass}"`);
    expect(smallPrimaryButtonClass).toContain('btn-premium');
    expect(smallPrimaryButtonClass).toContain('px-3.5 py-1.5');
    expect(smallPrimaryButtonClass).not.toMatch(/px-6|py-3(?!\.)/);
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

  it('Segmented gives idle options a hover tint the theme remaps, not a text colour it overrides', () => {
    const idle = segmented('kg').match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0] ?? '';
    expect(idle).toContain('hover:bg-white/5');
    expect(idle).not.toContain('hover:text-white');
  });

  it('Segmented presses nothing before a choice, and disables every option when disabled', () => {
    expect(segmented('')).not.toContain('aria-pressed="true"');
    expect(segmented('kg', true).match(/disabled=""/g)).toHaveLength(2);
  });

  it('Segmented takes a two-line label and shrinks to its options unless told to fill', () => {
    const agents = [
      { value: 'a', label: createElement('span', null, 'Darbepoetin alfa', createElement('span', null, 'Aranesp')) },
      { value: 'b', label: 'Epoetin' },
    ];
    const html = renderToStaticMarkup(
      createElement(Segmented<string>, { options: agents, value: 'a', onChange: () => {}, ariaLabel: 'ESA agent' }),
    );
    expect(html).toContain('<span>Darbepoetin alfa<span>Aranesp</span></span>');
    expect(html).toMatch(/role="group"[^>]*class="inline-flex /);
  });

  it('SectionCard shows its title and switches to the violet tint', () => {
    const neutral = renderToStaticMarkup(SectionCard({ icon: Calculator, title: 'Condition', children: 'x' }));
    const violet = renderToStaticMarkup(
      SectionCard({ icon: Calculator, title: 'Administration Summary', tone: 'violet', children: 'x' }),
    );
    expect(neutral).toContain('Condition');
    expect(neutral).toContain('bg-white/5');
    expect(violet).toContain('bg-violet-500/10');
    expect(violet).toMatch(/text-violet-300[^>]*>Administration Summary</);
  });

  it('SectionCard puts an action at the right of its header row', () => {
    const html = renderToStaticMarkup(
      SectionCard({ icon: Calculator, title: 'Titration Parameters', action: createElement('button', null, 'mg/hr'), children: 'x' }),
    );
    expect(html).toMatch(/justify-between[^>]*>.*Titration Parameters.*<button>mg\/hr<\/button><\/div>x/);
  });
});
