import type { Drug, ClinicalSummary, Hazardous, Extravasation, Sequencing, Emetogenic, Toxicities } from '@/lib/iv-reference-types';

// ==========================================
// CLINICAL SUMMARIES
// ==========================================
const CLINICAL_SUMMARIES: Record<string, ClinicalSummary> = {
  "Cisplatin": { pearls: "Highly emetogenic, requires aggressive pre/post hydration. Nephrotoxic and ototoxic.", dosing: "Varies (e.g., 50-100 mg/m2 IV q3-4 weeks).", monitoring: "SCr, BUN, Mg, K, Audiometry, CBC." },
  "Carboplatin": { pearls: "Dosed via Calvert formula (Target AUC). Hypersensitivity can occur after multiple doses.", dosing: "Target AUC 4-6 IV q3-4 weeks.", monitoring: "CBC (especially platelets), SCr, LFTs." },
  "Oxaliplatin": { pearls: "Cold-induced neuropathy is a hallmark toxicity. Exacerbated by cold drinks/air.", dosing: "85-130 mg/m2 IV q2-3 weeks.", monitoring: "CBC, neuropathy symptoms, LFTs." },
  "Paclitaxel": { pearls: "Requires non-PVC tubing/bags and in-line filter. High risk of hypersensitivity.", dosing: "175 mg/m2 IV q3 weeks or 80 mg/m2 weekly.", monitoring: "CBC, neuropathy, vital signs (infusion rxn)." },
  "Docetaxel": { pearls: "Fluid retention risk; premedicate with dexamethasone. Non-PVC tubing required.", dosing: "75-100 mg/m2 IV q3 weeks.", monitoring: "CBC, LFTs, weight/edema." },
  "Doxorubicin": { pearls: "Potent vesicant. Lifetime cumulative dose limit (usually 450-550 mg/m2) due to cardiotoxicity. Red urine.", dosing: "40-60 mg/m2 IV q3-4 weeks.", monitoring: "ECHO/MUGA (LVEF), CBC, LFTs." },
  "Cyclophosphamide": { pearls: "Hemorrhagic cystitis risk (hydrate well, +/- mesna for high doses).", dosing: "Varies widely (e.g., 600 mg/m2 IV q2-3 weeks).", monitoring: "CBC, urinalysis, BUN/SCr." },
  "Fluorouracil": { pearls: "DPD deficiency increases toxicity risk. Continuous infusion = higher hand-foot syndrome risk.", dosing: "Varies (bolus vs continuous, e.g., 2400 mg/m2 over 46h).", monitoring: "CBC, LFTs, oral mucosa." },
  "Pembrolizumab": { pearls: "Immune-mediated toxicities (pneumonitis, colitis, endocrinopathies).", dosing: "200 mg q3w or 400 mg q6w IV.", monitoring: "Thyroid panel, LFTs, SCr, respiratory sx." },
  "Vancomycin": { pearls: "Red man syndrome with rapid infusion (premedicate or slow rate). AUC/MIC targeting is preferred per ASHP/IDSA/SIDP 2020 guidelines.", dosing: "15-20 mg/kg IV q8-12h (adjust for renal function; AUC-guided dosing preferred).", monitoring: "AUC/MIC monitoring preferred (target AUC24 400–600 mg·h/L; trough-only monitoring no longer recommended as primary strategy). SCr baseline and at least q48–72h. Auditory function for prolonged courses." },
  "Immune Globulin Intravenous (IVIG)": { pearls: "Do not mix with other drugs. Infusion rate is concentration and brand-dependent. Risk of renal failure and thrombosis.", dosing: "Varies widely by indication.", monitoring: "Renal function, urine output, vital signs, signs of thrombosis." },
  "Iron Sucrose": { pearls: "Test dose not required. Monitor for hypotension during infusion.", dosing: "Typically 100-300 mg per dose.", monitoring: "BP, HR, ferritin, TSAT." },
  "Iron Dextran": { pearls: "Boxed warning for fatal anaphylaxis. A 25 mg TEST DOSE is mandatory before the full therapeutic dose.", dosing: "Varies (can be total dose infusion).", monitoring: "Observe for signs of anaphylaxis for at least 1 hour." },
  "Ferumoxytol": { pearls: "Boxed warning for anaphylaxis. Must be diluted and infused over at least 15 minutes (no IV push). Can alter MRI imaging.", dosing: "510 mg IV x 2 doses (3-8 days apart).", monitoring: "Monitor for hypersensitivity for at least 30 mins post-infusion." },
  "Ampicillin-Sulbactam": { pearls: "Combination penicillin/beta-lactamase inhibitor (2:1 ratio ampicillin:sulbactam). Active against many beta-lactamase-producing organisms including MSSA, Enterococcus, and Acinetobacter (sulbactam-specific intrinsic activity). NOT reliable for MRSA or Pseudomonas. Preferred over ampicillin alone for polymicrobial and abdominal infections.", dosing: "Mild-moderate infections: 1.5–3 g IV q6h. Severe/Acinetobacter: 3 g IV q4h (high-dose). Renal adjustment required (CrCl <30 mL/min).", monitoring: "SCr/BUN, LFTs (cholestatic hepatitis with prolonged use), CBC, signs of C. diff. Observe for hypersensitivity/anaphylaxis — cross-reactivity with other penicillins and some cephalosporins." }
};

// ==========================================
// CLINICAL DECISION SUPPORT DATA
// ==========================================
interface CDSEntry {
  hazardous: Hazardous;
  extravasation: Extravasation;
  sequencing: Sequencing;
  emetogenic: Emetogenic;
  toxicities: Toxicities;
}

