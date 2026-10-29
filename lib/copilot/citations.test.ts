import { describe, it, expect } from 'vitest';
import { placeCitations, parseCiteHref, chipLabel, toPlainText } from './citations';
import { fallbackSource } from './source-types';
import type { EnrichedSource } from './types';

describe('placeCitations', () => {
  const body = 'Infuse over **2 hours**. Use a 1.2 µm filter. Monitor vitals.';

  it('places chips after supported sentences, numbering references by first appearance', () => {
    const p = placeCitations(body, [
      { text: 'Use a 1.2 µm filter.', sourceIndices: [2] },
      { text: 'Infuse over 2 hours.', sourceIndices: [0] },
    ], 3);
    expect(p).toEqual({
      markdown: 'Infuse over **2 hours**. [cite](#cite:1) Use a 1.2 µm filter. [cite](#cite:2) Monitor vitals.',
      refs: [0, 2], unplaced: 0, uncited: [],
    });
  });

  it('puts several sources on one chip', () => {
    expect(placeCitations('A fact.', [{ text: 'A fact.', sourceIndices: [1, 0] }], 2).markdown).toBe('A fact. [cite](#cite:1,2)');
  });

  it('merges supports that end at the same place', () => {
    const p = placeCitations('Use a filter.', [{ text: 'Use a filter.', sourceIndices: [0] }, { text: 'a filter.', sourceIndices: [1] }], 2);
    expect(p.markdown).toBe('Use a filter. [cite](#cite:1,2)');
  });

  it('keeps merged source indices in first-seen order, not sorted', () => {
    const p = placeCitations('Use a filter.', [{ text: 'Use a filter.', sourceIndices: [2] }, { text: 'a filter.', sourceIndices: [0] }], 3);
    expect(p).toEqual({ markdown: 'Use a filter. [cite](#cite:1,2)', refs: [2, 0], unplaced: 0, uncited: [] });
  });

  it('drops a support whose text occurs more than once', () => {
    expect(placeCitations('Dose daily. Dose daily.', [{ text: 'Dose daily.', sourceIndices: [0] }], 1))
      .toEqual({ markdown: 'Dose daily. Dose daily.', refs: [], unplaced: 1, uncited: [0] });
  });

  it('drops a support whose text occurs more than once across lines and emphasis', () => {
    expect(placeCitations('Adults: 15 mg/kg q12h.\n- Children: 15 mg/kg q6h', [{ text: '15 mg/kg', sourceIndices: [0] }], 1))
      .toEqual({ markdown: 'Adults: 15 mg/kg q12h.\n- Children: 15 mg/kg q6h', refs: [], unplaced: 1, uncited: [0] });
    expect(placeCitations('Use **a filter.** Then use a filter.', [{ text: 'a filter.', sourceIndices: [0] }], 1))
      .toEqual({ markdown: 'Use **a filter.** Then use a filter.', refs: [], unplaced: 1, uncited: [0] });
  });

  it('drops both of two supports that share an ambiguous text', () => {
    expect(placeCitations('Dose daily. Dose daily.', [
      { text: 'Dose daily.', sourceIndices: [0] },
      { text: 'Dose daily.', sourceIndices: [1] },
    ], 2)).toEqual({ markdown: 'Dose daily. Dose daily.', refs: [], unplaced: 2, uncited: [0, 1] });
  });

  it('drops supports that are not in the answer and keeps their sources out of refs', () => {
    const p = placeCitations('Only this.', [{ text: 'Not present.', sourceIndices: [0] }, { text: 'Only this.', sourceIndices: [1] }], 2);
    expect(p).toEqual({ markdown: 'Only this. [cite](#cite:1)', refs: [1], unplaced: 1, uncited: [0] });
  });

  it('ignores source indices outside the source list', () => {
    expect(placeCitations('X.', [{ text: 'X.', sourceIndices: [5] }], 2)).toEqual({ markdown: 'X.', refs: [], unplaced: 1, uncited: [] });
  });

  it('keeps the valid indices when only some are outside the source list', () => {
    expect(placeCitations('X.', [{ text: 'X.', sourceIndices: [0, 5, -1, 1.5, NaN] }], 2))
      .toEqual({ markdown: 'X. [cite](#cite:1)', refs: [0], unplaced: 0, uncited: [] });
  });

  it('counts a support with no source indices as unplaced', () => {
    expect(placeCitations('X.', [{ text: 'X.', sourceIndices: [] }], 2)).toEqual({ markdown: 'X.', refs: [], unplaced: 1, uncited: [] });
  });

  it('counts a support with empty text as unplaced instead of matching at the start', () => {
    expect(placeCitations('X.', [{ text: '', sourceIndices: [0] }, { text: '  \n ', sourceIndices: [0] }], 1))
      .toEqual({ markdown: 'X.', refs: [], unplaced: 2, uncited: [0] });
  });

  it('lists a repeated source once within a chip', () => {
    expect(placeCitations('X.', [{ text: 'X.', sourceIndices: [0, 0] }], 1).markdown).toBe('X. [cite](#cite:1)');
  });

  it('reuses a reference number when the same source supports a later sentence', () => {
    const p = placeCitations('A. B. C.', [
      { text: 'A.', sourceIndices: [0] },
      { text: 'B.', sourceIndices: [1] },
      { text: 'C.', sourceIndices: [0] },
    ], 2);
    expect(p).toEqual({
      markdown: 'A. [cite](#cite:1) B. [cite](#cite:2) C. [cite](#cite:1)',
      refs: [0, 1], unplaced: 0, uncited: [],
    });
  });

  it('matches across differing whitespace', () => {
    expect(placeCitations('Line one\ncontinues.', [{ text: 'Line one continues.', sourceIndices: [0] }], 1).markdown)
      .toBe('Line one\ncontinues. [cite](#cite:1)');
  });

  it('ignores leading and trailing whitespace on the segment text', () => {
    expect(placeCitations('Only this.', [{ text: '  Only this.\n', sourceIndices: [0] }], 1).markdown).toBe('Only this. [cite](#cite:1)');
  });

  it('matches a segment that carries its own emphasis markers', () => {
    expect(placeCitations('Infuse over **2 hours**.', [{ text: 'Infuse over **2 hours**.', sourceIndices: [0] }], 1).markdown)
      .toBe('Infuse over **2 hours**. [cite](#cite:1)');
  });

  it('places the chip after emphasis markers that close the matched sentence', () => {
    expect(placeCitations('**Use a filter.** Next one.', [{ text: 'Use a filter.', sourceIndices: [0] }], 1).markdown)
      .toBe('**Use a filter.** [cite](#cite:1) Next one.');
    expect(placeCitations('_Use a filter._ Next one.', [{ text: 'Use a filter.', sourceIndices: [0] }], 1).markdown)
      .toBe('_Use a filter._ [cite](#cite:1) Next one.');
  });

  it('collapses whitespace left behind by removed emphasis markers', () => {
    expect(placeCitations('Dose * daily.', [{ text: 'Dose daily.', sourceIndices: [0] }], 1).markdown).toBe('Dose * daily. [cite](#cite:1)');
  });

  describe('word boundaries', () => {
    it('skips an occurrence inside a longer word and places the chip on the real one', () => {
      expect(placeCitations('Do not use unfiltered. Use filtered.', [{ text: 'filtered.', sourceIndices: [0] }], 1).markdown)
        .toBe('Do not use unfiltered. Use filtered. [cite](#cite:1)');
    });

    it('drops a support that only occurs inside a longer word', () => {
      expect(placeCitations('Overdose daily.', [{ text: 'dose daily.', sourceIndices: [0] }], 1))
        .toEqual({ markdown: 'Overdose daily.', refs: [], unplaced: 1, uncited: [0] });
    });

    it('rejects a match that runs into a following letter or digit', () => {
      expect(placeCitations('Give 2.5 mg daily. Give 2.', [{ text: 'Give 2.', sourceIndices: [0] }], 1).markdown)
        .toBe('Give 2.5 mg daily. Give 2. [cite](#cite:1)');
    });

    it('treats a letter that is a surrogate pair as a letter', () => {
      // U+1D431 (mathematical bold x) is a letter outside the BMP.
      expect(placeCitations('\u{1D431}filtered. Use filtered.', [{ text: 'filtered.', sourceIndices: [0] }], 1).markdown)
        .toBe('\u{1D431}filtered. Use filtered. [cite](#cite:1)');
    });

    it('never matches half of a surrogate pair', () => {
      expect(placeCitations('A \u{1F600} B.', [{ text: '\uDE00 B.', sourceIndices: [0] }], 1))
        .toEqual({ markdown: 'A \u{1F600} B.', refs: [], unplaced: 1, uncited: [0] });
      expect(placeCitations('A \u{1F600} B.', [{ text: 'A \uD83D', sourceIndices: [0] }], 1))
        .toEqual({ markdown: 'A \u{1F600} B.', refs: [], unplaced: 1, uncited: [0] });
    });

    it('does not treat emphasis inside a word as a boundary', () => {
      expect(placeCitations('Use un**filtered** water. Fine.', [{ text: 'filtered water.', sourceIndices: [0] }], 1))
        .toEqual({ markdown: 'Use un**filtered** water. Fine.', refs: [], unplaced: 1, uncited: [0] });
    });
  });

  describe('trailing emphasis markers', () => {
    it('does not consume an emphasis run that opens the next span', () => {
      expect(placeCitations('Use a filter.**Bar** baz', [{ text: 'Use a filter.', sourceIndices: [0] }], 1).markdown)
        .toBe('Use a filter. [cite](#cite:1)**Bar** baz');
      expect(placeCitations('Use a filter._Bar_ baz', [{ text: 'Use a filter.', sourceIndices: [0] }], 1).markdown)
        .toBe('Use a filter. [cite](#cite:1)_Bar_ baz');
    });

    it('moves past a closing run at the end of the answer', () => {
      expect(placeCitations('**X.**', [{ text: 'X.', sourceIndices: [0] }], 1).markdown).toBe('**X.** [cite](#cite:1)');
    });

    it('moves past a closing run before punctuation', () => {
      expect(placeCitations('**Use a filter**. Next.', [{ text: 'Use a filter', sourceIndices: [0] }], 1).markdown)
        .toBe('**Use a filter** [cite](#cite:1). Next.');
    });
  });

  describe('overlapping supports and surrogate pairs', () => {
    it('places two overlapping supports with different end points', () => {
      const p = placeCitations('Use a filter. Check the pump.', [
        { text: 'Use a filter. Check the pump.', sourceIndices: [0] },
        { text: 'Use a filter.', sourceIndices: [1] },
      ], 2);
      expect(p).toEqual({
        markdown: 'Use a filter. [cite](#cite:1) Check the pump. [cite](#cite:2)',
        refs: [1, 0], unplaced: 0, uncited: [],
      });
    });

    it('maps positions correctly around emoji', () => {
      const p = placeCitations('\u{1F48A} Use a filter. \u{1F600} Check the pump.', [
        { text: 'Check the pump.', sourceIndices: [1] },
        { text: 'Use a filter.', sourceIndices: [0] },
      ], 2);
      expect(p.markdown).toBe('\u{1F48A} Use a filter. [cite](#cite:1) \u{1F600} Check the pump. [cite](#cite:2)');
    });

    it('matches a segment that itself contains an emoji', () => {
      expect(placeCitations('Give \u{1F48A} daily. Next.', [{ text: 'Give \u{1F48A} daily.', sourceIndices: [0] }], 1).markdown)
        .toBe('Give \u{1F48A} daily. [cite](#cite:1) Next.');
    });
  });

  describe('uncited sources', () => {
    it('lists valid sources of dropped supports that are not cited anywhere, first-seen and de-duplicated', () => {
      const p = placeCitations('A. B.', [
        { text: 'Missing one.', sourceIndices: [2, 1, 2, 9] },
        { text: 'A.', sourceIndices: [1] },
        { text: 'Missing two.', sourceIndices: [0, 2] },
      ], 3);
      expect(p).toEqual({ markdown: 'A. [cite](#cite:1) B.', refs: [1], unplaced: 2, uncited: [2, 0] });
    });

    it('is empty when every support is placed', () => {
      expect(placeCitations('A.', [{ text: 'A.', sourceIndices: [0] }], 1).uncited).toEqual([]);
    });
  });
});

