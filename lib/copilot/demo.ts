/**
 * Dev-only recorded Copilot turn, replayed through the real UI with simulated timing so the whole
 * Copilot can be checked in a browser without an AI key. Enabled only in development with
 * `?copilotDemo` in the URL: the Copilot container picks `demoTransport` only when `isDemoEnabled`
 * says so, and no other module imports this one.
 *
 * The answer uses only these Remicade (infliximab) US prescribing-information facts: reconstitute each
 * 100 mg vial with 10 mL Sterile Water for Injection (21-gauge or smaller needle, aimed at the vial wall)
 * to 10 mg/mL; swirl, do not shake, foaming is normal, stand 5 minutes; dilute the total dose in 250 mL
 * 0.9% sodium chloride after withdrawing an equal volume, 0.4-4 mg/mL; infuse over at least 2 hours
 * through an in-line, sterile, non-pyrogenic, low-protein-binding filter of 1.2 µm or less; not in the
 * same line as other agents; store unopened vials at 2-8 °C, or once at up to 30 °C for up to 6 months;
 * usual dose 5 mg/kg. PubMed titles, journals, years and authors are copied from NCBI esummary.
 * Grounding redirect links are fake; the demo never touches the network.
 */

import type { CitationSupport, GroundingSource } from '@/lib/ai';
import type { LookupResult } from '@/lib/pharmacy-lookup';
import type { CopilotTransport } from './run-turn';
import type { EnrichedSource } from './types';

/** True only in development when the page URL has a `copilotDemo` query parameter. */
export function isDemoEnabled(search: string): boolean {
  return process.env.NODE_ENV === 'development' && new URLSearchParams(search).has('copilotDemo');
}

const redirect = (token: string) => `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${token}`;

const ANSWER_TEXT = `Reconstitute each **100 mg** vial with **10 mL** of Sterile Water for Injection (**10 mg/mL**), dilute the total dose in **250 mL** of 0.9% sodium chloride to a final concentration of **0.4–4 mg/mL**, and infuse over **at least 2 hours** through a low-protein-binding in-line filter. The usual dose is **5 mg/kg**; confirm the ordered dose for the indication before you count vials.

### Preparation

- Reconstitute each vial with **10 mL** of Sterile Water for Injection using a **21-gauge or smaller** needle, aiming the stream at the glass wall of the vial.
- Swirl gently to dissolve the powder; do not shake.
- Foaming on reconstitution is normal. Let the solution stand for **5 minutes**.
- Withdraw a volume of 0.9% sodium chloride equal to the total reconstituted volume from a **250 mL** bag, then add the infliximab to the bag.

### Administration and storage

Infuse over at least 2 hours through an in-line, sterile, non-pyrogenic, low-protein-binding filter with a pore size of **1.2 µm or less**. Store unopened vials in a refrigerator at **2–8 °C**.

| Step | Requirement |
| --- | --- |
| Reconstitute | **10 mL** Sterile Water for Injection per **100 mg** vial (**10 mg/mL**) |
| Dilute | Total dose in **250 mL** of 0.9% sodium chloride, **0.4–4 mg/mL** final |
| Infuse | **At least 2 hours**, through a filter of **1.2 µm or less** |
| Store unopened vials | **2–8 °C** |

### Important caveats

- Do not infuse infliximab in the same IV line with other agents.
- Unopened vials may be kept at up to **30 °C** once, for a single period of up to **6 months**.
- These steps follow the Remicade prescribing information; check the label of the infliximab product you are preparing.

\`\`\`followups
- Which premedications are commonly given before an infliximab infusion?
- How should an infusion reaction during an infliximab infusion be managed?
- Can the infusion time be shortened after a patient has tolerated earlier infusions?
\`\`\``;

const SOURCES: GroundingSource[] = [
  { uri: redirect('AUZIYQEdemo0RemicadeDailyMedLabel'), title: 'DailyMed - REMICADE- infliximab injection, powder, lyophilized, for solution' },
  { uri: redirect('AUZIYQEdemo1AcgCrohnsGuideline'), title: 'pubmed.ncbi.nlm.nih.gov' },
  { uri: redirect('AUZIYQEdemo2AccentOneTrial'), title: 'pubmed.ncbi.nlm.nih.gov' },
  { uri: redirect('AUZIYQEdemo3ActTrials'), title: 'pubmed.ncbi.nlm.nih.gov' },
  { uri: redirect('AUZIYQEdemo4AjhpRapidInfusions'), title: 'pubmed.ncbi.nlm.nih.gov' },
  { uri: redirect('AUZIYQEdemo5NiddkCrohnsTreatment'), title: 'niddk.nih.gov' },
];