const CLINICAL_CDS: Record<string, CDSEntry> = {
  "Cisplatin": { hazardous: { niosh: "Group 1 (Antineoplastic)", cstd: "Required", disposal: "Bulk Chemo Waste" }, extravasation: { risk: "Irritant / Vesicant (at conc >0.5 mg/mL)", compress: "Cold Compress", antidote: "Sodium Thiosulfate (1/6 M solution)", management: "Aspirate, apply cold compress, inject Sodium Thiosulfate locally to neutralize." }, sequencing: { order: "Administer AFTER taxanes (Paclitaxel/Docetaxel) to prevent delayed taxane clearance and severe myelosuppression.", ySite: "Incompatible with Cefepime, Piperacillin/Tazobactam." }, emetogenic: { risk: "High (>90%)", premeds: "NK1 RA + 5-HT3 RA + Dexamethasone + Olanzapine. Extensive pre/post hydration with NS + K/Mg mandatory." }, toxicities: { limits: "Cumulative toxicity: Peripheral neuropathy, Ototoxicity.", adjustments: "Hold or reduce if CrCl < 50 mL/min. Renal toxicity is dose-limiting." } },
  "Doxorubicin": { hazardous: { niosh: "Group 1 (Antineoplastic)", cstd: "Required", disposal: "Bulk Chemo Waste" }, extravasation: { risk: "Potent Vesicant", compress: "Cold Compress", antidote: "Dexrazoxane (Totect) or Topical DMSO", management: "Aspirate, elevate, apply cold pack. Administer Dexrazoxane IV in contralateral arm within 6 hours." }, sequencing: { order: "Administer BEFORE cyclophosphamide or paclitaxel.", ySite: "Incompatible with Heparin, Fluorouracil, Dexamethasone." }, emetogenic: { risk: "High (if combined w/ Cyclophosphamide) / Moderate", premeds: "5-HT3 RA + Dexamethasone (+ NK1 RA if AC regimen)." }, toxicities: { limits: "Lifetime Cumulative Max: 450-550 mg/m2 (Cardiotoxicity risk ↑).", adjustments: "Dose reduce for elevated bilirubin. Baseline ECHO/MUGA required." } },
  "Paclitaxel": { hazardous: { niosh: "Group 1 (Antineoplastic)", cstd: "Required", disposal: "Bulk Chemo Waste" }, extravasation: { risk: "Vesicant", compress: "Cold/Ice Compress", antidote: "Hyaluronidase (Off-label/Mixed evidence)", management: "Stop infusion, aspirate, elevate, apply cold compress." }, sequencing: { order: "Administer BEFORE platinums to prevent delayed paclitaxel clearance.", ySite: "Incompatible with Amphotericin B, Chlorpromazine." }, emetogenic: { risk: "Low (10-30%)", premeds: "MANDATORY: Dexamethasone + Diphenhydramine + H2 Blocker (Famotidine) to prevent severe Cremophor EL hypersensitivity." }, toxicities: { limits: "Severe peripheral neuropathy, Alopecia.", adjustments: "Dose reduce for elevated AST/Bilirubin." } },
  "Vincristine": { hazardous: { niosh: "Group 1 (Antineoplastic)", cstd: "Required", disposal: "Trace/Bulk Chemo Waste" }, extravasation: { risk: "Potent Vesicant", compress: "WARM Compress (DO NOT USE COLD)", antidote: "Hyaluronidase", management: "Aspirate, apply WARM compress (improves absorption), inject Hyaluronidase locally around site." }, sequencing: { order: "FATAL IF GIVEN INTRATHECALLY. For IV use only. Dispense in minibag to prevent wrong-route errors.", ySite: "Incompatible with Furosemide, Idarubicin." }, emetogenic: { risk: "Minimal (<10%)", premeds: "None routinely required for emesis. Prophylactic bowel regimen recommended (severe constipation risk)." }, toxicities: { limits: "Strictly capped at 2 mg total dose per cycle to prevent irreversible neurotoxicity.", adjustments: "Reduce dose by 50% if Bilirubin 1.5-3.0 mg/dL." } },
  "Vancomycin": { hazardous: { niosh: "Not NIOSH", cstd: "Not required", disposal: "Standard Waste" }, extravasation: { risk: "Vesicant (at high conc > 5 mg/mL)", compress: "Warm or Cold pack", antidote: "Hyaluronidase (Off-label)", management: "Stop infusion, aspirate. If severe, consider hyaluronidase." }, sequencing: { order: "Infuse slowly (max 10-15 mg/min) to prevent Vancomycin Infusion Reaction (Red Man Syndrome).", ySite: "Incompatible with Piperacillin/Tazobactam, Cefepime." }, emetogenic: { risk: "Minimal", premeds: "None. Slow infusion rate is primary prevention for reactions." }, toxicities: { limits: "Nephrotoxicity, Ototoxicity.", adjustments: "Renal dose adjustments mandatory (AUC/MIC targeting)." } },
  "Immune Globulin Intravenous (IVIG)": { hazardous: { niosh: "Not NIOSH", cstd: "Not required", disposal: "Standard Waste" }, extravasation: { risk: "Non-vesicant", compress: "Standard", antidote: "None", management: "Stop infusion, elevate." }, sequencing: { order: "Start at slow rate (e.g., 0.01 mL/kg/min) and double every 15-30 mins per brand specific maximums.", ySite: "Incompatible with most other drugs (NS or D5W only depending on brand)." }, emetogenic: { risk: "Minimal", premeds: "Acetaminophen + Diphenhydramine (+/- Corticosteroid) often used to reduce headache/chills." }, toxicities: { limits: "Acute Renal Failure (sucrose-stabilized products), Aseptic Meningitis, Hemolysis.", adjustments: "Dose based on ideal/adjusted body weight often recommended. Reduce rate for patients at risk of fluid overload." } },
  "Ampicillin-Sulbactam": { hazardous: { niosh: "Not NIOSH", cstd: "Not required", disposal: "Standard Waste" }, extravasation: { risk: "Non-vesicant (irritant potential at high concentrations)", compress: "Warm Compress", antidote: "None", management: "Stop infusion, elevate limb. Dilute further if restarting." }, sequencing: { order: "No specific sequencing requirements. Can be administered peripherally. Avoid simultaneous infusion with aminoglycosides in same line (physicochemical incompatibility).", ySite: "Incompatible with aminoglycosides (Gentamicin, Tobramycin, Amikacin) — inactivation occurs. Compatible with most standard IV fluids (NS preferred over D5W for stability)." }, emetogenic: { risk: "Minimal (<10%)", premeds: "None required for emetogenesis. Pre-screening for penicillin allergy mandatory." }, toxicities: { limits: "Cholestatic hepatitis with prolonged use; diarrhea/C. diff risk.", adjustments: "Renal dose adjustment required: CrCl 15–29 mL/min → q12h; CrCl <15 mL/min → q24h." } }
};

// ==========================================
// DRUG FACTORY HELPERS
// ==========================================
type RawDrug = Omit<Drug, 'summary' | 'hazardous' | 'extravasation' | 'sequencing' | 'emetogenic' | 'toxicities'>;

const makeOral = (id: string, gen: string, brand: string, cls: string, sizes: string[], note = "Store at RT."): RawDrug => ({
  id, genericName: gen, brandName: brand, category: "Oncology", drugClass: cls, vialSizes: sizes,
  reconstitution: { diluent: "N/A (Oral)", volume: "N/A", concentration: "N/A" },
  dilution: { preferredDiluent: "N/A (Oral)", volumeRange: "N/A", finalConcentrationRange: "N/A" },
  infusion: { rate: "Oral", duration: "N/A", filterRequired: "N/A", lightProtection: "N/A", pvtFreeLinRequired: "N/A" },
  bud: { usp797Category: "N/A", roomTemp: "Until Exp", refrigerated: "N/A", frozen: "N/A", basisNote: note },
  storageIntact: "Room Temperature", highAlert: true, vesicant: false, sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(gen)}`
});

const makeSubQ = (id: string, gen: string, brand: string, cat: string, cls: string, sizes: string[], rtBud = "14 days", note = "Commercially manufactured."): RawDrug => ({
  id, genericName: gen, brandName: brand, category: cat, drugClass: cls, vialSizes: sizes,
  reconstitution: { diluent: "N/A (Ready to Use)", volume: "N/A", concentration: "Varies" },
  dilution: { preferredDiluent: "N/A (Administer undiluted)", volumeRange: "N/A", finalConcentrationRange: "Varies" },
  infusion: { rate: "Subcutaneous", duration: "Bolus", filterRequired: "N/A", lightProtection: "Yes", pvtFreeLinRequired: "N/A" },
  bud: { usp797Category: "N/A", roomTemp: rtBud, refrigerated: "Until Expiration", frozen: "Do not freeze", basisNote: note },
  storageIntact: "Refrigerated (2-8°C)", highAlert: false, vesicant: false, sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(gen)}`
});