describe('parseCiteHref', () => {
  it('parses chip hrefs', () => expect(parseCiteHref('#cite:1,2')).toEqual([1, 2]));
  it('parses a single reference', () => expect(parseCiteHref('#cite:7')).toEqual([7]));
  it('rejects anything that is not a well-formed cite href', () => {
    for (const href of ['', 'cite:1', '#cite:', '#cite:1,', '#cite:,1', '#cite:a', '#cite:0', '#cite:01', '#cite:1;2', 'https://example.org/#cite:1', '#cite:1,2 ']) {
      expect(parseCiteHref(href), href).toBeNull();
    }
  });
});

describe('chipLabel', () => {
  const a = { ...fallbackSource({ uri: 'u', title: 'x.org' }), shortName: 'N Engl J Med' };
  const b = { ...a, shortName: 'FDA label' };

  it('labels a chip with the first source and a count', () => {
    expect(chipLabel([1, 2], [0, 1], [a, b])).toBe('N Engl J Med + 1');
    expect(chipLabel([2], [0, 1], [a, b])).toBe('FDA label');
  });

  it('follows the reference map to the source', () => {
    expect(chipLabel([1], [1, 0], [a, b])).toBe('FDA label');
  });

  it('counts every other source on the chip', () => {
    const c = { ...a, shortName: 'CDC' };
    expect(chipLabel([2, 1, 3], [0, 1, 2], [a, b, c])).toBe('FDA label + 2');
  });

  it('ignores reference numbers that do not resolve to a source', () => {
    expect(chipLabel([9, 2, 8], [0, 1], [a, b])).toBe('FDA label');
    expect(chipLabel([1, 3], [0, 5], [a, b])).toBe('N Engl J Med');
  });

  it('returns an empty label when nothing resolves', () => {
    expect(chipLabel([9], [0, 1], [a, b])).toBe('');
    expect(chipLabel([], [0, 1], [a, b])).toBe('');
  });
});

