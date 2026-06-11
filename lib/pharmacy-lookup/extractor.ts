// Drug-name + domain extractor. Uses Claude with a structured-output JSON
// schema so the response is guaranteed-shape JSON. This is the cheap first
// step in the lookup pipeline; the expensive consult-brief generation runs
// in parallel against the main scenario string while this extracts the
// bookkeeping facts the lookup APIs need.

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '../claude';
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

// JSON Schema for Claude structured outputs (output_config.format). Note: the
// API requires additionalProperties:false on every object.
const SCHEMA = {
  type: 'object',
  properties: {
    drug_names: {
      type: 'array',
      items: { type: 'string' },
      description: 'Generic drug names, lowercase',
    },
    query_domain: { type: 'string' },
    urgency: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['drug_names', 'query_domain', 'urgency', 'notes'],
  additionalProperties: false,
} as const;

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
  const ai = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  // Classifier is a fast, deterministic extraction — omit thinking for speed and
  // constrain the output to the JSON schema so parsing is guaranteed-shape.
  const response = await ai.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: scenario }],
  });

  const text =
    response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text || '{}';
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
