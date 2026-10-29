import { describe, it, expect } from 'vitest';
import { titleFdaLabels } from './label-titles';
import { fallbackSource } from './source-types';
import type { LookupResult } from '@/lib/pharmacy-lookup';

const V = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc';
const label = { ...fallbackSource({ uri: V, title: 'DailyMed - INFLIXIMAB injection' }), type: 'fda-label' as const };
const lookupFor = (...names: string[]) => ({
  classification: { drug_names: names, query_domain: 'iv_drug_info', urgency: 'routine' },
  drug_lookups: names.map(generic_name => ({ generic_name, label_sections: [] })),
  safety_flags: [],
  data_sources_used: [],
}) as LookupResult;
const lookup = lookupFor('infliximab');

describe('titleFdaLabels', () => {
  it('titles an FDA label that names a looked-up drug', () => {
    expect(titleFdaLabels([label], lookup)[0].title).toBe('Remicade (Infliximab) prescribing information');
  });
  it('leaves non-label sources, unmatched labels, and a null lookup unchanged', () => {
    const web = fallbackSource({ uri: V, title: 'DailyMed - INFLIXIMAB' });
    const other = { ...label, title: 'DailyMed - VANCOMYCIN' };
    expect(titleFdaLabels([web, other], lookup)).toEqual([web, other]);
    expect(titleFdaLabels([label], null)).toEqual([label]);
  });
  it('matches the generic name in the resolved url when the title does not name the drug', () => {
    const byUrl = { ...label, title: 'DailyMed', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?query=infliximab' };
    expect(titleFdaLabels([byUrl], lookup)[0].title).toBe('Remicade (Infliximab) prescribing information');
  });
  it('omits the brand when the drug is not in the drug database', () => {
    const l = { ...label, title: 'DailyMed - Notarealdrug injection' };
    expect(titleFdaLabels([l], lookupFor('notarealdrug'))[0].title).toBe('Notarealdrug prescribing information');
  });
  it('prefers the longest matching generic name', () => {
    const l = { ...label, title: 'DailyMed - AMPICILLIN AND SULBACTAM ampicillin-sulbactam' };
    expect(titleFdaLabels([l], lookupFor('ampicillin', 'ampicillin-sulbactam'))[0].title)
      .toBe('Unasyn (Ampicillin-Sulbactam) prescribing information');
  });
  it('does not match on an empty generic name', () => {
    expect(titleFdaLabels([label], lookupFor(''))).toEqual([label]);
  });
  it('does not mutate its input', () => {
    const before = { ...label };
    titleFdaLabels([label], lookup);
    expect(label).toEqual(before);
  });
});
