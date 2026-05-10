export type StudyDesign =
  | 'meta_analysis'
  | 'RCT'
  | 'cohort'
  | 'case_series'
  | 'case_report'
  | 'guideline'
  | 'review';

export interface EvidenceItem {
  pmid: string;
  title: string;
  journal: string;
  year: number;
  study_design: StudyDesign;
  relevance_score: number;
  key_finding: string;
  pubmed_url: string;
}

export interface LabelSection {
  loinc_code: string;
  section_name: string;
  content_summary: string;
  setid: string;
  source: 'dailymed';
}
