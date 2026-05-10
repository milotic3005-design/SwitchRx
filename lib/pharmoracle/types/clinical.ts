import type { QueryDomain } from './query';
import type { EvidenceItem, LabelSection } from './evidence';

export type DataSource =
  | 'pubmed'
  | 'dailymed'
  | 'openfda_label'
  | 'openfda_shortage'
  | 'rxnorm'
  | 'clinical_trials'
  | 'knowledge_base'
  | 'pubchem';

export type SafetyLevel = 'critical' | 'warning' | 'info';

export type SafetyCategory =
  | 'vesicant'
  | 'high_alert'
  | 'usp797'
  | 'interaction'
  | 'shortage'
  | 'monitoring'
  | 'hazardous_drug'
  | 'recall';

export interface SafetyFlag {
  level: SafetyLevel;
  message: string;
  category: SafetyCategory;
}

export interface ShortageStatus {
  status:
    | 'Currently in Shortage'
    | 'Resolved Shortage'
    | 'Discontinued'
    | 'Not Found';
  generic_name: string;
  reason?: string;
  update_date?: string;
  source: 'openFDA';
  verification_url: 'https://www.ashp.org/drug-shortages';
}

export interface PharmOracleAnswer {
  query_domain: QueryDomain;
  data_sources_used: DataSource[];
  summary: string;
  clinical_content: string;
  safety_flags: SafetyFlag[];
  evidence: EvidenceItem[];
  fda_label_sections: LabelSection[];
  shortage_status?: ShortageStatus;
  bottom_line: string;
  disclaimer: string;
}

export const STANDARD_DISCLAIMER =
  '⚠️ PharmOracle provides clinical reference information for licensed healthcare professionals. ' +
  'This does not replace institutional protocols, primary literature review, or independent clinical judgment. ' +
  "Always verify against current guidelines, your institution's formulary policies, and patient-specific factors.";
