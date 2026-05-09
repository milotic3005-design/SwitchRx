/**
 * Antimicrobial clinical-detail registry — incorporated from the iv-pharm-app
 * point-of-care reference (Architecture: spectrum + USP-797 stability +
 * CrCl tier dosing + admin notes + sources, one record per drug).
 *
 * Keyed by lowercase generic name with "/" normalized to "-". Looked up by
 * the Drug Reference modal to render four extra sections (Spectrum, Renal
 * Dosing, Hepatic Dosing, Administration Detail) on top of the existing
 * SwitchRx IV-prep monograph.
 */

export type SpectrumCoverage = 'yes' | 'variable' | 'no' | 'na' | string;

export interface SpectrumGroup {
  [organism: string]: SpectrumCoverage;
}

export interface AntimicrobialSpectrum {
  [group: string]: SpectrumGroup;
}

export interface AmStabilityRow {
  diluent: string;
  concentration: string;
  roomTempHours: number | null;
  refrigeratedHours: number | null;
  source?: string;
  notes?: string;
}

export interface RenalDosingTier {
  crclRange: string;
  dose: string;
  interval: string;
  notes?: string;
}

export interface AdministrationDetail {
  route: string;
  standardRate: string;
  extendedRate?: string;
  filter: string;
  vesicant: boolean;
  irritant: boolean;
  centralLineRequired: boolean;
  notes?: string;
}

export interface AntimicrobialDetails {
  name: string;
  brand: string[];
  class: string;
  aliases?: string[];
  spectrum: AntimicrobialSpectrum;
  spectrumNotes?: string;
  stability: AmStabilityRow[];
  renalDosing: RenalDosingTier[];
  hepaticDosing: string;
  administration: AdministrationDetail;
  sources: string[];
}

