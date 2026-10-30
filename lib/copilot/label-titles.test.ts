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
  describe('by name, only on label links', () => {
    // Every fda.gov page is typed as an FDA label, and Gemini's grounding title for these links is just the domain.
    const fdaPage = (url: string) => ({ ...label, title: 'fda.gov', site: new URL(url).hostname, url });

    it('leaves an FDA page that is not a label alone even when its link names the drug', () => {
      for (const [url, drug] of [
        // The Drug Shortages page cited for "alternatives when cefazolin is on shortage".
        ['https://www.accessdata.fda.gov/scripts/drugshortages/dsp_ActiveIngredientDetails.cfm?AI=Cefazolin%20Sodium%20Injection&st=c', 'cefazolin'],
        // A Drug Safety Communication.
        ['https://www.fda.gov/drugs/drug-safety-and-availability/fda-drug-safety-communication-vancomycin-dosing-errors', 'vancomycin'],
      ]) {
        const source = fdaPage(url);
        expect(titleFdaLabels([source], lookupFor(drug))[0], url).toEqual(source);
      }
    });
    it('still names a DailyMed page or a Drugs@FDA label link by the drug in it', () => {
      const dailymed = fdaPage('https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=cefazolin');
      const pdf = fdaPage('https://www.accessdata.fda.gov/drugsatfda_docs/label/2021/cefazolin_sodium_lbl.pdf');
      expect(titleFdaLabels([dailymed, pdf], lookupFor('cefazolin')).map(s => s.title)).toEqual([
        'Ancef (Cefazolin) prescribing information',
        'Ancef (Cefazolin) prescribing information',
      ]);
    });
  });
  describe('by label identifiers', () => {
    const ACCESSDATA = 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/103772s5412lbl.pdf';
    const SET_ID = 'B4F9D3A1-5C7E-4E2B-9F6A-0D8C1E2F3A4B';
    // Gemini's grounding title for these links is just the domain.
    const fdaLink = (url: string) => ({ ...label, title: 'fda.gov', site: 'accessdata.fda.gov', url });
    const remicade = () => {
      const l = lookupFor('infliximab');
      Object.assign(l.drug_lookups[0], { application_number: 'BLA103772', set_id: SET_ID });
      return l;
    };

    it('matches a Drugs@FDA label PDF by the application number in its file name', () => {
      expect(titleFdaLabels([fdaLink(ACCESSDATA)], remicade())[0].title).toBe('Remicade (Infliximab) prescribing information');
    });
    it('strips the NDA, BLA or ANDA prefix and keeps leading zeros', () => {
      const l = lookupFor('vancomycin');
      l.drug_lookups[0].application_number = 'ANDA062911';
      const pdf = fdaLink('https://www.accessdata.fda.gov/drugsatfda_docs/label/2020/062911s041lbl.pdf');
      expect(titleFdaLabels([pdf], l)[0].title).toBe('Vancocin (Vancomycin) prescribing information');
    });
    it('matches the application number only as a whole token in the path', () => {
      for (const url of [
        'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/1037721s001lbl.pdf',
        'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/2103772lbl.pdf',
        'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=103772',
      ]) {
        const source = fdaLink(url);
        expect(titleFdaLabels([source], remicade())[0], url).toEqual(source);
      }
      expect(titleFdaLabels([fdaLink('https://www.accessdata.fda.gov/label/103772/')], remicade())[0].title)
        .toBe('Remicade (Infliximab) prescribing information');
    });
    it('matches the application number only on an FDA label link', () => {
      // An approval letter and a review carry the same application number but are not the label.
      for (const url of [
        'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/2021/103772Orig1s5401ltr.pdf',
        'https://www.accessdata.fda.gov/drugsatfda_docs/nda/99/103772_Remicade_medr.pdf',
        'https://www.accessdata.fda.gov/drugsatfda_docs/nda/99/103772_Remicade.cfm',
      ]) {
        const source = fdaLink(url);
        expect(titleFdaLabels([source], remicade())[0], url).toEqual(source);
      }
      // A label PDF named …lbl.pdf outside a /label/ folder still counts.
      const lbl = fdaLink('https://www.accessdata.fda.gov/drugsatfda_docs/103772s5412lbl.pdf');
      expect(titleFdaLabels([lbl], remicade())[0].title).toBe('Remicade (Infliximab) prescribing information');
    });
    it('needs at least five digits in the application number', () => {
      const l = lookupFor('infliximab');
      l.drug_lookups[0].application_number = 'NDA2025';
      const source = fdaLink(ACCESSDATA);
      expect(titleFdaLabels([source], l)[0]).toEqual(source);
    });
    it('matches a DailyMed link by its set id, ignoring case', () => {
      const dailymed = { ...label, title: 'dailymed.nlm.nih.gov', url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${SET_ID.toLowerCase()}` };
      expect(titleFdaLabels([dailymed], remicade())[0].title).toBe('Remicade (Infliximab) prescribing information');
    });
    it('titles each label with the drug whose identifiers it carries', () => {
      const both = lookupFor('vancomycin', 'infliximab');
      Object.assign(both.drug_lookups[0], { application_number: 'ANDA062911' });
      Object.assign(both.drug_lookups[1], { application_number: 'BLA103772' });
      expect(titleFdaLabels([fdaLink(ACCESSDATA)], both)[0].title).toBe('Remicade (Infliximab) prescribing information');
    });
    it('still requires an FDA-label source', () => {
      const web = { ...fdaLink(ACCESSDATA), type: 'web' as const };
      expect(titleFdaLabels([web], remicade())[0]).toEqual(web);
    });
  });
  it('does not mutate its input', () => {
    const before = { ...label };
    titleFdaLabels([label], lookup);
    expect(label).toEqual(before);
  });
});
