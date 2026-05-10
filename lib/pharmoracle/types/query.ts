/**
 * PharmOracle query classification types — ported from
 * /Users/emismean/Claude/pharmoracle/src/types/query.ts
 *
 * The classifier returns this shape so the router can fan out to the
 * right APIs in parallel.
 */

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

export interface QueryClassification {
  query_domain: QueryDomain;
  sub_domains: QueryDomain[];
  drug_names: string[];
  rxcui_lookup_needed: boolean;
  urgency: Urgency;
  requires_pubmed: boolean;
  requires_dailymed: boolean;
  requires_shortage_check: boolean;
  requires_clinical_trials: boolean;
  safety_review_required: boolean;
  notes: string;
}
