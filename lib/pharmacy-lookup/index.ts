// Pharmacy Lookup pipeline orchestrator. End-to-end flow:
//   1. Classify scenario + extract drug names (Gemini Flash, JSON-mode)
//   2. In parallel for every drug: openFDA label + openFDA shortage check
//   3. Local safety-flag pass (vesicant, ISMP, NIOSH, cross-drug rules)
//   4. Bundle results into a LookupResult that the UI renders as panels
//      and the consult-brief synthesizer consumes as ground-truth context.

import { classifyAndExtract } from './extractor';
import { fetchFdaLabel } from './openfda-label';
import { checkShortage } from './shortage-monitor';
import { generateSafetyFlags } from './safety-checker';
import type { DrugLookup, LookupResult } from './types';

const MAX_DRUGS = 6; // cap parallel API fan-out for performance

const lookupOneDrug = async (drug: string): Promise<DrugLookup> => {
  const [labelResult, shortage] = await Promise.all([
    fetchFdaLabel(drug),
    checkShortage(drug),
  ]);

  return {
    generic_name: drug,
    rxcui: labelResult.rxcui,
    manufacturer: labelResult.manufacturer,
    label_sections: labelResult.sections,
    shortage,
    not_found: labelResult.not_found,
  };
};

export const runPharmacyLookup = async (
  scenario: string,
  apiKey: string
): Promise<LookupResult> => {
  const classification = await classifyAndExtract(scenario, apiKey);

  const drugsToLookup = classification.drug_names.slice(0, MAX_DRUGS);

  const drug_lookups = drugsToLookup.length
    ? await Promise.all(drugsToLookup.map(lookupOneDrug))
    : [];

  const safety_flags = generateSafetyFlags(classification);

  // Append shortage flags for any drugs currently in shortage
  for (const dl of drug_lookups) {
    if (dl.shortage?.status === 'Currently in Shortage') {
      safety_flags.push({
        level: 'warning',
        category: 'shortage',
        drug: dl.generic_name,
        message: `${dl.generic_name} is currently in shortage per openFDA${dl.shortage.reason ? ` (reason: ${dl.shortage.reason})` : ''}. Confirm institutional supply before initiating; review ASHP shortage substitution guidance.`,
      });
    } else if (dl.shortage?.status === 'Discontinued') {
      safety_flags.push({
        level: 'critical',
        category: 'shortage',
        drug: dl.generic_name,
        message: `${dl.generic_name} is listed as DISCONTINUED per openFDA. Identify a clinically-equivalent alternative before proceeding.`,
      });
    }
  }

  const data_sources_used: string[] = [];
  if (drug_lookups.some(d => d.label_sections.length)) data_sources_used.push('openfda_label');
  if (drug_lookups.some(d => d.shortage)) data_sources_used.push('openfda_shortage');
  if (safety_flags.length) data_sources_used.push('niosh_ismp_vesicant');

  return {
    classification,
    drug_lookups,
    safety_flags,
    data_sources_used,
  };
};

// Format the lookup as a compact string the consult-brief LLM can consume
// as authoritative pre-fetched context. Short and structured so it doesn't
// blow the context window for multi-drug regimens.
export const formatLookupForPrompt = (result: LookupResult): string => {
  if (!result.drug_lookups.length && !result.safety_flags.length) return '';

  const lines: string[] = [];
  lines.push('## PRE-FETCHED AUTHORITATIVE DATA (verified — anchor your brief on this)');
  lines.push('');
  lines.push(`Classified domain: **${result.classification.query_domain}** · urgency: ${result.classification.urgency}`);

  if (result.safety_flags.length) {
    lines.push('');
    lines.push('### Safety Flags (locally curated — vesicant / ISMP / NIOSH / cross-drug rules)');
    for (const f of result.safety_flags) {
      lines.push(`- [${f.level.toUpperCase()} · ${f.category}]${f.drug ? ` ${f.drug}:` : ''} ${f.message}`);
    }
  }

  for (const d of result.drug_lookups) {
    lines.push('');
    lines.push(`### ${d.generic_name}${d.manufacturer ? ` (${d.manufacturer})` : ''}`);
    if (d.rxcui) lines.push(`RxCUI: ${d.rxcui}`);
    if (d.shortage) {
      lines.push(`openFDA shortage status: **${d.shortage.status}**${d.shortage.reason ? ` — ${d.shortage.reason}` : ''}`);
    }
    if (d.not_found) {
      lines.push('⚠️ openFDA label lookup returned no IV/parenteral match for this drug.');
      continue;
    }
    for (const s of d.label_sections) {
      lines.push('');
      lines.push(`**FDA Label — ${s.label}:**`);
      lines.push(s.content);
    }
  }

  lines.push('');
  lines.push('Use the above as your primary source of truth for the drug-specific facts. Supplement with Google Search ONLY for items not covered above (e.g. specific guideline recommendations, comparative trials).');

  return lines.join('\n');
};

export type { LookupResult, DrugLookup, SafetyFlag, ShortageStatus, LabelSection } from './types';