const makeIV = (id: string, genericName: string, brandName: string, category: string, drugClass: string, vialSizes: string[], rDil: string, rVol: string, rConc: string, dDil: string, dVol: string, dConc: string, iRate: string, iDur: string, iFilt: string, iLight: string, iPvt: string, bCat: string, bRt: string, bRef: string, bFz: string, bNote: string, store: string, alert: boolean, vesicant: boolean): RawDrug => ({
  id, genericName, brandName, category, drugClass, vialSizes,
  reconstitution: { diluent: rDil, volume: rVol, concentration: rConc },
  dilution: { preferredDiluent: dDil, volumeRange: dVol, finalConcentrationRange: dConc },
  infusion: { rate: iRate, duration: iDur, filterRequired: iFilt, lightProtection: iLight, pvtFreeLinRequired: iPvt },
  bud: { usp797Category: bCat, roomTemp: bRt, refrigerated: bRef, frozen: bFz, basisNote: bNote },
  storageIntact: store, highAlert: alert, vesicant,
  sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(genericName)}`
});

// ==========================================
// RAW DRUG DATABASE
// ==========================================
const RAW_DRUG_DB: RawDrug[] = [
  // --- CHEMOTHERAPY (60) ---
  makeIV("c1", "Cisplatin", "Platinol", "Chemotherapy", "Platinum Agent", ["50 mg/50 mL", "100 mg/100 mL", "200 mg/200 mL"], "N/A (Liquid)", "N/A", "1 mg/mL", "0.9% NS (requires chloride)", "250-1000 mL", "0.05-2 mg/mL", "Max 1 mg/min", "1-2 hours", "No", "Yes", "No", "Category 2", "27 days", "Do Not Ref.", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c2", "Carboplatin", "Paraplatin", "Chemotherapy", "Platinum Agent", ["50 mg/5 mL", "150 mg/15 mL", "450 mg/45 mL", "600 mg/60 mL"], "N/A (Liquid)", "N/A", "10 mg/mL", "D5W or NS", "250-500 mL", "0.5-2 mg/mL", "Various", "15-60 mins", "No", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c3", "Oxaliplatin", "Eloxatin", "Chemotherapy", "Platinum Agent", ["50 mg/10 mL", "100 mg/20 mL"], "N/A (Liquid)", "N/A", "5 mg/mL", "D5W ONLY", "250-500 mL", "0.2-0.7 mg/mL", "Various", "2 hours", "No", "No", "No", "Category 2", "6 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c4", "Paclitaxel", "Taxol", "Chemotherapy", "Taxane", ["30 mg/5 mL", "100 mg/16.7 mL", "300 mg/50 mL"], "N/A (Liquid)", "N/A", "6 mg/mL", "0.9% NS or D5W", "250-1000 mL", "0.3-1.2 mg/mL", "Various", "3-24 hours", "Yes (0.22)", "No", "Yes (Non-DEHP)", "Category 2", "27 hours", "Do Not Ref.", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c5", "Docetaxel", "Taxotere", "Chemotherapy", "Taxane", ["20 mg/1 mL", "80 mg/4 mL", "160 mg/8 mL"], "N/A (Liquid)", "N/A", "20 mg/mL", "0.9% NS or D5W", "250 mL", "0.3-0.74 mg/mL", "Various", "1 hour", "No", "No", "Yes (Non-DEHP)", "Category 2", "4 hours", "4 hours", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c6", "Cabazitaxel", "Jevtana", "Chemotherapy", "Taxane", ["60 mg/1.5 mL"], "Provided", "4.5 mL", "10 mg/mL", "0.9% NS or D5W", "250 mL", "0.1-0.26 mg/mL", "Various", "1 hour", "Yes (0.22)", "No", "Yes (Non-DEHP)", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c7", "Doxorubicin", "Adriamycin", "Chemotherapy", "Anthracycline", ["10 mg", "50 mg", "200 mg"], "0.9% NS", "5 mL", "2 mg/mL", "0.9% NS or D5W", "50-250 mL", "0.1-2 mg/mL", "IV push", "Varies", "No", "Yes", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c8", "Doxorubicin Liposomal", "Doxil", "Chemotherapy", "Anthracycline", ["20 mg/10 mL", "50 mg/25 mL"], "N/A (Liquid)", "N/A", "2 mg/mL", "D5W ONLY", "250 mL", "0.04-1.2 mg/mL", "1 mg/min", "1 hour", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c9", "Epirubicin", "Ellence", "Chemotherapy", "Anthracycline", ["50 mg/25 mL", "200 mg/100 mL"], "N/A", "N/A", "2 mg/mL", "0.9% NS or D5W", "50-100 mL", "0.5-2 mg/mL", "IV push", "Varies", "No", "Yes", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c10", "Idarubicin", "Idamycin", "Chemotherapy", "Anthracycline", ["5 mg", "10 mg", "20 mg"], "0.9% NS", "5 mL", "1 mg/mL", "0.9% NS", "50 mL", "0.1-1 mg/mL", "IV push", "Varies", "No", "Yes", "No", "Category 2", "72 hours", "7 days", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c11", "Daunorubicin", "Cerubidine", "Chemotherapy", "Anthracycline", ["20 mg"], "SWFI", "4 mL", "5 mg/mL", "0.9% NS", "50-100 mL", "0.2-1 mg/mL", "IV push", "Varies", "No", "Yes", "No", "Category 2", "24 hours", "48 hours", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c12", "Cyclophosphamide", "Cytoxan", "Chemotherapy", "Alkylator", ["500 mg", "1 g", "2 g"], "0.9% NS", "25 mL", "20 mg/mL", "0.9% NS", "100-250 mL", "2-20 mg/mL", "Various", "30-60 mins", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c13", "Ifosfamide", "Ifex", "Chemotherapy", "Alkylator", ["1 g", "3 g"], "SWFI", "20 mL", "50 mg/mL", "0.9% NS or D5W", "250-1000 mL", "0.6-16 mg/mL", "Various", "1-4 hours", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c14", "Bendamustine", "Treanda", "Chemotherapy", "Alkylator", ["25 mg", "100 mg"], "SWFI", "5 mL", "5 mg/mL", "0.9% NS", "250 mL", "0.2-0.6 mg/mL", "Various", "10-30 mins", "No", "Yes", "No", "Category 1", "3 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c15", "Melphalan", "Alkeran", "Chemotherapy", "Alkylator", ["50 mg"], "Provided", "10 mL", "5 mg/mL", "0.9% NS", "100-250 mL", "0.1-0.45 mg/mL", "Various", "15-30 mins", "No", "No", "No", "Category 1", "1.5 hours", "Do not ref", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c16", "Carmustine", "BiCNU", "Chemotherapy", "Alkylator", ["100 mg"], "Alcohol+SWFI", "30 mL", "3.3 mg/mL", "0.9% NS or D5W", "500 mL", "0.2 mg/mL", "Various", "1-2 hours", "No", "Yes", "Yes", "Category 1", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeOral("c17", "Lomustine", "Gleostine", "Alkylator", ["10 mg", "40 mg", "100 mg"]),
  makeIV("c18", "Busulfan", "Busulfex", "Chemotherapy", "Alkylator", ["60 mg/10 mL"], "N/A", "N/A", "6 mg/mL", "0.9% NS or D5W", "Varies", "≥0.5 mg/mL", "Various", "2 hours", "No", "No", "No", "Category 1", "8 hours", "12 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c19", "Fluorouracil", "Adrucil", "Chemotherapy", "Antimetabolite", ["2.5 g/50 mL", "5 g/100 mL"], "N/A", "N/A", "50 mg/mL", "0.9% NS or D5W", "50-1000 mL", "0.5-50 mg/mL", "Various", "Bolus/Cont.", "No", "Yes", "No", "Category 2", "4 days", "Not Rec.", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c20", "Cytarabine", "Cytosar-U", "Chemotherapy", "Antimetabolite", ["100 mg", "500 mg", "1 g", "2 g"], "SWFI or NS", "Varies", "50-100 mg/mL", "0.9% NS or D5W", "50-1000 mL", "0.5-50 mg/mL", "Various", "Bolus/Cont.", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c21", "Gemcitabine", "Gemzar", "Chemotherapy", "Antimetabolite", ["200 mg", "1 g", "2 g"], "0.9% NS", "5 mL", "38 mg/mL", "0.9% NS", "100-250 mL", "0.1-38 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "24 hours", "Do not ref", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c22", "Methotrexate", "Trexall", "Chemotherapy", "Antimetabolite", ["50 mg", "1 g"], "D5W or NS", "Varies", "25 mg/mL", "0.9% NS or D5W", "50-1000 mL", "0.5-25 mg/mL", "Various", "Bolus/Cont.", "No", "Yes", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c23", "Pemetrexed", "Alimta", "Chemotherapy", "Antimetabolite", ["100 mg", "500 mg"], "0.9% NS ONLY", "20 mL", "25 mg/mL", "0.9% NS ONLY", "100 mL", "1-25 mg/mL", "Various", "10 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c24", "Fludarabine", "Fludara", "Chemotherapy", "Antimetabolite", ["50 mg"], "SWFI", "2 mL", "25 mg/mL", "0.9% NS or D5W", "100-125 mL", "0.4-1 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 1", "8 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c25", "Cladribine", "Leustatin", "Chemotherapy", "Antimetabolite", ["10 mg/10 mL"], "N/A", "N/A", "1 mg/mL", "0.9% NS ONLY", "100-500 mL", "0.02-0.1 mg/mL", "Various", "2-24 hours", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c26", "Clofarabine", "Clolar", "Chemotherapy", "Antimetabolite", ["20 mg/20 mL"], "N/A", "N/A", "1 mg/mL", "0.9% NS or D5W", "100-250 mL", "0.15-0.4 mg/mL", "Various", "2 hours", "Yes", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c27", "Nelarabine", "Arranon", "Chemotherapy", "Antimetabolite", ["250 mg/50 mL"], "N/A", "N/A", "5 mg/mL", "Undiluted", "N/A", "5 mg/mL", "Various", "1-2 hours", "No", "No", "No", "Category 2", "8 hours", "Do not ref", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c28", "Azacitidine", "Vidaza", "Chemotherapy", "Antimetabolite", ["100 mg"], "SWFI", "10 mL", "10 mg/mL", "0.9% NS or LR", "50-100 mL", "Varies", "Various", "10-40 mins", "No", "No", "No", "Category 1", "1 hour", "22 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c29", "Decitabine", "Dacogen", "Chemotherapy", "Antimetabolite", ["50 mg"], "SWFI", "10 mL", "5 mg/mL", "0.9% NS or D5W", "50-250 mL", "0.1-1 mg/mL", "Various", "1-3 hours", "No", "No", "No", "Category 1", "15 mins", "4 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c30", "Vincristine", "Oncovin", "Chemotherapy", "Vinca Alkaloid", ["1 mg/1 mL", "2 mg/2 mL"], "N/A", "N/A", "1 mg/mL", "0.9% NS or D5W", "25-50 mL", "0.01-1 mg/mL", "Various", "5-10 mins", "No", "Yes", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c31", "Vinblastine", "Velban", "Chemotherapy", "Vinca Alkaloid", ["10 mg"], "0.9% NS", "10 mL", "1 mg/mL", "0.9% NS", "50 mL", "Varies", "Various", "5-10 mins", "No", "Yes", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c32", "Vinorelbine", "Navelbine", "Chemotherapy", "Vinca Alkaloid", ["10 mg/1 mL", "50 mg/5 mL"], "N/A", "N/A", "10 mg/mL", "0.9% NS or D5W", "20-50 mL", "1.5-3 mg/mL", "Various", "6-10 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c33", "Irinotecan", "Camptosar", "Chemotherapy", "Topoisomerase Inhibitor", ["40 mg/2 mL", "100 mg/5 mL", "300 mg/15 mL"], "N/A", "N/A", "20 mg/mL", "D5W or 0.9% NS", "250-500 mL", "0.12-2.8 mg/mL", "Various", "90 mins", "No", "Yes", "No", "Category 2", "24 hours", "48 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c34", "Topotecan", "Hycamtin", "Chemotherapy", "Topoisomerase Inhibitor", ["4 mg"], "SWFI", "4 mL", "1 mg/mL", "0.9% NS or D5W", "50-250 mL", "10-50 mcg/mL", "Various", "30 mins", "No", "Yes", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c35", "Etoposide", "Toposar", "Chemotherapy", "Topoisomerase Inhibitor", ["100 mg/5 mL", "500 mg/25 mL"], "N/A", "N/A", "20 mg/mL", "0.9% NS or D5W", "250-1000 mL", "0.2-0.4 mg/mL", "Various", "30-60 mins", "No", "No", "Yes (Non-DEHP)", "Category 2", "96 hours", "Do not ref", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c36", "Teniposide", "Vumon", "Chemotherapy", "Topoisomerase Inhibitor", ["50 mg/5 mL"], "N/A", "N/A", "10 mg/mL", "0.9% NS or D5W", "250-500 mL", "0.1-0.4 mg/mL", "Various", "30-60 mins", "No", "No", "Yes (Non-DEHP)", "Category 1", "4-24 hours", "Do not ref", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c37", "Mitoxantrone", "Novantrone", "Chemotherapy", "Topoisomerase Inhibitor", ["20 mg/10 mL", "25 mg/12.5 mL"], "N/A", "N/A", "2 mg/mL", "0.9% NS or D5W", "50-100 mL", "0.2-0.5 mg/mL", "Various", "15-30 mins", "No", "No", "No", "Category 2", "4 days", "7 days", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c38", "Pembrolizumab", "Keytruda", "Chemotherapy", "Checkpoint Inhibitor", ["100 mg/4 mL"], "N/A", "N/A", "25 mg/mL", "0.9% NS or D5W", "50-100 mL", "1-10 mg/mL", "Various", "30 mins", "Yes", "No", "No", "Category 2", "6 hours", "96 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c39", "Nivolumab", "Opdivo", "Chemotherapy", "Checkpoint Inhibitor", ["40 mg/4 mL", "100 mg/10 mL", "240 mg/24 mL"], "N/A", "N/A", "10 mg/mL", "0.9% NS or D5W", "50-100 mL", "1-10 mg/mL", "Various", "30 mins", "Yes", "Yes", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c40", "Cemiplimab", "Libtayo", "Chemotherapy", "Checkpoint Inhibitor", ["350 mg/7 mL"], "N/A", "N/A", "50 mg/mL", "0.9% NS or D5W", "50-100 mL", "1-20 mg/mL", "Various", "30 mins", "Yes", "No", "No", "Category 1", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c41", "Atezolizumab", "Tecentriq", "Chemotherapy", "Checkpoint Inhibitor", ["840 mg/14 mL", "1200 mg/20 mL"], "N/A", "N/A", "60 mg/mL", "0.9% NS ONLY", "250 mL", "3.2-16.8 mg/mL", "Various", "60 mins", "Yes", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c42", "Durvalumab", "Imfinzi", "Chemotherapy", "Checkpoint Inhibitor", ["120 mg/2.4 mL", "500 mg/10 mL"], "N/A", "N/A", "50 mg/mL", "0.9% NS or D5W", "50-250 mL", "1-15 mg/mL", "Various", "60 mins", "Yes", "No", "No", "Category 2", "4 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c43", "Avelumab", "Bavencio", "Chemotherapy", "Checkpoint Inhibitor", ["200 mg/10 mL"], "N/A", "N/A", "20 mg/mL", "0.9% NS or 0.45% NS", "250 mL", "0.8-10 mg/mL", "Various", "60 mins", "Yes", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c44", "Bleomycin", "Blenoxane", "Chemotherapy", "Miscellaneous", ["15 units", "30 units"], "0.9% NS", "5 mL", "3 units/mL", "0.9% NS", "50-100 mL", "Varies", "Various", "10-15 mins", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c45", "Mitomycin", "Mutamycin", "Chemotherapy", "Miscellaneous", ["5 mg", "20 mg", "40 mg"], "SWFI", "10 mL", "0.5 mg/mL", "0.9% NS", "50-100 mL", "Varies", "Various", "IV push", "No", "Yes", "No", "Category 2", "7 days", "14 days", "N/A", "USP <797>.", "Room Temp", true, true),
  makeIV("c46", "Dacarbazine", "DTIC", "Chemotherapy", "Miscellaneous", ["200 mg"], "SWFI", "19.7 mL", "10 mg/mL", "0.9% NS or D5W", "250 mL", "0.5-2 mg/mL", "Various", "30-60 mins", "No", "Yes", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c47", "Trabectedin", "Yondelis", "Chemotherapy", "Miscellaneous", ["1 mg"], "SWFI", "20 mL", "0.05 mg/mL", "0.9% NS", "500 mL", "Varies", "Various", "24 hours", "No", "No", "No", "Category 2", "30 hours", "30 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c48", "Eribulin", "Halaven", "Chemotherapy", "Miscellaneous", ["1 mg/2 mL"], "N/A", "N/A", "0.5 mg/mL", "0.9% NS ONLY", "100 mL", "Varies", "Various", "2-5 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c49", "Ixabepilone", "Ixempra", "Chemotherapy", "Miscellaneous", ["15 mg", "45 mg"], "Provided", "8 mL", "2 mg/mL", "LR ONLY", "250 mL", "0.2-0.6 mg/mL", "Various", "3 hours", "Yes", "No", "Yes", "Category 1", "6 hours", "Do not ref", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c50", "Romidepsin", "Istodax", "Chemotherapy", "Miscellaneous", ["10 mg"], "Provided", "2 mL", "5 mg/mL", "0.9% NS", "500 mL", "Varies", "Various", "4 hours", "No", "No", "No", "Category 2", "24 hours", "Do not ref", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c51", "Bortezomib", "Velcade", "Chemotherapy", "Proteasome Inhibitor", ["3.5 mg"], "0.9% NS", "3.5 mL", "1 mg/mL", "N/A", "N/A", "1 mg/mL", "IV push", "3-5 secs", "No", "Yes", "No", "Category 1", "8 hours", "N/A", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c52", "Carfilzomib", "Kyprolis", "Chemotherapy", "Proteasome Inhibitor", ["10 mg", "30 mg", "60 mg"], "SWFI", "5 mL", "2 mg/mL", "D5W", "50-100 mL", "0.05-1.5 mg/mL", "Various", "10-30 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c53", "Daunorubicin/Cytarabine", "Vyxeos", "Chemotherapy", "Liposome", ["44 mg/100 mg"], "SWFI", "19 mL", "2.2 mg/mL", "0.9% NS or D5W", "500 mL", "Varies", "Various", "90 mins", "No", "No", "No", "Category 2", "4 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c54", "Pegaspargase", "Oncaspar", "Chemotherapy", "Enzyme", ["3750 units/5 mL"], "N/A", "N/A", "750 u/mL", "0.9% NS or D5W", "100 mL", "Varies", "Various", "1-2 hours", "No", "No", "No", "Category 2", "48 hours", "48 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c55", "Arsenic Trioxide", "Trisenox", "Chemotherapy", "Miscellaneous", ["10 mg/10 mL"], "N/A", "N/A", "1 mg/mL", "0.9% NS or D5W", "100-250 mL", "Varies", "Various", "1-2 hours", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c56", "Pralatrexate", "Folotyn", "Chemotherapy", "Antimetabolite", ["20 mg/1 mL"], "N/A", "N/A", "20 mg/mL", "N/A", "N/A", "20 mg/mL", "IV push", "3-5 mins", "No", "No", "No", "Category 1", "72 hours", "72 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c57", "Thiotepa", "Tepadina", "Chemotherapy", "Alkylator", ["15 mg", "100 mg"], "SWFI", "1.5 mL", "10 mg/mL", "0.9% NS", "500-1000 mL", "0.5-5 mg/mL", "Various", "2 hours", "Yes", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, false),
  makeIV("c58", "Belinostat", "Beleodaq", "Chemotherapy", "HDAC Inhibitor", ["500 mg"], "SWFI", "9 mL", "50 mg/mL", "0.9% NS", "250 mL", "Varies", "Various", "30 mins", "No", "No", "No", "Category 1", "12 hours", "N/A", "N/A", "USP <797>.", "Room Temp", true, false),
  makeIV("c59", "Lurbinectedin", "Zepzelca", "Chemotherapy", "Alkylator", ["4 mg"], "SWFI", "8 mL", "0.5 mg/mL", "0.9% NS or D5W", "250 mL", "Varies", "Various", "60 mins", "No", "No", "Yes", "Category 1", "24 hours", "24 hours", "N/A", "USP <797>.", "Refrigerated", true, true),
  makeIV("c60", "Temozolomide", "Temodar IV", "Chemotherapy", "Alkylator", ["100 mg"], "SWFI", "41 mL", "2.5 mg/mL", "0.9% NS", "250 mL", "0.5-2 mg/mL", "Various", "90 mins", "No", "No", "No", "Category 1", "14 hours", "N/A", "N/A", "USP <797>.", "Refrigerated", true, false),

  // --- ORAL ONCOLOGY (20) ---
  makeOral("o1", "Capecitabine", "Xeloda", "Antimetabolite", ["150 mg", "500 mg"]),
  makeOral("o2", "Imatinib", "Gleevec", "TKI", ["100 mg", "400 mg"], "Protect from moisture."),
  makeOral("o3", "Erlotinib", "Tarceva", "EGFR Inhibitor", ["25 mg", "100 mg", "150 mg"]),
  makeOral("o4", "Sunitinib", "Sutent", "TKI", ["12.5 mg", "25 mg", "50 mg"]),
  makeOral("o5", "Sorafenib", "Nexavar", "Kinase Inhibitor", ["200 mg"]),
  makeOral("o6", "Pazopanib", "Votrient", "Kinase Inhibitor", ["200 mg"]),
  makeOral("o7", "Palbociclib", "Ibrance", "CDK4/6 Inhibitor", ["75 mg", "100 mg", "125 mg"]),
  makeOral("o8", "Ribociclib", "Kisqali", "CDK4/6 Inhibitor", ["200 mg"], "Protect from moisture."),
  makeOral("o9", "Abemaciclib", "Verzenio", "CDK4/6 Inhibitor", ["50 mg", "100 mg", "150 mg", "200 mg"]),
  makeOral("o10", "Olaparib", "Lynparza", "PARP Inhibitor", ["100 mg", "150 mg"], "Protect from moisture."),
  makeOral("o11", "Niraparib", "Zejula", "PARP Inhibitor", ["100 mg"]),
  makeOral("o12", "Rucaparib", "Rubraca", "PARP Inhibitor", ["200 mg", "250 mg", "300 mg"]),
  makeOral("o13", "Venetoclax", "Venclexta", "BCL-2 Inhibitor", ["10 mg", "50 mg", "100 mg"]),
  makeOral("o14", "Ibrutinib", "Imbruvica", "BTK Inhibitor", ["140 mg", "280 mg", "420 mg"], "Protect from moisture."),
  makeOral("o15", "Acalabrutinib", "Calquence", "BTK Inhibitor", ["100 mg"]),
  makeOral("o16", "Lenalidomide", "Revlimid", "Immunomodulator", ["2.5 mg", "5 mg", "10 mg", "15 mg", "25 mg"], "REMS restricted."),
  makeOral("o17", "Pomalidomide", "Pomalyst", "Immunomodulator", ["1 mg", "2 mg", "3 mg", "4 mg"], "REMS restricted."),
  makeOral("o18", "Thalidomide", "Thalomid", "Immunomodulator", ["50 mg", "100 mg", "150 mg", "200 mg"], "Protect from light."),
  makeOral("o19", "Enzalutamide", "Xtandi", "Antiandrogen", ["40 mg", "80 mg"]),
  makeOral("o20", "Abiraterone", "Zytiga", "CYP17 Inhibitor", ["250 mg", "500 mg"], "Take empty stomach."),

  // --- ANTIBIOTICS (31) ---
  makeIV("a1", "Vancomycin", "Vancocin", "Antibiotic", "Glycopeptide", ["500 mg", "1 g", "5 g"], "SWFI", "10 mL", "50 mg/mL", "0.9% NS or D5W", "100-250 mL", "5 mg/mL", "Max 10-15 mg/min", "60-120 mins", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>", "Room Temp", true, false),
  makeIV("a2", "Piperacillin/Tazobactam", "Zosyn", "Antibiotic", "Penicillin", ["2.25 g", "3.375 g", "4.5 g"], "0.9% NS", "10 mL", "200 mg/mL", "0.9% NS or D5W", "50-150 mL", "Varies", "Various", "30 mins - 4 hrs", "No", "No", "No", "Category 2", "24 hours", "48 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a3", "Cefepime", "Maxipime", "Antibiotic", "Cephalosporin", ["1 g", "2 g"], "SWFI", "10 mL", "100 mg/mL", "0.9% NS or D5W", "50-100 mL", "1-40 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "24 hours", "7 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a4", "Meropenem", "Merrem", "Antibiotic", "Carbapenem", ["500 mg", "1 g"], "SWFI", "10 mL", "50 mg/mL", "0.9% NS", "50-100 mL", "1-20 mg/mL", "Various", "15-30 mins - 3 hrs", "No", "No", "No", "Category 1", "4 hours (NS)", "24 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a5", "Levofloxacin", "Levaquin", "Antibiotic", "Fluoroquinolone", ["250 mg", "500 mg", "750 mg"], "N/A", "N/A", "5 mg/mL", "Premixed", "N/A", "5 mg/mL", "Various", "60-90 mins", "No", "No", "No", "Category 2", "72 hours", "14 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a6", "Fluconazole", "Diflucan", "Antibiotic", "Azole Antifungal", ["200 mg/100 mL", "400 mg/200 mL"], "N/A", "N/A", "2 mg/mL", "Premixed", "N/A", "2 mg/mL", "Max 200 mg/hr", "1-2 hours", "No", "No", "No", "Category 2", "Until Exp", "Do not freeze", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a7", "Dalbavancin", "Dalvance", "Antibiotic", "Lipoglycopeptide", ["500 mg"], "SWFI or D5W", "25 mL", "20 mg/mL", "D5W ONLY", "Varies", "1-5 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "48 hours", "14 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a8", "Ampicillin", "Principen", "Antibiotic", "Penicillin", ["500 mg", "1 g", "2 g"], "SWFI", "5 mL", "200 mg/mL", "0.9% NS", "50-100 mL", "10-30 mg/mL", "Various", "15-30 mins", "No", "No", "No", "Category 1", "8 hours", "48 hours", "N/A", "PI limit.", "Room Temp", false, false),
  makeIV("a9", "Nafcillin", "Nallpen", "Antibiotic", "Penicillin", ["1 g", "2 g"], "SWFI", "3.4 mL", "250 mg/mL", "0.9% NS or D5W", "50-100 mL", "2-40 mg/mL", "Various", "30-60 mins", "No", "No", "No", "Category 2", "24 hours", "7 days", "N/A", "USP <797>", "Room Temp", false, true),
  makeIV("a10", "Oxacillin", "Bactocill", "Antibiotic", "Penicillin", ["1 g", "2 g"], "SWFI", "5.7 mL", "167 mg/mL", "0.9% NS or D5W", "50-100 mL", "0.5-40 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "3 days", "7 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a11", "Cefazolin", "Ancef", "Antibiotic", "Cephalosporin", ["1 g", "10 g"], "SWFI", "2.5 mL", "330 mg/mL", "0.9% NS or D5W", "50-100 mL", "10-20 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a12", "Ceftriaxone", "Rocephin", "Antibiotic", "Cephalosporin", ["1 g", "2 g", "10 g"], "SWFI", "9.6 mL", "100 mg/mL", "0.9% NS or D5W", "50-100 mL", "10-40 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "4 days", "10 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a13", "Ciprofloxacin", "Cipro IV", "Antibiotic", "Fluoroquinolone", ["200 mg", "400 mg"], "N/A", "N/A", "2 mg/mL", "Premixed", "N/A", "2 mg/mL", "Various", "60 mins", "No", "No", "No", "Category 2", "14 days", "14 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a14", "Penicillin G", "Pfizerpen", "Antibiotic", "Penicillin", ["5 MU", "20 MU"], "SWFI", "18 mL", "250,000 u/mL", "0.9% NS or D5W", "50-100 mL", "Varies", "Various", "15-30 mins", "No", "No", "No", "Category 2", "24 hours", "7 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a15", "Ceftazidime", "Fortaz", "Antibiotic", "Cephalosporin", ["1 g", "2 g"], "SWFI", "10 mL", "100 mg/mL", "0.9% NS or D5W", "50-100 mL", "Varies", "Various", "30 mins", "No", "No", "No", "Category 2", "24 hours", "7 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a16", "Ceftaroline", "Teflaro", "Antibiotic", "Cephalosporin", ["400 mg", "600 mg"], "SWFI", "20 mL", "30 mg/mL", "0.9% NS or D5W", "50-250 mL", "Varies", "Various", "60 mins", "No", "No", "No", "Category 1", "6 hours", "24 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a17", "Ertapenem", "Invanz", "Antibiotic", "Carbapenem", ["1 g"], "SWFI or NS", "10 mL", "100 mg/mL", "0.9% NS ONLY", "50 mL", "20 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 1", "6 hours", "24 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a18", "Imipenem", "Primaxin", "Antibiotic", "Carbapenem", ["250 mg", "500 mg"], "0.9% NS", "10 mL", "Varies", "0.9% NS", "100 mL", "5 mg/mL", "Various", "20-60 mins", "No", "No", "No", "Category 1", "4 hours", "24 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a19", "Moxifloxacin", "Avelox", "Antibiotic", "Fluoroquinolone", ["400 mg/250 mL"], "N/A", "N/A", "1.6 mg/mL", "Premixed", "N/A", "1.6 mg/mL", "Various", "60 mins", "No", "No", "No", "Category 2", "24 hours", "Do not ref", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a20", "Daptomycin", "Cubicin", "Antibiotic", "Lipopeptide", ["500 mg"], "0.9% NS", "10 mL", "50 mg/mL", "0.9% NS ONLY", "50 mL", "Varies", "Various", "30 mins", "No", "No", "No", "Category 1", "12 hours", "48 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("a21", "Voriconazole", "Vfend", "Antibiotic", "Azole Antifungal", ["200 mg"], "SWFI", "19 mL", "10 mg/mL", "0.9% NS or D5W", "Varies", "0.5-5 mg/mL", "Max 3 mg/kg/hr", "1-2 hours", "No", "No", "No", "Category 1", "24 hours", "24 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a22", "Aztreonam", "Azactam", "Antibiotic", "Monobactam", ["1 g", "2 g"], "SWFI", "3 mL", "Varies", "0.9% NS or D5W", "50-100 mL", "≤20 mg/mL", "Various", "20-60 mins", "No", "No", "No", "Category 2", "48 hours", "7 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a23", "Cefoxitin", "Mefoxin", "Antibiotic", "Cephalosporin", ["1 g", "2 g"], "SWFI", "10 mL", "100 mg/mL", "0.9% NS or D5W", "50-100 mL", "10-40 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "24 hours", "7 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a24", "Linezolid", "Zyvox", "Antibiotic", "Oxazolidinone", ["600 mg"], "N/A", "N/A", "2 mg/mL", "Premixed", "N/A", "2 mg/mL", "Various", "30-120 mins", "No", "Yes", "No", "Category 2", "Until Exp", "Do not freeze", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a25", "Tigecycline", "Tygacil", "Antibiotic", "Glycylcycline", ["50 mg"], "0.9% NS or D5W", "5 mL", "10 mg/mL", "0.9% NS or D5W", "100 mL", "Varies", "Various", "30-60 mins", "No", "No", "No", "Category 1", "24 hours", "48 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a26", "Amikacin", "Amikin", "Antibiotic", "Aminoglycoside", ["500 mg", "1 g"], "N/A", "N/A", "250 mg/mL", "0.9% NS or D5W", "100-200 mL", "0.25-5 mg/mL", "Various", "30-60 mins", "No", "No", "No", "Category 2", "24 hours", "2 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a27", "Gentamicin", "Garamycin", "Antibiotic", "Aminoglycoside", ["80 mg"], "N/A", "N/A", "40 mg/mL", "0.9% NS or D5W", "50-100 mL", "0.1-1 mg/mL", "Various", "30-120 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a28", "Tobramycin", "Nebcin", "Antibiotic", "Aminoglycoside", ["40 mg/mL"], "N/A", "N/A", "40 mg/mL", "0.9% NS or D5W", "50-100 mL", "Varies", "Various", "30-60 mins", "No", "No", "No", "Category 2", "24 hours", "96 hours", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a29", "Clindamycin", "Cleocin", "Antibiotic", "Lincosamide", ["300 mg", "600 mg"], "N/A", "N/A", "150 mg/mL", "0.9% NS or D5W", "50-100 mL", "≤18 mg/mL", "Max 30 mg/min", "10-60 mins", "No", "No", "No", "Category 2", "16 days", "32 days", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a30", "Metronidazole", "Flagyl", "Antibiotic", "Nitroimidazole", ["500 mg"], "N/A", "N/A", "5 mg/mL", "Premixed", "N/A", "5 mg/mL", "Various", "60 mins", "No", "Yes", "No", "Category 2", "Until Exp", "Do not ref", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a31", "Micafungin", "Mycamine", "Antibiotic", "Echinocandin", ["50 mg", "100 mg"], "0.9% NS", "5 mL", "10 mg/mL", "0.9% NS", "100 mL", "0.5-1.5 mg/mL", "Various", "1 hour", "No", "Yes", "No", "Category 2", "24 hours", "N/A", "N/A", "USP <797>", "Room Temp", false, false),
  makeIV("a32", "Ampicillin-Sulbactam", "Unasyn", "Antibiotic", "Penicillin/Beta-Lactamase Inhibitor", ["1.5 g", "3 g", "15 g"], "SWFI", "6.4 mL", "375 mg/mL", "0.9% NS", "50-100 mL", "30-45 mg/mL", "Various", "15-30 mins", "No", "No", "No", "Category 1", "8 hours", "48 hours", "N/A", "NS preferred; D5W reduces stability to 2h at RT. Dose expressed as combined ampicillin + sulbactam (2:1 ratio).", "Room Temp", false, false),

  // --- BIOLOGICS (32) ---
  makeIV("b1", "Trastuzumab", "Herceptin", "Biologic", "Monoclonal Antibody", ["150 mg"], "BWFI", "7.4 mL", "21 mg/mL", "0.9% NS ONLY", "250 mL", "0.3-4 mg/mL", "Various", "90 mins initial", "Yes", "No", "No", "Category 2", "24 hours", "28 days", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b2", "Rituximab", "Rituxan", "Biologic", "Monoclonal Antibody", ["100 mg", "500 mg"], "N/A", "N/A", "10 mg/mL", "0.9% NS or D5W", "Varies", "1-4 mg/mL", "Titrated", "Several hours", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b3", "Bevacizumab", "Avastin", "Biologic", "Monoclonal Antibody", ["100 mg", "400 mg"], "N/A", "N/A", "25 mg/mL", "0.9% NS ONLY", "100 mL", "1.4-16.5 mg/mL", "Various", "90 mins initial", "No", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b4", "Cetuximab", "Erbitux", "Biologic", "Monoclonal Antibody", ["100 mg", "200 mg"], "N/A", "N/A", "2 mg/mL", "N/A", "N/A", "2 mg/mL", "Max 10 mg/min", "120 mins initial", "Yes", "No", "No", "Category 2", "8 hours", "12 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b5", "Panitumumab", "Vectibix", "Biologic", "Monoclonal Antibody", ["100 mg", "400 mg"], "N/A", "N/A", "20 mg/mL", "0.9% NS ONLY", "100 mL", "Varies", "Various", "60 mins", "Yes", "No", "No", "Category 2", "6 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b6", "Daratumumab", "Darzalex", "Biologic", "Monoclonal Antibody", ["100 mg", "400 mg"], "N/A", "N/A", "20 mg/mL", "0.9% NS ONLY", "500-1000 mL", "Varies", "Titrated", "Several hours", "Yes", "No", "No", "Category 2", "15 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b7", "Isatuximab", "Sarclisa", "Biologic", "Monoclonal Antibody", ["100 mg", "500 mg"], "N/A", "N/A", "20 mg/mL", "0.9% NS or D5W", "250 mL", "1-2.4 mg/mL", "Titrated", "Several hours", "Yes", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b8", "Elotuzumab", "Empliciti", "Biologic", "Monoclonal Antibody", ["300 mg", "400 mg"], "SWFI", "13 mL", "25 mg/mL", "0.9% NS or D5W", "250 mL", "Varies", "Titrated", "1-2 hours", "Yes", "Yes", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b9", "Brentuximab", "Adcetris", "Biologic", "Antibody-Drug Conjugate", ["50 mg"], "SWFI", "10.5 mL", "5 mg/mL", "0.9% NS or D5W", "150 mL", "0.4-1.2 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b10", "Ado-trastuzumab", "Kadcyla", "Biologic", "Antibody-Drug Conjugate", ["100 mg", "160 mg"], "SWFI", "5 mL", "20 mg/mL", "0.9% NS or 0.45% NS", "250 mL", "Varies", "Various", "90 mins initial", "Yes", "No", "No", "Category 2", "4 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b11", "Enfortumab", "Padcev", "Biologic", "Antibody-Drug Conjugate", ["20 mg", "30 mg"], "SWFI", "2.3 mL", "10 mg/mL", "D5W, 0.9% NS, LR", "50 mL", "0.3-4 mg/mL", "Various", "30 mins", "No", "No", "No", "Category 1", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b12", "Polatuzumab", "Polivy", "Biologic", "Antibody-Drug Conjugate", ["30 mg", "140 mg"], "SWFI", "1.8 mL", "20 mg/mL", "0.9% NS or 0.45% NS", "50-100 mL", "0.72-3.6 mg/mL", "Various", "90 mins initial", "Yes", "No", "No", "Category 1", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b13", "Sacituzumab", "Trodelvy", "Biologic", "Antibody-Drug Conjugate", ["180 mg"], "0.9% NS", "20 mL", "10 mg/mL", "0.9% NS ONLY", "Varies", "1.1-3.4 mg/mL", "Various", "3 hours initial", "No", "Yes", "Yes", "Category 2", "4 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b14", "Olaratumab", "Lartruvo", "Biologic", "Monoclonal Antibody", ["500 mg"], "N/A", "N/A", "10 mg/mL", "0.9% NS", "250 mL", "Varies", "Various", "60 mins", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b15", "Ramucirumab", "Cyramza", "Biologic", "Monoclonal Antibody", ["100 mg", "500 mg"], "N/A", "N/A", "10 mg/mL", "0.9% NS ONLY", "250 mL", "Varies", "Various", "60 mins", "Yes", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b16", "Blinatumomab", "Blincyto", "Biologic", "Bispecific T-cell Engager", ["35 mcg"], "SWFI", "3 mL", "12.5 mcg/mL", "0.9% NS + Stabilizer", "250 mL", "Varies", "Various", "24-48 hours", "Yes", "No", "Yes", "Category 1", "96 hours", "8 days", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b17", "Infliximab", "Remicade", "Biologic", "Monoclonal Antibody", ["100 mg"], "SWFI", "10 mL", "10 mg/mL", "0.9% NS ONLY", "250 mL", "0.4-4 mg/mL", "Various", "2 hours", "Yes", "No", "No", "Category 1", "3 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b18", "Vedolizumab", "Entyvio", "Biologic", "Monoclonal Antibody", ["300 mg"], "SWFI", "4.8 mL", "60 mg/mL", "0.9% NS or LR", "250 mL", "Varies", "Various", "30 mins", "No", "No", "No", "Category 1", "12 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b19", "Natalizumab", "Tysabri", "Biologic", "Monoclonal Antibody", ["300 mg"], "N/A", "N/A", "20 mg/mL", "0.9% NS ONLY", "100 mL", "2.6 mg/mL", "Various", "1 hour", "No", "No", "No", "Category 2", "8 hours", "8 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b20", "Ocrelizumab", "Ocrevus", "Biologic", "Monoclonal Antibody", ["300 mg"], "N/A", "N/A", "30 mg/mL", "0.9% NS ONLY", "250 mL", "1.2 mg/mL", "Various", "2.5 hours", "Yes", "No", "No", "Category 2", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b21", "Eculizumab", "Soliris", "Biologic", "Monoclonal Antibody", ["300 mg"], "N/A", "N/A", "10 mg/mL", "0.9% NS or D5W", "Varies", "5 mg/mL", "Various", "35 mins", "No", "No", "No", "Category 1", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b22", "Ravulizumab", "Ultomiris", "Biologic", "Monoclonal Antibody", ["300 mg", "1100 mg"], "N/A", "N/A", "10 mg/mL", "0.9% NS", "Varies", "5 mg/mL", "Various", "Varies", "Yes", "No", "No", "Category 1", "4 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b23", "Alemtuzumab", "Lemtrada", "Biologic", "Monoclonal Antibody", ["12 mg"], "N/A", "N/A", "10 mg/mL", "0.9% NS or D5W", "100 mL", "Varies", "Various", "4 hours", "No", "Yes", "No", "Category 1", "8 hours", "8 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b24", "Obinutuzumab", "Gazyva", "Biologic", "Monoclonal Antibody", ["1000 mg"], "N/A", "N/A", "25 mg/mL", "0.9% NS ONLY", "250 mL", "0.4-4 mg/mL", "Titrated", "Several hours", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b25", "Tocilizumab", "Actemra", "Biologic", "Monoclonal Antibody", ["80 mg", "200 mg"], "N/A", "N/A", "20 mg/mL", "0.9% NS ONLY", "100 mL", "Varies", "Various", "1 hour", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", false, false),
  makeIV("b26", "Golimumab", "Simponi Aria", "Biologic", "Monoclonal Antibody", ["50 mg"], "N/A", "N/A", "12.5 mg/mL", "0.9% NS ONLY", "100 mL", "Varies", "Various", "30 mins", "Yes", "No", "No", "Category 1", "4 hours", "N/A", "N/A", "USP <797>", "Refrigerated", false, false),
  makeIV("b27", "Ustekinumab", "Stelara", "Biologic", "Monoclonal Antibody", ["130 mg"], "N/A", "N/A", "5 mg/mL", "0.9% NS", "250 mL", "Varies", "Various", "1 hour", "No", "No", "No", "Category 1", "7 hours", "N/A", "N/A", "USP <797>", "Refrigerated", false, false),
  makeIV("b28", "Belimumab", "Benlysta", "Biologic", "Monoclonal Antibody", ["120 mg", "400 mg"], "SWFI", "1.5 mL", "80 mg/mL", "0.9% NS ONLY", "250 mL", "Varies", "Various", "1 hour", "No", "Yes", "No", "Category 1", "8 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", false, false),
  makeIV("b29", "Pertuzumab", "Perjeta", "Biologic", "Monoclonal Antibody", ["420 mg"], "N/A", "N/A", "30 mg/mL", "0.9% NS ONLY", "250 mL", "1.6-3.2 mg/mL", "Various", "60 mins initial", "No", "No", "Yes", "Category 2", "24 hours", "24 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b30", "Gemtuzumab", "Mylotarg", "Biologic", "Antibody-Drug Conjugate", ["4.5 mg"], "SWFI", "5 mL", "1 mg/mL", "0.9% NS ONLY", "50-100 mL", "0.075-0.234 mg/mL", "Various", "2 hours", "Yes", "Yes", "No", "Category 1", "6 hours", "12 hours", "N/A", "USP <797>", "Refrigerated", true, false),
  makeIV("b31", "Immune Globulin IV", "Gammagard", "Biologic", "Blood Product", ["5g", "10g"], "N/A", "N/A", "10%", "D5W or NS", "N/A", "Varies", "Titrated", "Several hours", "Varies", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "Single use.", "Varies", true, false),
  makeIV("b32", "Alpha-1-Proteinase Inhibitor", "Prolastin-C", "Biologic", "Alpha-1-Proteinase Inhibitor", ["1000 mg"], "SWFI", "20 mL", "50 mg/mL", "N/A", "Varies", "Varies", "Max 0.08 mL/kg/min", "15-30 mins", "Yes", "No", "No", "Category 1", "3 hours", "Do not ref", "N/A", "Admin within 3h.", "Room Temp", false, false),

  // --- SPECIALTY INJECTABLES / PFS (30) ---
  makeSubQ("s1", "Denosumab", "Prolia", "Biologic", "RANKL Inhibitor", ["60 mg"]),
  makeSubQ("s2", "Denosumab", "Xgeva", "Oncology", "RANKL Inhibitor", ["120 mg"]),
  makeSubQ("s3", "Omalizumab", "Xolair", "Biologic", "Anti-IgE Antibody", ["75 mg", "150 mg"], "48 hours"),
  makeSubQ("s4", "Dupilumab", "Dupixent", "Biologic", "IL-4/IL-13 Inhibitor", ["200 mg", "300 mg"]),
  makeSubQ("s5", "Benralizumab", "Fasenra", "Biologic", "IL-5 Antagonist", ["30 mg"]),
  makeSubQ("s6", "Mepolizumab", "Nucala", "Biologic", "IL-5 Antagonist", ["100 mg"], "7 days"),
  makeSubQ("s7", "Tezepelumab", "Tezspire", "Biologic", "TSLP Antagonist", ["210 mg"], "30 days"),
  makeSubQ("s8", "Guselkumab", "Tremfya", "Biologic", "IL-23 Antagonist", ["100 mg"], "Do not store at RT", "Discard if left out."),
  makeSubQ("s9", "Risankizumab", "Skyrizi", "Biologic", "IL-23 Antagonist", ["150 mg"], "24 hours"),
  makeSubQ("s10", "Secukinumab", "Cosentyx", "Biologic", "IL-17A Antagonist", ["150 mg"], "4 days"),
  makeSubQ("s11", "Ixekizumab", "Taltz", "Biologic", "IL-17A Antagonist", ["80 mg"], "5 days"),
  makeSubQ("s12", "Adalimumab", "Humira", "Biologic", "TNF Blocker", ["40 mg"]),
  makeSubQ("s13", "Etanercept", "Enbrel", "Biologic", "TNF Blocker", ["50 mg"]),
  makeSubQ("s14", "Certolizumab", "Cimzia", "Biologic", "TNF Blocker", ["200 mg"], "7 days"),
  makeSubQ("s15", "Sarilumab", "Kevzara", "Biologic", "IL-6 Antagonist", ["200 mg"]),
  makeSubQ("s16", "Golimumab", "Simponi", "Biologic", "TNF Blocker", ["50 mg"], "30 days"),
  makeSubQ("s17", "Erenumab", "Aimovig", "Biologic", "CGRP Antagonist", ["70 mg", "140 mg"], "7 days"),
  makeSubQ("s18", "Fremanezumab", "Ajovy", "Biologic", "CGRP Antagonist", ["225 mg"], "7 days"),
  makeSubQ("s19", "Galcanezumab", "Emgality", "Biologic", "CGRP Antagonist", ["120 mg"], "7 days"),
  makeSubQ("s20", "Evolocumab", "Repatha", "Biologic", "PCSK9 Inhibitor", ["140 mg"], "30 days"),
  makeSubQ("s21", "Alirocumab", "Praluent", "Biologic", "PCSK9 Inhibitor", ["75 mg", "150 mg"], "30 days"),
  makeSubQ("s22", "Inclisiran", "Leqvio", "Biologic", "PCSK9-directed siRNA", ["284 mg"], "30 days (if removed from refrigerator)", "Store refrigerated 2–8°C; may be kept at room temp (≤30°C) for up to 30 days once removed."),
  makeSubQ("s23", "Teriparatide", "Forteo", "Biologic", "PTH Analog", ["600 mcg"], "Do not store at RT", "Discard pen 28 days after first use."),
  makeSubQ("s24", "Abaloparatide", "Tymlos", "Biologic", "PTH Analog", ["3120 mcg"], "30 days (In-Use)"),
  makeSubQ("s25", "Romosozumab", "Evenity", "Biologic", "Sclerostin Inhibitor", ["105 mg"], "30 days"),
  makeSubQ("s26", "Abatacept", "Orencia", "Biologic", "T-cell Modulator", ["125 mg"], "8 hours"),
  makeSubQ("s27", "Pegfilgrastim", "Neulasta", "Oncology", "Colony Stimulating Factor", ["6 mg"], "48 hours"),
  makeSubQ("s28", "Filgrastim", "Neupogen", "Oncology", "Colony Stimulating Factor", ["300 mcg", "480 mcg"], "24 hours"),
  makeSubQ("s29", "Ofatumumab", "Kesimpta", "Biologic", "CD20-directed Antibody", ["20 mg"], "7 days"),
  makeSubQ("s30", "Bimekizumab", "Bimzelx", "Biologic", "IL-17A/F Antagonist", ["160 mg"], "24 hours"),

  // --- SUPPORTIVE CARE / IRON (5) ---
  makeIV("sc1", "Iron Sucrose", "Venofer", "Supportive Care", "Iron Replacement", ["100 mg", "200 mg"], "N/A", "N/A", "20 mg/mL", "0.9% NS", "100-250 mL", "1-2 mg/mL", "Various", "15-90 mins", "No", "No", "No", "Category 1", "7 days", "7 days", "N/A", "USP <797> limits.", "Room Temp", false, false),
  makeIV("sc2", "Ferric carboxymaltose", "Injectafer", "Supportive Care", "Iron Replacement", ["750 mg", "1000 mg"], "N/A", "N/A", "50 mg/mL", "0.9% NS", "250 mL", "2-50 mg/mL", "Max 50 mg/min", "15 mins", "No", "No", "No", "Category 1", "72 hours", "N/A", "N/A", "Do not ref.", "Room Temp", false, false),
  makeIV("sc3", "Iron Dextran", "INFeD", "Supportive Care", "Iron Replacement", ["100 mg"], "N/A", "N/A", "50 mg/mL", "0.9% NS", "250-1000 mL", "Varies", "Test dose", "1-6 hours", "No", "No", "No", "Category 2", "24 hours", "24 hours", "N/A", "USP <797> limits.", "Room Temp", true, false),
  makeIV("sc4", "Ferric derisomaltose", "Monoferric", "Supportive Care", "Iron Replacement", ["100 mg", "500 mg", "1000 mg"], "N/A", "N/A", "100 mg/mL", "0.9% NS", "100-500 mL", "≥ 1 mg/mL", "Varies", "20 mins", "No", "No", "No", "Category 1", "8 hours", "N/A", "N/A", "USP <797> limits.", "Room Temp", false, false),
  makeIV("sc5", "Ferumoxytol", "Feraheme", "Supportive Care", "Iron Replacement", ["510 mg"], "N/A", "N/A", "30 mg/mL", "0.9% NS or D5W", "50-250 mL", "2-8 mg/mL", "Varies", "15 mins", "No", "No", "No", "Category 1", "4 hours", "N/A", "N/A", "Admin immediately.", "Room Temp", true, false)
];

// ==========================================
// ENRICHED DRUG DATABASE
// ==========================================
export const DRUG_DB: Drug[] = RAW_DRUG_DB.map(drug => {
  const cds = CLINICAL_CDS[drug.genericName] || ({} as Partial<CDSEntry>);
  const isChemo = drug.category === "Oncology" || drug.category === "Chemotherapy";
  const isVesicant = drug.vesicant;
  const isOral = drug.infusion?.rate === "Oral";
  const isSubQ = drug.infusion?.rate?.toLowerCase().includes("subcut");
  const noIV = isOral || isSubQ;

  return {
    ...drug,
    summary: CLINICAL_SUMMARIES[drug.genericName] || {
      pearls: noIV ? "Review prescribing information for specific clinical pearls, administration technique, and handling precautions." : "Review prescribing information for specific clinical pearls and handling precautions.",
      dosing: "Varies by indication, protocol, and patient parameters.",
      monitoring: isOral ? "Monitor baseline labs (CBC, CMP) and medication adherence." : "Monitor vital signs, baseline labs (CBC, CMP), and for adverse reactions."
    },
    hazardous: cds.hazardous || {
      niosh: isChemo ? "Group 1 (Antineoplastic)" : (drug.category === "Biologic" && (drug.drugClass?.includes("Conjugate") || drug.drugClass?.includes("T-cell")) ? "Group 1 (Antineoplastic)" : "Not listed / NIOSH Exempt"),
      cstd: noIV ? "N/A (Non-IV Formulation)" : (isChemo ? "Required (per USP <800>)" : "Not routinely required"),
      disposal: isChemo ? "Trace or Bulk Chemo Waste" : "Standard Pharmaceutical/Biologic Waste"
    },
    extravasation: cds.extravasation || {
      risk: noIV ? "N/A (Non-IV Route)" : (isVesicant ? "Vesicant" : "Irritant / Non-vesicant"),
      compress: noIV ? "N/A" : (isVesicant ? "Consult protocol (Cold default, except Vinca Alkaloids/Etoposide)" : "Standard warm/cold pack per comfort"),
      antidote: noIV ? "N/A" : (isVesicant ? "Check institutional extravasation kit" : "None required"),
      management: noIV ? "N/A" : (isVesicant ? "Stop infusion immediately, aspirate catheter, leave in place for potential antidote administration, elevate extremity." : "Stop infusion, assess IV site, elevate.")
    },
    sequencing: cds.sequencing || {
      order: isOral ? "Administer as directed (e.g., with or without food). Check for acid-reducing agent interactions." : (isSubQ ? "Rotate injection sites. Do not inject into tender, bruised, red, or scarred skin." : "Review protocol for specific sequence. General rule: administer vesicants first if IV push."),
      ySite: noIV ? "N/A (Non-IV formulation)" : "Consult Trissel's or Lexicomp for real-time Y-site compatibility before co-administration."
    },
    emetogenic: cds.emetogenic || {
      risk: noIV ? "Minimal to Low" : (isChemo ? "Varies by specific dose and regimen. Review ASCO/NCCN guidelines." : "Minimal to Low"),
      premeds: noIV ? "Not routinely required unless specified by protocol." : (isChemo ? "Review specific chemotherapy protocol. May require pre-hydration or anti-hypersensitivity meds." : "Not routinely required.")
    },
    toxicities: cds.toxicities || {
      limits: "Review PI for specific cumulative limits or black box warnings.",
      adjustments: "Assess renal (CrCl) and hepatic (Bilirubin/AST/ALT) function prior to each dose administration."
    }
  };
});
