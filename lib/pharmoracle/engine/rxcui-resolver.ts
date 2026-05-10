const BASE = 'https://rxnav.nlm.nih.gov/REST';

const cache = new Map<string, { rxcui: string | null; expires: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;

interface RxNormExactResp { idGroup?: { rxnormId?: string[] } }
interface RxNormApproxResp { approximateGroup?: { candidate?: Array<{ rxcui?: string }> } }

export const resolveRxcui = async (name: string): Promise<string | null> => {
  const key = name.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.rxcui;

  try {
    const exact = (await fetch(
      `${BASE}/rxcui.json?name=${encodeURIComponent(name)}`
    ).then(r => r.json())) as RxNormExactResp;
    const exactId = exact.idGroup?.rxnormId?.[0] ?? null;
    if (exactId) {
      cache.set(key, { rxcui: exactId, expires: Date.now() + TTL_MS });
      return exactId;
    }

    const approx = (await fetch(
      `${BASE}/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`
    ).then(r => r.json())) as RxNormApproxResp;
    const approxId = approx.approximateGroup?.candidate?.[0]?.rxcui ?? null;
    cache.set(key, { rxcui: approxId, expires: Date.now() + TTL_MS });
    return approxId;
  } catch {
    return null;
  }
};