describe('toPlainText', () => {
  const s: EnrichedSource = {
    uri: 'u', url: 'https://pubmed.ncbi.nlm.nih.gov/16914701/', site: 'pubmed.ncbi.nlm.nih.gov', title: 'Daptomycin trial.',
    shortName: 'N Engl J Med', journal: 'The New England journal of medicine', year: 2006, type: 'trial',
  };

  it('formats an answer with numbered references for copying', () => {
    expect(toPlainText('Fact. [cite](#cite:1)', [0], [s]))
      .toBe('Fact. [1]\n\nReferences\n1. Daptomycin trial. — The New England journal of medicine, 2006. https://pubmed.ncbi.nlm.nih.gov/16914701/');
  });

  it('joins several references on one chip and lists every reference in order', () => {
    const t: EnrichedSource = { uri: 'v', url: null, site: 'fda.gov', title: 'Cubicin label', shortName: 'FDA label', type: 'fda-label' };
    expect(toPlainText('A. [cite](#cite:2) B. [cite](#cite:1,2)', [1, 0], [s, t]))
      .toBe('A. [2] B. [1, 2]\n\nReferences\n'
        + '1. Cubicin label — fda.gov.\n'
        + '2. Daptomycin trial. — The New England journal of medicine, 2006. https://pubmed.ncbi.nlm.nih.gov/16914701/');
  });

  it('falls back to the site when there is no journal, and drops a missing year and url', () => {
    const t: EnrichedSource = { uri: 'v', url: null, site: 'idsociety.org', title: 'IDSA guideline', shortName: 'IDSA', type: 'guideline' };
    expect(toPlainText('Fact. [cite](#cite:1)', [0], [t])).toBe('Fact. [1]\n\nReferences\n1. IDSA guideline — idsociety.org.');
  });

  it('falls back to the site when the journal is blank', () => {
    const t: EnrichedSource = { uri: 'v', url: null, site: 'nih.gov', title: 'Record', shortName: 'NIH', journal: '', year: 2024, type: 'agency' };
    expect(toPlainText('Fact. [cite](#cite:1)', [0], [t])).toBe('Fact. [1]\n\nReferences\n1. Record — nih.gov, 2024.');
  });

  it('leaves an answer without references unchanged', () => {
    expect(toPlainText('No sources here.', [], [])).toBe('No sources here.');
  });

  it('drops reference numbers that do not resolve, and a chip left with none', () => {
    expect(toPlainText('Fact. [cite](#cite:1,2)', [7, 0], [s]))
      .toBe('Fact. [2]\n\nReferences\n2. Daptomycin trial. — The New England journal of medicine, 2006. https://pubmed.ncbi.nlm.nih.gov/16914701/');
    expect(toPlainText('Fact. [cite](#cite:1) More.', [7], [s])).toBe('Fact. More.');
  });

  it('skips references that do not resolve to a source without renumbering the rest', () => {
    expect(toPlainText('Fact. [cite](#cite:2)', [7, 0], [s]))
      .toBe('Fact. [2]\n\nReferences\n2. Daptomycin trial. — The New England journal of medicine, 2006. https://pubmed.ncbi.nlm.nih.gov/16914701/');
  });
});