const SUPPORTS: CitationSupport[] = [
  {
    text: 'Reconstitute each **100 mg** vial with **10 mL** of Sterile Water for Injection (**10 mg/mL**), dilute the total dose in **250 mL** of 0.9% sodium chloride to a final concentration of **0.4–4 mg/mL**, and infuse over **at least 2 hours** through a low-protein-binding in-line filter.',
    sourceIndices: [0],
  },
  {
    text: 'The usual dose is **5 mg/kg**; confirm the ordered dose for the indication before you count vials.',
    sourceIndices: [1, 2, 3],
  },
  {
    text: 'Reconstitute each vial with **10 mL** of Sterile Water for Injection using a **21-gauge or smaller** needle, aiming the stream at the glass wall of the vial.',
    sourceIndices: [0],
  },
  { text: 'Swirl gently to dissolve the powder; do not shake.', sourceIndices: [0] },
  {
    text: 'Withdraw a volume of 0.9% sodium chloride equal to the total reconstituted volume from a **250 mL** bag, then add the infliximab to the bag.',
    sourceIndices: [0],
  },
  {
    text: 'Infuse over at least 2 hours through an in-line, sterile, non-pyrogenic, low-protein-binding filter with a pore size of **1.2 µm or less**.',
    sourceIndices: [0, 4],
  },
  { text: 'Do not infuse infliximab in the same IV line with other agents.', sourceIndices: [0] },
  {
    text: 'Unopened vials may be kept at up to **30 °C** once, for a single period of up to **6 months**.',
    sourceIndices: [0],
  },
  // Not in the final answer, so it gets no chip; its source is still listed under References.
  { text: 'Biologics are among the medicines used to treat Crohn’s disease.', sourceIndices: [5] },
];

const ENRICHED: EnrichedSource[] = [
  {
    uri: SOURCES[0].uri,
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=a0a046c1-056d-45a9-bfd9-13b47c24f257',
    site: 'dailymed.nlm.nih.gov',
    title: SOURCES[0].title,
    shortName: 'FDA label',
    type: 'fda-label',
  },
  {
    uri: SOURCES[1].uri,
    url: 'https://pubmed.ncbi.nlm.nih.gov/40701562/',
    site: 'pubmed.ncbi.nlm.nih.gov',
    title: "ACG Clinical Guideline: Management of Crohn's Disease in Adults.",
    shortName: 'Am J Gastroenterol',
    journal: 'The American journal of gastroenterology',
    year: 2025,
    authors: 'Lichtenstein GR, Loftus EV, Afzali A, et al.',
    pmid: '40701562',
    type: 'guideline',
  },
  {
    uri: SOURCES[2].uri,
    url: 'https://pubmed.ncbi.nlm.nih.gov/12047962/',
    site: 'pubmed.ncbi.nlm.nih.gov',
    title: "Maintenance infliximab for Crohn's disease: the ACCENT I randomised trial.",
    shortName: 'Lancet',
    journal: 'Lancet (London, England)',
    year: 2002,
    authors: 'Hanauer SB, Feagan BG, Lichtenstein GR, et al.',
    pmid: '12047962',
    type: 'trial',
  },
  {
    uri: SOURCES[3].uri,
    url: 'https://pubmed.ncbi.nlm.nih.gov/16339095/',
    site: 'pubmed.ncbi.nlm.nih.gov',
    title: 'Infliximab for induction and maintenance therapy for ulcerative colitis.',
    shortName: 'N Engl J Med',
    journal: 'The New England journal of medicine',
    year: 2005,
    authors: 'Rutgeerts P, Sandborn WJ, Feagan BG, et al.',
    pmid: '16339095',
    type: 'trial',
  },
  {
    uri: SOURCES[4].uri,
    url: 'https://pubmed.ncbi.nlm.nih.gov/34050749/',
    site: 'pubmed.ncbi.nlm.nih.gov',
    title: 'Impact of rapid infliximab infusions on access at a large academic tertiary medical center.',
    shortName: 'Am J Health Syst Pharm',
    journal:
      'American journal of health-system pharmacy : AJHP : official journal of the American Society of Health-System Pharmacists',
    year: 2021,
    authors: 'Pusateri A, Hatcher A, Patel N, et al.',
    pmid: '34050749',
    type: 'journal',
  },
  {
    uri: SOURCES[5].uri,
    url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/crohns-disease/treatment',
    site: 'niddk.nih.gov',
    title: SOURCES[5].title,
    shortName: 'NIH',
    type: 'agency',
  },
];

