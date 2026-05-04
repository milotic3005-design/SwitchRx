// Drug-name + domain extractor. Uses Gemini Flash with a structured-output
// schema so the response is guaranteed-shape JSON. This is the cheap first
// step in the lookup pipeline; the expensive consult-brief generation runs
// in parallel against the main scenario string while this extracts the
// bookkeeping facts the lookup APIs need.

import { GoogleGenAI, Type } from '@google/genai';
import type { QueryClassification, QueryDomain, Urgency } from './types';

const SYSTEM = `You are an infusion-pharmacy query classifier.

Given a clinical scenario, extract:
- drug_names: every drug mentioned by generic OR brand name. Always return the GENERIC name in lower case (e.g. "rituximab" not "Rituxan", "piperacillin-tazobactam" not "Zosyn"). Include all drugs that the patient is on or being considered.
- query_domain: pick the BEST single domain code from the allowed list.
- urgency: routine | urgent | critical. Critical only if patient is actively receiving the drug or an error is described.
- notes: short free-text (<200 chars) capturing anything safety-relevant the safety checker should know (e.g. "intrathecal route", "compounding question", "renal impairment").

Allowed query_domain values:
iv_drug_info | drug_interaction | usp797_compounding | oncology_support | iv_iron | renal_hepatic_dosing | tdm_monitoring | shortage_management | lab_monitoring | general_clinical

Return JSON only — no prose.`;

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    drug_names: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Generic drug names, lowercase',
    },
    query_domain: { type: Type.STRING },
    urgency: { type: Type.STRING },
    notes: { type: Type.STRING },
  },
  required: ['drug_names', 'query_domain', 'urgency'],
};

const VALID_DOMAINS: QueryDomain[] = [
  'iv_drug_info', 'drug_interaction', 'usp797_compounding', 'oncology_support',
  'iv_iron', 'renal_hepatic_dosing', 'tdm_monitoring', 'shortage_management',
  'lab_monitoring', 'general_clinical',
];
const VALID_URGENCY: Urgency[] = ['routine', 'urgent', 'critical'];

export const classifyAndExtract = async (
  scenario: string,
  apiKey: string
): Promise<QueryClassification> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: scenario,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      temperature: 0,
    },
  });

  const text = response.text || '{}';
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  const drug_names: string[] = Array.isArray(parsed.drug_names)
    ? parsed.drug_names
        .filter((d: any) => typeof d === 'string' && d.trim())
        .map((d: string) => d.trim().toLowerCase())
    : [];

  const dedupedDrugs = Array.from(new Set(drug_names));

  const query_domain: QueryDomain = VALID_DOMAINS.includes(parsed.query_domain)
    ? parsed.query_domain
    : 'iv_drug_info';

  const urgency: Urgency = VALID_URGENCY.includes(parsed.urgency)
    ? parsed.urgency
    : 'routine';

  return {
    drug_names: dedupedDrugs,
    query_domain,
    urgency,
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
  };
};
