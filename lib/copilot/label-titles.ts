import { DRUG_DB } from '@/data/drug-database';
import type { DrugLookup, LookupResult } from '@/lib/pharmacy-lookup';
import type { EnrichedSource } from './types';

const titleCase = (s: string): string =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

const brandFor = (generic: string): string => {
  const g = generic.toLowerCase();
  return DRUG_DB.find(d => d.genericName.toLowerCase() === g)?.brandName.trim() ?? '';
};

const pathOf = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
};

/**
 * A Drugs@FDA label link: a `/label/` folder or a file named `…lbl.pdf`. Approval letters (`…ltr.pdf`) and
 * reviews carry the same application number but are not the prescribing information.
 */
const isLabelPath = (path: string): boolean => /\/label\//i.test(path) || /lbl\.pdf$/i.test(path);

/**
 * Whether `url` is an FDA label link whose path carries the digits of an application number such as
 * "BLA103772" as a whole token, the way Drugs@FDA names label PDFs ("…/label/2025/103772s5412lbl.pdf").
 * The digits must not run on into other digits, so "103772" does not match "1037721". Fewer than five
 * digits never match.
 */
function hasApplicationNumber(url: string, applicationNumber: string | undefined): boolean {
  const digits = applicationNumber?.trim().replace(/^[a-z]+/i, '') ?? '';
  if (!/^\d{5,}$/.test(digits)) return false;
  const path = pathOf(url);
  return isLabelPath(path) && new RegExp(`(?:^|\\D)${digits}(?:\\D|$)`).test(path);
}

/** Whether `url` carries the label's SPL set id, as DailyMed links do (`setid=<uuid>`). */
function hasSetId(url: string, setId: string | undefined): boolean {
  const id = setId?.trim().toLowerCase() ?? '';
  return id !== '' && url.toLowerCase().includes(id);
}

/** Prefers the longest generic name so "ampicillin-sulbactam" beats "ampicillin". */
const longest = (names: string[]): string | null =>
  names.reduce<string | null>((best, g) => (best === null || g.length > best.length ? g : best), null);

/** The looked-up drug an FDA-label source is for: by its label's identifiers in the link, else by name. */
function drugFor(source: EnrichedSource, drugs: DrugLookup[]): string | null {
  const url = source.url ?? '';
  const byId = url
    ? drugs.find(d => hasApplicationNumber(url, d.application_number) || hasSetId(url, d.set_id))
    : undefined;
  if (byId && byId.generic_name.trim()) return byId.generic_name.trim();

  const haystack = `${source.title} ${url}`.toLowerCase();
  const generics = drugs.map(d => d.generic_name.trim()).filter(Boolean);
  return longest(generics.filter(g => haystack.includes(g.toLowerCase())));
}

/**
 * Replaces the title of each FDA-label source that is for a looked-up drug with a readable
 * "Brand (Generic) prescribing information" title. A label is matched by the application number or
 * set id of the drug's openFDA label in its link, or by the generic name in its title or link. Other
 * sources, and labels for no looked-up drug, are returned unchanged.
 */
export function titleFdaLabels(sources: EnrichedSource[], lookup: LookupResult | null): EnrichedSource[] {
  if (!lookup || lookup.drug_lookups.length === 0) return sources;

  return sources.map(source => {
    if (source.type !== 'fda-label') return source;
    const generic = drugFor(source, lookup.drug_lookups);
    if (generic === null) return source;

    const name = titleCase(generic);
    const brand = brandFor(generic);
    return { ...source, title: brand ? `${brand} (${name}) prescribing information` : `${name} prescribing information` };
  });
}
