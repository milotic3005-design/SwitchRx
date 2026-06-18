import { makeGeminiClient } from '@/lib/ai-server';
import { Type } from '@google/genai';
import type { QueryClassification, QueryDomain, Urgency } from '@/lib/pharmacy-lookup/types';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

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

export async function POST(req: Request) {
  let scenario = '';
  try {
    ({ scenario } = await req.json());
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof scenario !== 'string' || !scenario.trim()) {
    return Response.json({ error: 'Expected { scenario: string }' }, { status: 400 });
  }

  try {
    const ai = makeGeminiClient();
    // Fast, deterministic extraction — constrain the output to the JSON schema
    // so parsing is guaranteed-shape.
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

    const result: QueryClassification = {
      drug_names: Array.from(new Set(drug_names)),
      query_domain: VALID_DOMAINS.includes(parsed.query_domain)
        ? parsed.query_domain
        : 'iv_drug_info',
      urgency: VALID_URGENCY.includes(parsed.urgency) ? parsed.urgency : 'routine',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };

    return Response.json(result);
  } catch (err: any) {
    console.error('AI classify route error:', err);
    return Response.json(
      { error: err?.message || 'Classification failed' },
      { status: 500 },
    );
  }
}
