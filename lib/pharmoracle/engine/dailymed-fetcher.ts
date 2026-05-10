import { parseSplSections } from '../parsers/spl-parser';
import type { LabelSection } from '../types/evidence';
import type { QueryDomain } from '../types/query';

const BASE = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';

const SECTION_MAP: Record<QueryDomain, string[]> = {
  iv_drug_info:        ['34068-7', '50742-1', '43678-2'],
  usp797_compounding:  ['50742-1', '34068-7', '43678-2'],
  renal_hepatic_dosing:['34068-7', '42229-5'],
  drug_interaction:    ['34073-7', '34066-1'],
  oncology_support:    ['34066-1', '34068-7', '34070-3'],
  iv_iron:             ['34068-7', '34070-3'],
  tdm_monitoring:      ['34068-7'],
  shortage_management: ['34068-7'],
  lab_monitoring:      ['34068-7', '34070-3'],
  general_clinical:    ['34066-1', '34068-7', '34070-3'],
};

interface SplSearchHit { setid?: string }
interface SplSearchResponse { data?: SplSearchHit[] }

export const fetchDailyMedSections = async (
  drugName: string,
  domain: QueryDomain
): Promise<LabelSection[]> => {
  try {
    const search = (await fetch(
      `${BASE}/spls.json?drug_name=${encodeURIComponent(drugName)}&pagesize=1`
    ).then(r => r.json())) as SplSearchResponse;

    const setid = search.data?.[0]?.setid;
    if (!setid) return [];

    const xml = await fetch(`${BASE}/spls/${setid}.xml`).then(r => r.text());
    const wanted = SECTION_MAP[domain] ?? SECTION_MAP.general_clinical;
    return parseSplSections(xml, setid, wanted);
  } catch {
    return [];
  }
};
