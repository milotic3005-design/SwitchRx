export function shortDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return uri;
  }
}

export function inferPublisherFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes('dailymed')) return 'dailymed.nlm.nih.gov';
  if (t.includes('pubmed')) return 'pubmed.ncbi.nlm.nih.gov';
  if (t.includes('pmc') && t.includes('ncbi')) return 'ncbi.nlm.nih.gov/pmc';
  if (t.includes('accessdata.fda.gov') || t.includes('fda.gov')) return 'fda.gov';
  if (t.includes('nejm') || t.includes('new england journal')) return 'nejm.org';
  if (t.includes('jama')) return 'jamanetwork.com';
  if (t.includes('lancet')) return 'thelancet.com';
  if (t.includes('idsociety') || t.includes('idsa')) return 'idsociety.org';
  if (t.includes('ashp')) return 'ashp.org';
  if (t.includes('nccn')) return 'nccn.org';
  if (t.includes('uptodate')) return 'uptodate.com';
  if (t.includes('lexicomp')) return 'wolterskluwer.com';
  return null;
}

export function displayDomain(src: { uri: string; title: string }): string {
  const fromTitle = inferPublisherFromTitle(src.title);
  if (fromTitle) return fromTitle;
  const host = shortDomain(src.uri);
  // Hide the noisy vertex AI redirect host — the title still carries the source
  if (host.includes('vertexaisearch') || host.includes('grounding-api-redirect')) {
    return 'via Google Search';
  }
  return host;
}
