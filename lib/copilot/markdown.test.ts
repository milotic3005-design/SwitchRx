import { describe, it, expect } from 'vitest';
import { buildDrugMatcher, injectDrugLinks, repairBriefMarkdown } from './markdown';

describe('injectDrugLinks', () => {
  it('links a drug name once per segment and leaves citation markers alone', () => {
    const m = buildDrugMatcher();
    const out = injectDrugLinks('Infliximab 5 mg/kg. [cite](#cite:1) Infliximab again.', m);
    expect(out).toBe('[Infliximab](#drug:infliximab) 5 mg/kg. [cite](#cite:1) [Infliximab](#drug:infliximab) again.');
  });
});

describe('repairBriefMarkdown', () => {
  it('promotes a bare section label to a heading and separates adjacent bold lead-ins', () => {
    const out = repairBriefMarkdown('Recommended Regimen\n**Induction:** 5 mg/kg\n**Maintenance:** every 8 weeks');
    expect(out).toBe('### Recommended Regimen\n**Induction:** 5 mg/kg\n\n**Maintenance:** every 8 weeks');
  });
});
