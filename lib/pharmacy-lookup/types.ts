// Pharmacy Lookup pipeline types — adapted from PharmOracle for SwitchRx.
// Surfaces structured authoritative data (FDA labels, shortages, safety flags)
// alongside the AI-generated infusion consult brief.

export type QueryDomain =
  | 'iv_drug_info'
  | 'drug_interaction'
  | 'usp797_compounding'
  | 'oncology_support'
  | 'iv_iron'
  | 'renal_hepatic_dosing'
  | 'tdm_monitoring'
  | 'shortage_management'
  | 'lab_monitoring'
  | 'general_clinical';

export type Urgency = 'routine' | 'urgent' | 'critical';

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
  category: SafetyCategory;
  message: string;
  drug?: string;
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
  verification_url: string;
}

export type LabelField =
  | 'boxed_warning'
  | 'dosage_and_administration'
  | 'drug_interactions'
  | 'warnings_and_cautions'
  | 'warnings'
  | 'storage_and_handling'
  | 'how_supplied'
  | 'contraindications'
  | 'use_in_specific_populations';

export interface LabelSection {
  drug: string;
  field: LabelField;
  label: string; // human-readable
  content: string; // truncated excerpt
  source: 'openFDA';
  manufacturer?: string;
  rxcui?: string;
}

export interface DrugLookup {
  generic_name: string;
  rxcui?: string;
  manufacturer?: string;
  shortage?: ShortageStatus;
  label_sections: LabelSection[];
  not_found?: boolean;
}

export interface QueryClassification {
  drug_names: string[];
  query_domain: QueryDomain;
  urgency: Urgency;
  notes?: string;
}

export interface LookupResult {
  classification: QueryClassification;
  drug_lookups: DrugLookup[];
  safety_flags: SafetyFlag[];
  data_sources_used: string[];
}
