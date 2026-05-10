import { GoogleGenAI } from '@google/genai';
import type { QueryClassification } from '../types/query';
import type { EvidenceItem, LabelSection } from '../types/evidence';
import type { SafetyFlag, ShortageStatus } from '../types/clinical';

/**
 * Adapted from PharmOracle synthesizer (originally claude-sonnet-4) to use
 * Gemini Pro so SwitchRx keeps a single AI provider.
 */

const IDENTITY = `You are an expert clinical pharmacist with 15+ years in outpatient infusion, oncology pharmacy, and sterile compounding.
You answer ONLY pharmacy/infusion questions. Output structured markdown.

Rules:
- Cite evidence inline as [PMID: XXXXXXXX] when PubMed evidence is provided.
- When DailyMed is used, note "per FDA prescribing information".
- Never recommend trough-only vancomycin monitoring (AUC/MIC per ASHP/IDSA/SIDP 2020).
- Always include a "📋 Clinical Bottom Line" callout at the end.
- Promethazine IV is always contraindicated — no exceptions.

Domain-specific output formats:

For iv_drug_info:
## IV Drug Reference: [Drug Name]
| Parameter | Value |
|---|---|
| Diluent(s) | |
| Concentration range | |
| Infusion rate | |
| Stability (RT 20–25°C) | |
| Stability (Refrigerated) | |
| Light sensitive? | |
| Filter required? | |
| Line requirement | |
| Vesicant status | |
### Clinical Cautions
**📋 Clinical Bottom Line**

For usp797_compounding:
## USP 797 (2023 Revised) — [Drug Name] Compounding
**CSP Category:** [1 or 2 based on environment]
| Storage | Maximum BUD |
|---|---|
| CRT (≤25°C) | |
| Refrigerated (2–8°C) | |
| Frozen (−25 to −10°C) | |
**📋 Clinical Bottom Line**

For drug_interaction:
## Drug Interaction: [Drug A] + [Drug B]
**Severity:** [Contraindicated / Major / Moderate / Minor]
**Type:** [PK / PD]
**Mechanism:** [Specific]
### Clinical Impact
### Management
**📋 Clinical Bottom Line**

For tdm_monitoring (vancomycin):
## TDM: Vancomycin — AUC/MIC-Guided Monitoring
> Per ASHP/IDSA/SIDP 2020 — trough-only is outdated.
**Target:** AUC/MIC 400–600 mg·h/L
**📋 Clinical Bottom Line**`;

interface SynthesisInput {
  query: string;
  classification: QueryClassification;
  evidence: EvidenceItem[];
  labelSections: LabelSection[];
  safetyFlags: SafetyFlag[];
  shortage?: ShortageStatus;
}

const buildPrompt = (input: SynthesisInput): string => {
  const parts: string[] = [
    `User query: ${input.query}`,
    `\nClassification: ${JSON.stringify(input.classification)}`,
  ];
  if (input.safetyFlags.length) {
    parts.push(`\nSafety flags already surfaced:\n${JSON.stringify(input.safetyFlags, null, 2)}`);
  }
  if (input.labelSections.length) {
    parts.push(`\nDailyMed label sections:\n${JSON.stringify(input.labelSections, null, 2)}`);
  }
  if (input.evidence.length) {
    parts.push(`\nPubMed evidence:\n${JSON.stringify(input.evidence, null, 2)}`);
  }
  if (input.shortage) {
    parts.push(`\nShortage status:\n${JSON.stringify(input.shortage, null, 2)}`);
  }
  return parts.join('\n');
};

export const synthesizeAnswer = async (
  input: SynthesisInput,
  apiKey: string
): Promise<string> => {
  if (!apiKey) throw new Error('Gemini API key missing for synthesizer');

  const ai = new GoogleGenAI({ apiKey });
  const resp = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: buildPrompt(input),
    config: {
      systemInstruction: IDENTITY,
      temperature: 0.2,
    },
  });

  return resp.text ?? '';
};