const MANUFACTURER = 'Janssen Biotech, Inc.';
const RXCUI = '213361';

const LOOKUP: LookupResult = {
  classification: { drug_names: ['infliximab'], query_domain: 'iv_drug_info', urgency: 'routine' },
  drug_lookups: [
    {
      generic_name: 'infliximab',
      rxcui: RXCUI,
      manufacturer: MANUFACTURER,
      label_sections: [
        {
          drug: 'infliximab',
          field: 'dosage_and_administration',
          label: 'Dosage & Administration',
          content:
            'Reconstitute each 100 mg REMICADE vial with 10 mL of Sterile Water for Injection, USP, to obtain a concentration of 10 mg/mL, using a syringe equipped with a 21-gauge or smaller needle. Direct the stream of Sterile Water for Injection, USP, to the glass wall of the vial. Gently swirl the solution by rotating the vial. DO NOT SHAKE. Foaming of the solution on reconstitution is not unusual. Allow the reconstituted solution to stand for 5 minutes. Withdraw a volume of 0.9% Sodium Chloride Injection, USP, from the 250 mL infusion bag equal to the total volume of reconstituted REMICADE, then add the reconstituted REMICADE. The infusion concentration should range between 0.4 mg/mL and 4 mg/mL. The infusion must be administered intravenously for at least 2 hours with an infusion set with an in-line, sterile, non-pyrogenic, low-protein-binding filter (pore size of 1.2 µm or less). REMICADE should not be infused concomitantly in the same intravenous line with other agents.',
          source: 'openFDA',
          manufacturer: MANUFACTURER,
          rxcui: RXCUI,
        },
        {
          drug: 'infliximab',
          field: 'storage_and_handling',
          label: 'Storage & Handling',
          content:
            'Store unopened REMICADE vials in a refrigerator at 2°C to 8°C. If needed, unopened REMICADE vials may be stored at room temperatures up to a maximum of 30°C for a single period of up to 6 months.',
          source: 'openFDA',
          manufacturer: MANUFACTURER,
          rxcui: RXCUI,
        },
      ],
      shortage: {
        status: 'Not Found',
        generic_name: 'infliximab',
        source: 'openFDA',
        verification_url: 'https://www.ashp.org/drug-shortages',
      },
    },
  ],
  safety_flags: [
    {
      level: 'warning',
      category: 'interaction',
      drug: 'Infliximab',
      message: 'Do not infuse infliximab in the same IV line with other agents.',
    },
  ],
  data_sources_used: ['openfda_label', 'openfda_shortage', 'niosh_ismp_vesicant'],
};

/** The recorded turn: the question, the raw streamed answer, and what each backend call returns. */
export const DEMO_TURN: {
  question: string;
  answerText: string;
  sources: GroundingSource[];
  supports: CitationSupport[];
  enriched: EnrichedSource[];
  lookup: LookupResult;
} = {
  question: 'How do I prepare and infuse infliximab, and how should the vials be stored?',
  answerText: ANSWER_TEXT,
  sources: SOURCES,
  supports: SUPPORTS,
  enriched: ENRICHED,
  lookup: LOOKUP,
};

const LOOKUP_DELAY_MS = 600;
const CHUNK_CHARS = 40;
const CHUNK_INTERVAL_MS = 30;
const RESOLVE_DELAY_MS = 800;

/** Resolves after `ms`, or rejects as soon as `signal` aborts (clearing the timer). */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Replays `DEMO_TURN` with realistic timing. The question and request are ignored. */
export const demoTransport: CopilotTransport = {
  lookup: async (_question, signal) => {
    await wait(LOOKUP_DELAY_MS, signal);
    return structuredClone(DEMO_TURN.lookup);
  },

  stream: async (_req, cb, signal) => {
    const text = DEMO_TURN.answerText;
    for (let end = CHUNK_CHARS; ; end += CHUNK_CHARS) {
      await wait(CHUNK_INTERVAL_MS, signal);
      cb.onText(text.slice(0, end));
      if (end >= text.length) break;
    }
    cb.onSources(structuredClone(DEMO_TURN.sources));
    cb.onSupports(structuredClone(DEMO_TURN.supports));
  },

  resolve: async (_sources, signal) => {
    await wait(RESOLVE_DELAY_MS, signal);
    return structuredClone(DEMO_TURN.enriched);
  },
};
