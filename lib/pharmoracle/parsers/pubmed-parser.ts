import { XMLParser } from 'fast-xml-parser';
import type { EvidenceItem, StudyDesign } from '../types/evidence';

const PUB_TYPE_MAP: Array<[RegExp, StudyDesign]> = [
  [/meta-?analysis/i, 'meta_analysis'],
  [/practice guideline|guideline/i, 'guideline'],
  [/randomized controlled trial/i, 'RCT'],
  [/cohort/i, 'cohort'],
  [/case reports/i, 'case_report'],
  [/review/i, 'review'],
];

const classifyDesign = (pubTypes: string[]): StudyDesign => {
  for (const [re, design] of PUB_TYPE_MAP) {
    if (pubTypes.some(pt => re.test(pt))) return design;
  }
  return 'review';
};

const asArray = <T,>(v: T | T[] | undefined): T[] => {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
};

const flattenText = (node: unknown): string => {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  if (typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).map(flattenText).join(' ');
  }
  return String(node);
};

interface PubmedArticle {
  MedlineCitation?: {
    PMID?: { '#text'?: string } | string;
    Article?: {
      ArticleTitle?: unknown;
      Journal?: { Title?: string; JournalIssue?: { PubDate?: { Year?: string } } };
      Abstract?: { AbstractText?: unknown };
      PublicationTypeList?: {
        PublicationType?: Array<{ '#text'?: string } | string> | { '#text'?: string } | string;
      };
    };
  };
}

const pmidOf = (a: PubmedArticle): string => {
  const p = a.MedlineCitation?.PMID;
  if (typeof p === 'string') return p;
  return p?.['#text'] ?? '';
};

const pubTypesOf = (a: PubmedArticle): string[] => {
  const list = a.MedlineCitation?.Article?.PublicationTypeList?.PublicationType;
  return asArray(list).map(pt => (typeof pt === 'string' ? pt : pt['#text'] ?? ''));
};

export const parsePubmedAbstracts = (xml: string): EvidenceItem[] => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);
  const articles = asArray(doc?.PubmedArticleSet?.PubmedArticle) as PubmedArticle[];

  return articles.map(a => {
    const pmid = pmidOf(a);
    const article = a.MedlineCitation?.Article;
    const title = flattenText(article?.ArticleTitle).trim();
    const journal = article?.Journal?.Title ?? '';
    const yearStr = article?.Journal?.JournalIssue?.PubDate?.Year ?? '';
    const abstract = flattenText(article?.Abstract?.AbstractText).trim();
    const design = classifyDesign(pubTypesOf(a));

    return {
      pmid,
      title,
      journal,
      year: Number.parseInt(yearStr, 10) || 0,
      study_design: design,
      relevance_score: 0,
      key_finding: abstract.slice(0, 240),
      pubmed_url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  });
};
