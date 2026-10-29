import type { GroundingSource } from '@/lib/ai';
import type { EnrichedSource, SourceType } from './types';

const VERTEX_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';

const FDA_HOSTS = ['dailymed.nlm.nih.gov', 'fda.gov'];
const SOCIETY_HOSTS = [
  'idsociety.org',
  'ashp.org',
  'nccn.org',
  'ins1.org',
  'ons.org',
  'asco.org',
  'hematology.org',
  'rheumatology.org',
];
const JOURNAL_HOSTS = [
  'ncbi.nlm.nih.gov',
  'nejm.org',
  'jamanetwork.com',
  'thelancet.com',
  'academic.oup.com',
  'bmj.com',
  'nature.com',
  'sciencedirect.com',
  'springer.com',
  'wiley.com',
  'ahajournals.org',
  'ashpublications.org',
  'ascopubs.org',
  'asm.org',
];
const AGENCY_HOSTS = ['cdc.gov', 'nih.gov', 'who.int', 'cms.gov'];

export const TYPE_LABEL: Record<SourceType, string> = {
  'fda-label': 'FDA label',
  guideline: 'Guideline',
  'systematic-review': 'Systematic review',
  trial: 'Trial',
  journal: 'Journal',
  agency: 'Agency',
  web: 'Web',
};

/** Source types in the order they are listed in the source-mix badge. */
const TIER_ORDER: SourceType[] = [
  'fda-label',
  'guideline',
  'systematic-review',
  'trial',
  'journal',
  'agency',
  'web',
];

const MIX_NOUN: Record<SourceType, [singular: string, plural: string]> = {
  'fda-label': ['FDA label', 'FDA labels'],
  guideline: ['guideline', 'guidelines'],
  'systematic-review': ['systematic review', 'systematic reviews'],
  trial: ['trial', 'trials'],
  journal: ['article', 'articles'],
  agency: ['agency source', 'agency sources'],
  web: ['web source', 'web sources'],
};

const hostMatches = (host: string, domains: string[]): boolean =>
  domains.some(d => host === d || host.endsWith('.' + d));

const hasPubtype = (pubtypes: string[], wanted: string[]): boolean =>
  pubtypes.some(p => wanted.includes(p.trim().toLowerCase()));

/** Classifies a source by its host and, for PubMed records, its publication types. */
export function classifySource(input: { host: string; pubtypes?: string[] }): SourceType {
  const host = input.host.trim().toLowerCase();
  const pubtypes = input.pubtypes ?? [];

  if (hostMatches(host, FDA_HOSTS)) return 'fda-label';
  if (hasPubtype(pubtypes, ['practice guideline', 'guideline']) || hostMatches(host, SOCIETY_HOSTS)) {
    return 'guideline';
  }
  if (hasPubtype(pubtypes, ['systematic review', 'meta-analysis']) || hostMatches(host, ['cochranelibrary.com'])) {
    return 'systematic-review';
  }
  if (
    hasPubtype(pubtypes, ['randomized controlled trial']) ||
    pubtypes.some(p => p.trim().toLowerCase().startsWith('clinical trial'))
  ) {
    return 'trial';
  }
  if (hostMatches(host, JOURNAL_HOSTS) || pubtypes.length > 0) return 'journal';
  if (hostMatches(host, AGENCY_HOSTS)) return 'agency';
  return 'web';
}

const SHORT_NAMES: [domains: string[], name: string][] = [
  [FDA_HOSTS, 'FDA label'],
  [['idsociety.org'], 'IDSA'],
  [['ashp.org'], 'ASHP'],
  [['nccn.org'], 'NCCN'],
  [['ins1.org'], 'INS'],
  [['ons.org'], 'ONS'],
  [['asco.org'], 'ASCO'],
  [['hematology.org'], 'ASH'],
  [['rheumatology.org'], 'ACR'],
  [['cochranelibrary.com'], 'Cochrane'],
  [['ncbi.nlm.nih.gov'], 'PubMed'],
  [['cdc.gov'], 'CDC'],
  [['nih.gov'], 'NIH'],
  [['who.int'], 'WHO'],
  [['cms.gov'], 'CMS'],
];

/** A compact display name for a host, e.g. "IDSA" for idsociety.org. */
export function siteShortName(host: string): string {
  const h = host.trim().toLowerCase();
  if (!h) return 'Web';
  for (const [domains, name] of SHORT_NAMES) {
    if (hostMatches(h, domains)) return name;
  }
  return h.replace(/^www\./, '');
}

const DOMAIN_TITLE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

const stripWww = (host: string): string => host.replace(/^www\./, '');

const uriHost = (uri: string): string => {
  try {
    const host = new URL(uri).hostname.toLowerCase();
    return host === VERTEX_REDIRECT_HOST ? '' : host;
  } catch {
    return '';
  }
};

/**
 * Builds a source from a bare grounding source when no enrichment is available.
 * Grounding titles are often just the site's domain, so that is used for typing;
 * `url` stays null because the destination has not been resolved.
 */
export function fallbackSource(src: GroundingSource): EnrichedSource {
  const title = src.title.trim();
  const host = stripWww(DOMAIN_TITLE.test(title) ? title.toLowerCase() : uriHost(src.uri));
  return {
    uri: src.uri,
    url: null,
    site: host || 'web',
    title: src.title,
    shortName: siteShortName(host),
    type: classifySource({ host }),
  };
}

/** Summarizes the types of the cited sources, e.g. "1 FDA label · 2 guidelines · 1 trial". */
export function sourceMix(sources: EnrichedSource[]): {
  groups: { type: SourceType; count: number; label: string; sourceIndices: number[] }[];
  text: string;
} {
  const groups = TIER_ORDER.flatMap(type => {
    const sourceIndices = sources.flatMap((s, i) => (s.type === type ? [i] : []));
    if (sourceIndices.length === 0) return [];
    const count = sourceIndices.length;
    const [singular, plural] = MIX_NOUN[type];
    return [{ type, count, label: `${count} ${count === 1 ? singular : plural}`, sourceIndices }];
  });
  return { groups, text: groups.slice(0, 3).map(g => g.label).join(' · ') };
}

/** True for sources published within the last two calendar years (inclusive). */
export function isRecent(year: number | undefined, now: Date): boolean {
  return year !== undefined && year >= now.getFullYear() - 2;
}
