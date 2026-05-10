import { describe, it } from 'node:test';
import assert from 'node:assert';
import { shortDomain, inferPublisherFromTitle, displayDomain } from './domain-utils';

describe('domain-utils', () => {
  describe('shortDomain', () => {
    it('removes www. from a valid URL', () => {
      assert.strictEqual(shortDomain('https://www.google.com/search?q=test'), 'google.com');
      assert.strictEqual(shortDomain('http://www.fda.gov'), 'fda.gov');
    });

    it('returns hostname for a URL without www', () => {
      assert.strictEqual(shortDomain('https://dailymed.nlm.nih.gov/dailymed/'), 'dailymed.nlm.nih.gov');
      assert.strictEqual(shortDomain('http://example.org'), 'example.org');
    });

    it('returns original string if URL parsing fails', () => {
      assert.strictEqual(shortDomain('not-a-valid-url'), 'not-a-valid-url');
    });
  });

  describe('inferPublisherFromTitle', () => {
    it('infers DailyMed', () => {
      assert.strictEqual(inferPublisherFromTitle('DailyMed - AMIODARONE HYDROCHLORIDE tablet'), 'dailymed.nlm.nih.gov');
    });

    it('infers PubMed', () => {
      assert.strictEqual(inferPublisherFromTitle('Apixaban in Patients - PubMed'), 'pubmed.ncbi.nlm.nih.gov');
    });

    it('infers PMC / NCBI', () => {
      assert.strictEqual(inferPublisherFromTitle('Effect of Amiodarone - PMC - NCBI'), 'ncbi.nlm.nih.gov/pmc');
    });

    it('infers FDA', () => {
      assert.strictEqual(inferPublisherFromTitle('accessdata.fda.gov info'), 'fda.gov');
      assert.strictEqual(inferPublisherFromTitle('fda.gov document'), 'fda.gov');
    });

    it('infers NEJM', () => {
      assert.strictEqual(inferPublisherFromTitle('NEJM Article'), 'nejm.org');
      assert.strictEqual(inferPublisherFromTitle('New England Journal of Medicine study'), 'nejm.org');
    });

    it('infers JAMA', () => {
      assert.strictEqual(inferPublisherFromTitle('JAMA Network Open'), 'jamanetwork.com');
    });

    it('infers Lancet', () => {
      assert.strictEqual(inferPublisherFromTitle('The Lancet Oncology'), 'thelancet.com');
    });

    it('infers IDSA', () => {
      assert.strictEqual(inferPublisherFromTitle('IDSA Guidelines'), 'idsociety.org');
      assert.strictEqual(inferPublisherFromTitle('IDSociety recommendations'), 'idsociety.org');
    });

    it('infers ASHP', () => {
      assert.strictEqual(inferPublisherFromTitle('ASHP Drug Shortages'), 'ashp.org');
    });

    it('infers NCCN', () => {
      assert.strictEqual(inferPublisherFromTitle('NCCN Guidelines'), 'nccn.org');
    });

    it('infers UpToDate', () => {
      assert.strictEqual(inferPublisherFromTitle('Amiodarone - UpToDate'), 'uptodate.com');
    });

    it('infers Lexicomp', () => {
      assert.strictEqual(inferPublisherFromTitle('Apixaban - Lexicomp'), 'wolterskluwer.com');
    });

    it('returns null for unknown publishers', () => {
      assert.strictEqual(inferPublisherFromTitle('Random Blog Post'), null);
      assert.strictEqual(inferPublisherFromTitle('Wikipedia Article'), null);
    });
  });

  describe('displayDomain', () => {
    it('prefers inferred publisher from title over domain', () => {
      const src = { uri: 'https://www.google.com', title: 'DailyMed - AMIODARONE' };
      assert.strictEqual(displayDomain(src), 'dailymed.nlm.nih.gov');
    });

    it('falls back to short domain if publisher cannot be inferred', () => {
      const src = { uri: 'https://www.example.org/page', title: 'Random Page' };
      assert.strictEqual(displayDomain(src), 'example.org');
    });

    it('hides vertexaisearch redirect domains and shows "via Google Search"', () => {
      const src = { uri: 'https://vertexaisearch.cloud.google.com/redirect', title: 'Unknown Title' };
      assert.strictEqual(displayDomain(src), 'via Google Search');
    });

    it('hides grounding-api-redirect domains and shows "via Google Search"', () => {
      const src = { uri: 'https://grounding-api-redirect.googleapis.com', title: 'Unknown Title' };
      assert.strictEqual(displayDomain(src), 'via Google Search');
    });

    it('returns inferred publisher from title even if URL is vertexaisearch', () => {
      const src = { uri: 'https://vertexaisearch.cloud.google.com/redirect', title: 'DailyMed - AMIODARONE' };
      assert.strictEqual(displayDomain(src), 'dailymed.nlm.nih.gov');
    });
  });
});
