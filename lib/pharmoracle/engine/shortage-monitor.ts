import type { ShortageStatus } from '../types/clinical';

const BASE = 'https://api.fda.gov/drug/shortages.json';

interface ShortageRecord {
  generic_name?: string;
  status?: string;
  reason?: string;
  update_date?: string;
}
interface ShortageResponse { results?: ShortageRecord[] }

const normalizeStatus = (raw?: string): ShortageStatus['status'] => {
  if (!raw) return 'Not Found';
  const s = raw.toLowerCase();
  if (s.includes('currently')) return 'Currently in Shortage';
  if (s.includes('resolved')) return 'Resolved Shortage';
  if (s.includes('discontinued')) return 'Discontinued';
  return 'Not Found';
};

export const checkShortage = async (genericName: string): Promise<ShortageStatus> => {
  const key = process.env.OPENFDA_API_KEY;
  const url = `${BASE}?search=generic_name:"${encodeURIComponent(genericName)}"&limit=1${key ? `&api_key=${key}` : ''}`;

  try {
    const resp = (await fetch(url).then(r => r.json())) as ShortageResponse;
    const top = resp.results?.[0];
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
