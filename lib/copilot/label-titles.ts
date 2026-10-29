import { DRUG_DB } from '@/data/drug-database';
import type { LookupResult } from '@/lib/pharmacy-lookup';
import type { EnrichedSource } from './types';

const titleCase = (s: string): string =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

const brandFor = (generic: string): string => {
  const g = generic.toLowerCase();
  return DRUG_DB.find(d => d.genericName.toLowerCase() === g)?.brandName.trim() ?? '';
};

/**
 * Replaces the title of each FDA-label source that names a looked-up drug with a
 * readable "Brand (Generic) prescribing information" title. Other sources, and
 * labels that name no looked-up drug, are returned unchanged.
 */
export function titleFdaLabels(sources: EnrichedSource[], lookup: LookupResult | null): EnrichedSource[] {
  if (!lookup) return sources;
  const generics = lookup.drug_lookups.map(d => d.generic_name.trim()).filter(Boolean);
  if (generics.length === 0) return sources;

  return sources.map(source => {
    if (source.type !== 'fda-label') return source;
    const haystack = `${source.title} ${source.url ?? ''}`.toLowerCase();
    // Prefer the longest generic name so "ampicillin-sulbactam" beats "ampicillin".
    const generic = generics
      .filter(g => haystack.includes(g.toLowerCase()))
      .reduce<string | null>((best, g) => (best === null || g.length > best.length ? g : best), null);
    if (generic === null) return source;

    const name = titleCase(generic);
    const brand = brandFor(generic);
    return { ...source, title: brand ? `${brand} (${name}) prescribing information` : `${name} prescribing information` };
  });
}
