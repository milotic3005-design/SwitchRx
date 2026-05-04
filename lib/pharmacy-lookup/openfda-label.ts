// openFDA drug label lookup. The /drug/label.json endpoint returns the
// structured FDA prescribing-information sections (dosage, interactions,
// warnings, storage, etc.) as JSON keyed by section name — much easier to
// consume than the DailyMed SPL XML and CORS-friendly for browser fetches.
// We prefer the IV/INTRAVENOUS route filter; fall back to any-route match.

import type { LabelField, LabelSection } from './types';

const BASE = 'https://api.fda.gov/drug/label.json';

const SECTIONS: { field: LabelField; label: string }[] = [
  { field: 'boxed_warning',                label: 'Boxed Warning' },
  { field: 'contraindications',            label: 'Contraindications' },
  { field: 'dosage_and_administration',    label: 'Dosage & Administration' },
  { field: 'warnings_and_cautions',        label: 'Warnings & Cautions' },
  { field: 'warnings',                     label: 'Warnings' },
  { field: 'drug_interactions',            label: 'Drug Interactions' },
  { field: 'storage_and_handling',         label: 'Storage & Handling' },
  { field: 'how_supplied',                 label: 'How Supplied' },
  { field: 'use_in_specific_populations',  label: 'Use in Specific Populations' },
];

interface OpenFdaLabelResult {
  openfda?: {
    generic_name?: string[];
    brand_name?: string[];
    manufacturer_name?: string[];
    rxcui?: string[];
    route?: string[];
  };
  [k: string]: any;
}

interface OpenFdaResponse {
  results?: OpenFdaLabelResult[];
  error?: { message?: string };
}

const truncate = (s: string, max = 800): string => {
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, '') + '…';
};

const fetchJson = async (url: string): Promise<OpenFdaResponse | null> => {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return (await resp.json()) as OpenFdaResponse;
  } catch {
    return null;
  }
};

export const fetchFdaLabel = async (
  genericName: string
): Promise<{
  sections: LabelSection[];
  manufacturer?: string;
  rxcui?: string;
  not_found: boolean;
}> => {
  const escaped = genericName.toLowerCase().replace(/"/g, '');
  // Prefer IV-routed labels (relevant for infusion copilot)
  const ivQuery = `openfda.generic_name:"${escaped}"+AND+openfda.route:"INTRAVENOUS"`;
  const fallbackQuery = `openfda.generic_name:"${escaped}"`;

  let data = await fetchJson(`${BASE}?search=${encodeURIComponent(ivQuery)}&limit=1`);
  if (!data?.results?.length) {
    data = await fetchJson(`${BASE}?search=${encodeURIComponent(fallbackQuery)}&limit=1`);
  }

  const top = data?.results?.[0];
  if (!top) {
    return { sections: [], not_found: true };
  }

  const sections: LabelSection[] = [];
  for (const { field, label } of SECTIONS) {
    const raw = top[field];
    if (Array.isArray(raw) && raw.length) {
      const content = raw.join('\n\n').trim();
      if (content) {
        sections.push({
          drug: genericName,
          field,
          label,
          content: truncate(content, 1200),
          source: 'openFDA',
          manufacturer: top.openfda?.manufacturer_name?.[0],
          rxcui: top.openfda?.rxcui?.[0],
        });
      }
    }
  }

  return {
    sections,
    manufacturer: top.openfda?.manufacturer_name?.[0],
    rxcui: top.openfda?.rxcui?.[0],
    not_found: false,
  };
};
