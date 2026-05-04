// openFDA drug-shortage check. Free, no auth required, CORS-friendly.
// Adapted from PharmOracle's server-side version to run client-side.

import type { ShortageStatus } from './types';

const BASE = 'https://api.fda.gov/drug/shortages.json';

interface ShortageRecord {
  generic_name?: string;
  status?: string;
  reason?: string;
  update_date?: string;
}

interface ShortageResponse {
  results?: ShortageRecord[];
  error?: { message?: string };
}

const normalizeStatus = (raw?: string): ShortageStatus['status'] => {
  if (!raw) return 'Not Found';
  const s = raw.toLowerCase();
  if (s.includes('currently')) return 'Currently in Shortage';
  if (s.includes('resolved')) return 'Resolved Shortage';
  if (s.includes('discontinued')) return 'Discontinued';
  return 'Not Found';
};

export const checkShortage = async (
  genericName: string
): Promise<ShortageStatus> => {
  const escaped = genericName.toLowerCase().replace(/"/g, '');
  const url = `${BASE}?search=generic_name:"${escaped}"&limit=1`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      // 404 from openFDA = no shortage record found
      return {
        status: 'Not Found',
        generic_name: genericName,
        source: 'openFDA',
        verification_url: 'https://www.ashp.org/drug-shortages',
      };
    }
    const data = (await resp.json()) as ShortageResponse;
    const top = data.results?.[0];
    return {
      status: normalizeStatus(top?.status),
      generic_name: top?.generic_name ?? genericName,
      reason: top?.reason,
      update_date: top?.update_date,
      source: 'openFDA',
      verification_url: 'https://www.ashp.org/drug-shortages',
    };
  } catch {
    return {
      status: 'Not Found',
      generic_name: genericName,
      source: 'openFDA',
      verification_url: 'https://www.ashp.org/drug-shortages',
    };
  }
};