export const ANTIMICROBIAL_DETAILS: Record<string, AntimicrobialDetails> = {
  vancomycin: {
    name: 'Vancomycin',
    brand: ['Vancocin'],
    class: 'Glycopeptide',
    aliases: ['vanco'],
    spectrum: {
      'Gram-positive': {
        MSSA: 'yes',
        MRSA: 'yes',
        'Streptococcus spp.': 'yes',
        'Enterococcus (E. faecalis)': 'yes',
        VRE: 'no',
        'C. difficile (PO only)': 'yes',
      },
      'Gram-negative': { All: 'no' },
      Anaerobes: { 'C. difficile': 'yes (PO)', 'Other anaerobes': 'no' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'IV vancomycin has NO activity against gram-negatives, atypicals, or VRE. PO/PR vancomycin is used only for C. difficile (not absorbed systemically).',
    stability: [
      { diluent: 'NS or D5W', concentration: '5 mg/mL', roomTempHours: 24, refrigeratedHours: 336, source: "Vancomycin PI 2020; Trissel's IV Handbook", notes: '14 days refrigerated per manufacturer.' },
      { diluent: 'NS or D5W', concentration: '10 mg/mL (peripheral max)', roomTempHours: 24, refrigeratedHours: 336, source: 'ASHP Guidelines 2020' },
    ],
    renalDosing: [
      { crclRange: '>50 mL/min', dose: '15-20 mg/kg actual BW', interval: 'q8-12h', notes: 'Target AUC24/MIC 400-600 mg·h/L (preferred over trough monitoring).' },
      { crclRange: '20-50 mL/min', dose: '15-20 mg/kg', interval: 'q24h', notes: 'Adjust by levels/AUC.' },
      { crclRange: '<20 mL/min', dose: '15-20 mg/kg load', interval: 'by levels', notes: 'Redose when level <15-20 mg/L.' },
      { crclRange: 'Intermittent HD', dose: '15-25 mg/kg load, then 5-10 mg/kg post-HD', interval: 'post-HD', notes: 'Use high-flux membrane removal data.' },
    ],
    hepaticDosing: 'No adjustment required. Hepatic metabolism is minimal.',
    administration: {
      route: 'IV intermittent infusion',
      standardRate: 'Infuse over at least 60 min; max rate 10 mg/min for any dose',
      extendedRate: 'For doses >1 g, extend infusion to 1.5-2 hours to reduce vancomycin infusion reaction (red-person syndrome)',
      filter: 'not required',
      vesicant: false,
      irritant: true,
      centralLineRequired: false,
      notes: 'Concentrations >5 mg/mL increase risk of phlebitis — central line preferred for prolonged courses or high concentrations. Vancomycin infusion reaction (formerly "red man syndrome") is rate-related, not allergy.',
    },
    sources: ['Vancomycin Package Insert (Hospira) 2020', 'ASHP Therapeutic Guidelines 2020', "Trissel's IV Handbook"],
  },

  'piperacillin-tazobactam': {
    name: 'Piperacillin-Tazobactam',
    brand: ['Zosyn', 'Tazocin'],
    class: 'Beta-lactam / beta-lactamase inhibitor',
    aliases: ['zosyn', 'pip-tazo', 'ptz'],
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', 'Enterococcus (E. faecalis)': 'yes', VRE: 'no' },
      'Gram-negative': { 'Enterobacterales (E. coli, Klebsiella)': 'yes', 'Pseudomonas aeruginosa': 'yes', ESBL: 'variable', AmpC: 'no', CRE: 'no' },
      Anaerobes: { 'B. fragilis': 'yes' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Broad gram-negative + anti-pseudomonal + anaerobe coverage. Avoid empiric monotherapy for ESBL bacteremia (per MERINO trial). No MRSA, no atypicals.',
    stability: [
      { diluent: 'NS or D5W', concentration: 'Standard reconstitution (e.g., 4.5 g in 100 mL)', roomTempHours: 24, refrigeratedHours: 168, source: 'Zosyn PI 2017', notes: '7 days refrigerated; do NOT freeze admixed bag.' },
      { diluent: "Lactated Ringer's", concentration: 'Standard', roomTempHours: null, refrigeratedHours: null, source: 'Zosyn PI 2017', notes: 'INCOMPATIBLE with LR per PI.' },
    ],
    renalDosing: [
      { crclRange: '>40 mL/min', dose: '3.375 g (or 4.5 g for severe/Pseudomonas)', interval: 'q6-8h', notes: 'Extended infusion 4 hr q8h is preferred for severe gram-negative infections (PK/PD T>MIC).' },
      { crclRange: '20-40 mL/min', dose: '3.375 g', interval: 'q8h' },
      { crclRange: '<20 mL/min', dose: '2.25 g', interval: 'q8h' },
      { crclRange: 'Intermittent HD', dose: '2.25 g q12h + 0.75 g post-HD', interval: 'q12h + post-HD', notes: 'Or 2.25 g q8h with one dose given post-HD on dialysis days.' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent or extended infusion',
      standardRate: 'Infuse over 30 min',
      extendedRate: 'Extended infusion 4 hours for serious infections (improves T>MIC; consider for Pseudomonas, ICU sepsis)',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'AKI signal when combined with vancomycin (VPT nephrotoxicity) — monitor SCr, consider cefepime as alternative if both indicated.',
    },
    sources: ['Zosyn Package Insert (Pfizer) 2017', 'MERINO Trial JAMA 2018', "Trissel's IV Handbook"],
  },

  cefepime: {
    name: 'Cefepime',
    brand: ['Maxipime'],
    class: '4th-generation cephalosporin',
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', Enterococcus: 'no' },
      'Gram-negative': { Enterobacterales: 'yes', 'Pseudomonas aeruginosa': 'yes', ESBL: 'no', 'AmpC (stable)': 'yes', CRE: 'no' },
      Anaerobes: { 'B. fragilis': 'no' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Pseudomonal + AmpC-stable gram-negative coverage. No anaerobic coverage — add metronidazole for intra-abdominal. No MRSA, no Enterococcus.',
    stability: [
      { diluent: 'NS or D5W', concentration: '1-40 mg/mL', roomTempHours: 24, refrigeratedHours: 168, source: 'Maxipime PI 2020' },
      { diluent: "SWFI / Lactated Ringer's", concentration: '1-40 mg/mL', roomTempHours: 24, refrigeratedHours: 168, source: 'Maxipime PI 2020' },
    ],
    renalDosing: [
      { crclRange: '>60 mL/min', dose: '2 g', interval: 'q8h', notes: 'Febrile neutropenia or Pseudomonas: 2 g q8h.' },
      { crclRange: '30-60 mL/min', dose: '2 g', interval: 'q12h' },
      { crclRange: '11-29 mL/min', dose: '2 g', interval: 'q24h' },
      { crclRange: '<11 mL/min', dose: '1 g', interval: 'q24h' },
      { crclRange: 'Intermittent HD', dose: '1 g loading, then 1 g post-HD on dialysis days', interval: 'post-HD' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent infusion',
      standardRate: 'Infuse over 30 min',
      extendedRate: 'Extended 3-hour infusion improves T>MIC for resistant Pseudomonas',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'Cefepime-induced neurotoxicity (encephalopathy, non-convulsive status epilepticus) is dose-related and disproportionate in renal impairment — verify renal dosing carefully.',
    },
    sources: ['Maxipime Package Insert (Hospira) 2020', 'IDSA Febrile Neutropenia Guidelines 2010'],
  },

  meropenem: {
    name: 'Meropenem',
    brand: ['Merrem'],
    class: 'Carbapenem',
    aliases: ['mero'],
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', Enterococcus: 'variable', VRE: 'no' },
      'Gram-negative': { Enterobacterales: 'yes', 'Pseudomonas aeruginosa': 'yes', ESBL: 'yes', AmpC: 'yes', 'CRE (KPC)': 'no', Stenotrophomonas: 'no' },
      Anaerobes: { 'B. fragilis': 'yes' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Drug of choice for ESBL bacteremia. NO activity vs MRSA, VRE, atypicals, Stenotrophomonas, or carbapenemase-producing organisms. Lower seizure risk than imipenem.',
    stability: [
      { diluent: 'NS', concentration: '1-20 mg/mL', roomTempHours: 4, refrigeratedHours: 24, source: 'Merrem PI 2016', notes: 'Less stable than most beta-lactams — limits practicality of extended infusion without close-to-administration prep.' },
      { diluent: 'D5W', concentration: '1-20 mg/mL', roomTempHours: 1, refrigeratedHours: 4, source: 'Merrem PI 2016', notes: 'Significantly shorter stability in dextrose — NS strongly preferred.' },
    ],
    renalDosing: [
      { crclRange: '>50 mL/min', dose: '1-2 g', interval: 'q8h', notes: 'Meningitis or Pseudomonas: 2 g q8h.' },
      { crclRange: '26-50 mL/min', dose: '1 g', interval: 'q12h' },
      { crclRange: '10-25 mL/min', dose: '500 mg', interval: 'q12h' },
      { crclRange: '<10 mL/min', dose: '500 mg', interval: 'q24h' },
      { crclRange: 'Intermittent HD', dose: '500 mg q24h, give after HD on dialysis days', interval: 'q24h' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent or extended infusion',
      standardRate: 'Infuse over 15-30 min',
      extendedRate: 'Extended 3-hour infusion preferred for serious gram-negative infections (improved T>MIC)',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'Lowers serum valproic acid levels — avoid combination if possible (significant interaction).',
    },
    sources: ['Merrem Package Insert (AstraZeneca) 2016', "Trissel's IV Handbook", 'IDSA AMR Guidance 2024'],
  },

  ceftazidime: {
    name: 'Ceftazidime',
    brand: ['Fortaz', 'Tazicef'],
    class: '3rd-generation cephalosporin (anti-pseudomonal)',
    aliases: ['caz'],
    spectrum: {
      'Gram-positive': { MSSA: 'variable', MRSA: 'no', 'Streptococcus spp.': 'yes', Enterococcus: 'no' },
      'Gram-negative': { Enterobacterales: 'yes', 'Pseudomonas aeruginosa': 'yes', ESBL: 'no', AmpC: 'no', CRE: 'no' },
      Anaerobes: { 'B. fragilis': 'no' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Strong gram-negative + anti-pseudomonal coverage but WEAK gram-positive (especially S. aureus). Often combined with another agent for empiric coverage.',
    stability: [
      { diluent: 'NS or D5W', concentration: '1-40 mg/mL', roomTempHours: 24, refrigeratedHours: 168, source: 'Fortaz PI 2010', notes: '7 days refrigerated.' },
    ],
    renalDosing: [
      { crclRange: '>50 mL/min', dose: '1-2 g', interval: 'q8h', notes: 'Pseudomonas/serious infection: 2 g q8h.' },
      { crclRange: '31-50 mL/min', dose: '1 g', interval: 'q12h' },
      { crclRange: '16-30 mL/min', dose: '1 g', interval: 'q24h' },
      { crclRange: '6-15 mL/min', dose: '500 mg', interval: 'q24h' },
      { crclRange: '<5 mL/min', dose: '500 mg', interval: 'q48h' },
      { crclRange: 'Intermittent HD', dose: '1 g load, then 1 g post-HD', interval: 'post-HD' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent infusion',
      standardRate: 'Infuse over 15-30 min',
      extendedRate: 'Extended 3-hour infusion considered for resistant Pseudomonas',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'First choice anti-pseudomonal cephalosporin if cefepime unavailable; avoid for AmpC producers (use cefepime or carbapenem).',
    },
    sources: ['Fortaz Package Insert (GSK) 2010', "Trissel's IV Handbook"],
  },

  daptomycin: {
    name: 'Daptomycin',
    brand: ['Cubicin'],
    class: 'Cyclic lipopeptide',
    aliases: ['dapto'],
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'yes', 'Streptococcus spp.': 'yes', 'Enterococcus (E. faecalis)': 'yes', VRE: 'yes' },
      'Gram-negative': { All: 'no' },
      Anaerobes: { 'Gram-positive anaerobes': 'yes', 'B. fragilis': 'no' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Bactericidal against gram-positives including MRSA and VRE. INACTIVATED by pulmonary surfactant — DO NOT use for pneumonia. No gram-negative or atypical coverage.',
    stability: [
      { diluent: 'NS or LR (NOT D5W)', concentration: 'Reconstituted 50 mg/mL, then dilute', roomTempHours: 12, refrigeratedHours: 48, source: 'Cubicin PI 2017', notes: 'Combined RT + refrigerated total ≤48 hr. Incompatible with dextrose-containing diluents.' },
    ],
    renalDosing: [
      { crclRange: '≥30 mL/min', dose: '4-6 mg/kg (8-12 mg/kg high-dose for VRE/endocarditis)', interval: 'q24h', notes: 'Use actual body weight.' },
      { crclRange: '<30 mL/min (incl. HD/CRRT)', dose: 'Same dose', interval: 'q48h', notes: 'On HD days, give AFTER dialysis.' },
    ],
    hepaticDosing: 'No adjustment required (mild-moderate impairment).',
    administration: {
      route: 'IV intermittent infusion or IV push',
      standardRate: 'Infuse over 30 min, OR IV push over 2 min (FDA-approved)',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'Monitor CPK weekly (more often if statin co-administered). Discontinue statin during therapy if possible. Eosinophilic pneumonia is a known but rare adverse effect.',
    },
    sources: ['Cubicin Package Insert (Merck) 2017', 'IDSA MRSA Guidelines'],
  },

  ertapenem: {
    name: 'Ertapenem',
    brand: ['Invanz'],
    class: 'Carbapenem (group 1)',
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', Enterococcus: 'no' },
      'Gram-negative': { Enterobacterales: 'yes', 'Pseudomonas aeruginosa': 'no', Acinetobacter: 'no', ESBL: 'yes', AmpC: 'yes', CRE: 'no' },
      Anaerobes: { 'B. fragilis': 'yes' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'ESBL coverage WITHOUT anti-pseudomonal activity. Useful for outpatient parenteral therapy (OPAT) due to once-daily dosing. NO Pseudomonas, NO Acinetobacter, NO Enterococcus.',
    stability: [
      { diluent: 'NS only', concentration: 'Final 20 mg/mL', roomTempHours: 6, refrigeratedHours: 24, source: 'Invanz PI 2019', notes: 'Do NOT use D5W. Do NOT freeze.' },
    ],
    renalDosing: [
      { crclRange: '>30 mL/min', dose: '1 g', interval: 'q24h' },
      { crclRange: '≤30 mL/min', dose: '500 mg', interval: 'q24h' },
      { crclRange: 'Intermittent HD', dose: '500 mg q24h; if dose given <6 hr before HD, give 150 mg supplemental post-HD', interval: 'q24h' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent infusion or IM',
      standardRate: 'Infuse over 30 min',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'IM administration uses 1% lidocaine as diluent — do NOT use the IM preparation for IV. Once-daily dosing makes it ideal for OPAT (e.g., ESBL UTI in outpatient infusion clinic).',
    },
    sources: ['Invanz Package Insert (Merck) 2019'],
  },

  ceftriaxone: {
    name: 'Ceftriaxone',
    brand: ['Rocephin'],
    class: '3rd-generation cephalosporin',
    aliases: ['ctx', 'rocephin'],
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', 'S. pneumoniae': 'yes', Enterococcus: 'no' },
      'Gram-negative': { Enterobacterales: 'yes', 'Pseudomonas aeruginosa': 'no', ESBL: 'no', AmpC: 'no', 'Neisseria spp.': 'yes', 'H. influenzae': 'yes' },
      Anaerobes: { 'Above the diaphragm': 'yes', 'B. fragilis': 'no' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Workhorse for community-acquired pneumonia, meningitis (covers S. pneumoniae and Neisseria), pyelonephritis, gonorrhea. Does NOT cover Pseudomonas, Enterococcus, or atypicals.',
    stability: [
      { diluent: 'NS or D5W', concentration: '10-40 mg/mL', roomTempHours: 48, refrigeratedHours: 240, source: 'Rocephin PI 2015', notes: '10 days refrigerated.' },
      { diluent: "Lactated Ringer's / Calcium-containing solutions", concentration: 'any', roomTempHours: null, refrigeratedHours: null, source: 'Rocephin PI 2015 BLACK BOX', notes: 'DO NOT mix or co-administer with calcium-containing IV solutions in NEONATES — fatal Ca/ceftriaxone precipitation in lungs/kidneys. In patients >28 days, can be given sequentially via flushed line.' },
    ],
    renalDosing: [
      { crclRange: 'All renal function', dose: '1-2 g (2 g for serious infections; meningitis 2 g q12h)', interval: 'q24h', notes: 'No renal dose adjustment for normal hepatic function.' },
      { crclRange: 'Severe renal + hepatic impairment combined', dose: 'Max 2 g/day', interval: 'q24h', notes: 'Otherwise no adjustment.' },
    ],
    hepaticDosing: 'No adjustment required for hepatic impairment alone.',
    administration: {
      route: 'IV intermittent infusion or IM',
      standardRate: 'Infuse over 30 min (adults); 60 min in neonates',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'Causes biliary sludging — clinical significance usually low but flag in cholestasis. Pseudolithiasis reversible on discontinuation.',
    },
    sources: ['Rocephin Package Insert (Roche) 2015', 'FDA Black Box Warning — Ca incompatibility in neonates'],
  },

  'ampicillin-sulbactam': {
    name: 'Ampicillin-Sulbactam',
    brand: ['Unasyn'],
    class: 'Aminopenicillin / beta-lactamase inhibitor',
    aliases: ['unasyn', 'amp-sulbactam'],
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', 'Enterococcus (E. faecalis)': 'yes', VRE: 'no' },
      'Gram-negative': { Enterobacterales: 'variable', 'H. influenzae': 'yes', 'Pseudomonas aeruginosa': 'no', 'Acinetobacter baumannii': 'yes (sulbactam)', ESBL: 'no' },
      Anaerobes: { 'B. fragilis': 'yes', 'Oral anaerobes': 'yes' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Sulbactam contributes intrinsic activity against Acinetobacter baumannii. Increasing E. coli resistance limits empiric use for cystitis. Useful for human/animal bite wounds, oral/dental infections, aspiration pneumonia.',
    stability: [
      { diluent: 'NS', concentration: 'Up to 45 mg/mL combined', roomTempHours: 8, refrigeratedHours: 72, source: 'Unasyn PI 2017', notes: 'Stability shorter at higher concentrations and warmer temps.' },
      { diluent: 'D5W', concentration: 'Up to 30 mg/mL', roomTempHours: 2, refrigeratedHours: 4, source: 'Unasyn PI 2017', notes: 'NS strongly preferred.' },
    ],
    renalDosing: [
      { crclRange: '>30 mL/min', dose: '1.5-3 g', interval: 'q6h' },
      { crclRange: '15-29 mL/min', dose: '1.5-3 g', interval: 'q12h' },
      { crclRange: '5-14 mL/min', dose: '1.5-3 g', interval: 'q24h' },
      { crclRange: 'Intermittent HD', dose: '1.5-3 g q24h, give after HD on dialysis days', interval: 'q24h' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent infusion',
      standardRate: 'Infuse over 15-30 min',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'High-dose ampicillin-sulbactam (e.g., 9 g sulbactam/day) used for carbapenem-resistant Acinetobacter — confirm institutional protocol.',
    },
    sources: ['Unasyn Package Insert (Pfizer) 2017', 'IDSA AMR Guidance 2024'],
  },

  cefazolin: {
    name: 'Cefazolin',
    brand: ['Ancef', 'Kefzol'],
    class: '1st-generation cephalosporin',
    aliases: ['ancef', 'cfz'],
    spectrum: {
      'Gram-positive': { MSSA: 'yes', MRSA: 'no', 'Streptococcus spp.': 'yes', Enterococcus: 'no' },
      'Gram-negative': { 'E. coli': 'yes', 'Klebsiella pneumoniae': 'yes', 'Proteus mirabilis': 'yes', 'Pseudomonas aeruginosa': 'no', ESBL: 'no' },
      Anaerobes: { 'Oral anaerobes': 'variable', 'B. fragilis': 'no' },
      Atypicals: { All: 'no' },
    },
    spectrumNotes:
      'Drug of choice for MSSA bacteremia/endocarditis (preferred over nafcillin due to less hepatotoxicity, q8h dosing). Standard surgical prophylaxis. Limited gram-negative coverage; useful for uncomplicated UTI.',
    stability: [
      { diluent: 'NS or D5W', concentration: 'Up to 20 mg/mL', roomTempHours: 24, refrigeratedHours: 240, source: 'Cefazolin PI 2018', notes: '10 days refrigerated. Do NOT freeze admixed bag long-term per institution.' },
    ],
    renalDosing: [
      { crclRange: '≥55 mL/min', dose: '1-2 g (2 g for >120 kg or serious infection)', interval: 'q8h' },
      { crclRange: '35-54 mL/min', dose: '1-2 g', interval: 'q8h', notes: 'No adjustment per most references.' },
      { crclRange: '11-34 mL/min', dose: '1-2 g', interval: 'q12h' },
      { crclRange: '≤10 mL/min', dose: '1-2 g', interval: 'q24h' },
      { crclRange: 'Intermittent HD', dose: '2 g post-HD, 3x weekly', interval: 'post-HD only', notes: 'Common outpatient HD regimen for MSSA bacteremia.' },
    ],
    hepaticDosing: 'No adjustment required.',
    administration: {
      route: 'IV intermittent infusion or IV push',
      standardRate: 'Infuse over 5-30 min; doses ≤1 g may be given IV push over 3-5 min',
      filter: 'not required',
      vesicant: false,
      irritant: false,
      centralLineRequired: false,
      notes: 'Surgical prophylaxis: redose intraoperatively at q4h if procedure ongoing. The thrice-weekly post-HD dosing strategy is a workhorse for outpatient MSSA bacteremia treatment.',
    },
    sources: ['Cefazolin Package Insert (Sandoz) 2018', 'ASHP Surgical Prophylaxis Guidelines 2013'],
  },
};

/**
 * Look up the antimicrobial detail record for a SwitchRx Drug entry by its
 * generic name. Normalizes "/" → "-" so "Piperacillin/Tazobactam" matches
 * the iv-pharm-app key "piperacillin-tazobactam".
 */
export function getAntimicrobialDetails(genericName: string | undefined): AntimicrobialDetails | null {
  if (!genericName) return null;
  const key = genericName.trim().toLowerCase().replace(/\s*\/\s*/g, '-').replace(/\s+/g, '-');
  return ANTIMICROBIAL_DETAILS[key] ?? null;
}
