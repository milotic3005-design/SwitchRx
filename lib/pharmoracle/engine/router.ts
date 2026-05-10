import { classifyQuery } from './classifier';
import { fetchDailyMedSections } from './dailymed-fetcher';
import { searchPubmed } from './pubmed-researcher';
import { generateSafetyFlags } from './safety-checker';
import { checkShortage } from './shortage-monitor';
import { synthesizeAnswer } from './synthesizer';
import { STANDARD_DISCLAIMER, type DataSource, type PharmOracleAnswer } from '../types/clinical';

/**
 * Main pipeline: classify → fan out APIs in parallel → synthesize.
 *
 * The single point of orchestration so a chat route, a panel, or a CLI can
 * all share the exact same end-to-end behavior.
 */
export const runPipeline = async (
  query: string,
  apiKey: string
): Promise<PharmOracleAnswer> => {
  const classification = await classifyQuery(query, apiKey);
  const primaryDrug = classification.drug_names[0];

  const safetyFlags = classification.safety_review_required
    ? generateSafetyFlags(classification)
    : [];

  const [labelSections, evidence, shortage] = await Promise.all([
    classification.requires_dailymed && primaryDrug
      ? fetchDailyMedSections(primaryDrug, classification.query_domain)
      : Promise.resolve([]),
    classification.requires_pubmed
      ? searchPubmed(query)
      : Promise.resolve([]),
    classification.requires_shortage_check && primaryDrug
      ? checkShortage(primaryDrug)
      : Promise.resolve(undefined),
  ]);

  const clinical_content = await synthesizeAnswer({
    query,
    classification,
    evidence,
    labelSections,
    safetyFlags,
    shortage,
  }, apiKey);

  const data_sources_used: DataSource[] = [];
  if (labelSections.length) data_sources_used.push('dailymed');
  if (evidence.length) data_sources_used.push('pubmed');
  if (shortage) data_sources_used.push('openfda_shortage');
  if (data_sources_used.length === 0) data_sources_used.push('knowledge_base');

  const summaryLine = clinical_content.split('\n').find(l => l.trim().length > 0) ?? '';
  const bottomMatch = clinical_content.match(/Clinical Bottom Line[\s\S]*?$/);

  return {
    query_domain: classification.query_domain,
    data_sources_used,
    summary: summaryLine.slice(0, 280),
    clinical_content,
    safety_flags: safetyFlags,
    evidence,
    fda_label_sections: labelSections,
    shortage_status: shortage,
    bottom_line: bottomMatch ? bottomMatch[0].slice(0, 280) : '',
    disclaimer: STANDARD_DISCLAIMER,
  };
};
