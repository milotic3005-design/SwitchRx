import { GoogleGenAI } from '@google/genai';
import type { QueryClassification } from '../types/query';

/**
 * Adapted from PharmOracle (originally Anthropic Claude). Uses Gemini Flash
 * with JSON-mode response constraint so SwitchRx keeps a single LLM provider.
 */

const SYSTEM = `You are a pharmacy query classifier.
Return ONLY valid JSON matching the QueryClassification interface — no prose, no markdown fences.

Domain codes: iv_drug_info | drug_interaction | usp797_compounding | oncology_support |
iv_iron | renal_hepatic_dosing | tdm_monitoring | shortage_management | lab_monitoring | general_clinical

Rules:
- requires_pubmed = true ONLY for comparative effectiveness or evidence-strength questions
- requires_dailymed = true whenever iv_drug_info, usp797_compounding, or renal_hepatic_dosing
- requires_shortage_check = true whenever any specific drug name is detected
- safety_review_required = true if ANY: vesicant drug, chemotherapy, ISMP high-alert, compounding
- urgency = critical ONLY if patient is actively receiving the drug or an error occurred
- Always extract all drug names mentioned (lowercase generic names)
- rxcui_lookup_needed = true if drug name is misspelled, abbreviated, or brand-name only`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    query_domain: { type: 'string' },
    sub_domains: { type: 'array', items: { type: 'string' } },
    drug_names: { type: 'array', items: { type: 'string' } },
    rxcui_lookup_needed: { type: 'boolean' },
    urgency: { type: 'string' },
    requires_pubmed: { type: 'boolean' },
    requires_dailymed: { type: 'boolean' },
    requires_shortage_check: { type: 'boolean' },
    requires_clinical_trials: { type: 'boolean' },
    safety_review_required: { type: 'boolean' },
    notes: { type: 'string' },
  },
  required: [
    'query_domain', 'sub_domains', 'drug_names', 'rxcui_lookup_needed',
    'urgency', 'requires_pubmed', 'requires_dailymed', 'requires_shortage_check',
    'requires_clinical_trials', 'safety_review_required', 'notes',
  ],
} as const;

export const classifyQuery = async (
  query: string,
  apiKey: string
): Promise<QueryClassification> => {
  if (!apiKey) throw new Error('Gemini API key missing for classifier');

  const ai = new GoogleGenAI({ apiKey });
  const resp = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: query,
    config: {
      systemInstruction: SYSTEM,
      temperature: 0.0,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA as any,
    },
  });

  const text = resp.text ?? '';
  return JSON.parse(text) as QueryClassification;
};
