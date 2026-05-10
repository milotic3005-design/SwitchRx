import { parsePubmedAbstracts } from '../parsers/pubmed-parser';
import type { EvidenceItem, StudyDesign } from '../types/evidence';

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const FILTER =
  'AND (meta-analysis[pt] OR systematic review[pt] OR randomized controlled trial[pt] OR practice guideline[pt]) ' +
  'AND ("2015/01/01"[PDAT] : "3000/12/31"[PDAT])';

const DESIGN_SCORE: Record<StudyDesign, number> = {
  meta_analysis: 10,
  guideline: 9,
  RCT: 8,
  cohort: 5,
  review: 4,
  case_series: 3,
  case_report: 1,
};

const auth = (): string => {
  const key = process.env.NCBI_API_KEY;
  const email = process.env.PUBCHEM_TOOL_EMAIL ?? '';
  const tool = process.env.PUBCHEM_TOOL_NAME ?? 'pharmoracle-switchrx';
  return `&tool=${tool}&email=${encodeURIComponent(email)}${key ? `&api_key=${key}` : ''}`;
};

interface ESearchResponse { esearchresult?: { idlist?: string[] } }

export const searchPubmed = async (
  query: string,
  maxResults = 10
): Promise<EvidenceItem[]> => {
  try {
    const term = encodeURIComponent(`${query} ${FILTER}`);
    const search = (await fetch(
      `${EUTILS}/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retmax=${maxResults}${auth()}`
    ).then(r => r.json())) as ESearchResponse;

    const ids = search.esearchresult?.idlist ?? [];
    if (ids.length === 0) return [];

    const xml = await fetch(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=xml${auth()}`
    ).then(r => r.text());

    const items = parsePubmedAbstracts(xml);

    return items
      .map(it => ({ ...it, relevance_score: DESIGN_SCORE[it.study_design] ?? 2 }))
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 5);
  } catch {
    return [];
  }
};
