// NIOSH List of Hazardous Drugs in Healthcare Settings (2024 — Pub 2025-103).
// Subset of the most common antineoplastic & non-antineoplastic HDs that
// trigger USP <800> handling requirements (C-PEC, negative pressure room,
// double gloving, gown, respiratory protection during compounding).
// Full list ~200+ entries; this is an opinionated infusion-pharmacy subset.

export const NIOSH_TABLE_1_ANTINEOPLASTIC: ReadonlySet<string> = new Set([
  // Anthracyclines & antitumor antibiotics
  'doxorubicin', 'epirubicin', 'daunorubicin', 'idarubicin',
  'mitomycin c', 'mitomycin', 'dactinomycin', 'bleomycin',
  // Alkylators
  'cyclophosphamide', 'ifosfamide', 'mechlorethamine', 'melphalan',
  'busulfan', 'chlorambucil', 'temozolomide', 'dacarbazine',
  'thiotepa', 'carmustine', 'lomustine',
  // Platinums
  'cisplatin', 'carboplatin', 'oxaliplatin',
  // Antimetabolites
  'methotrexate', 'fluorouracil', '5-fu', 'capecitabine', 'cytarabine',
  'gemcitabine', 'cladribine', 'fludarabine', 'pemetrexed',
  'pentostatin', 'azacitidine', 'decitabine',
  // Topoisomerase inhibitors
  'irinotecan', 'topotecan', 'etoposide', 'teniposide',
  // Vinca alkaloids & taxanes
  'vincristine', 'vinblastine', 'vinorelbine',
  'paclitaxel', 'docetaxel', 'cabazitaxel',
  // Targeted therapies (small molecule HDs)
  'imatinib', 'dasatinib', 'nilotinib', 'sunitinib', 'sorafenib',
  'erlotinib', 'gefitinib', 'lapatinib', 'pazopanib',
  // Hormonal antineoplastics
  'tamoxifen', 'anastrozole', 'letrozole', 'exemestane',
  'leuprolide', 'goserelin', 'fulvestrant',
  // ADCs
  'brentuximab vedotin', 'ado-trastuzumab emtansine',
  'enfortumab vedotin', 'polatuzumab vedotin', 'sacituzumab govitecan',
  // Other
  'asparaginase', 'pegaspargase', 'bortezomib', 'carfilzomib',
  'arsenic trioxide', 'tretinoin', 'thalidomide', 'lenalidomide',
  'pomalidomide',
]);

export const NIOSH_TABLE_2_NON_ANTINEOPLASTIC: ReadonlySet<string> = new Set([
  'ribavirin', 'ganciclovir', 'valganciclovir',
  'mycophenolate', 'mycophenolate mofetil', 'cyclosporine',
  'sirolimus', 'tacrolimus', 'azathioprine',
  'colchicine', 'misoprostol', 'finasteride', 'dutasteride',
  'oxytocin', 'estradiol', 'estrogen', 'progesterone',
  'spironolactone',
]);

export const isNioshHazardous = (
  genericName: string
): { isHazardous: boolean; table?: 1 | 2 } => {
  const n = genericName.trim().toLowerCase();
  if (NIOSH_TABLE_1_ANTINEOPLASTIC.has(n)) return { isHazardous: true, table: 1 };
  if (NIOSH_TABLE_2_NON_ANTINEOPLASTIC.has(n)) return { isHazardous: true, table: 2 };
  for (const d of NIOSH_TABLE_1_ANTINEOPLASTIC) if (n.includes(d)) return { isHazardous: true, table: 1 };
  for (const d of NIOSH_TABLE_2_NON_ANTINEOPLASTIC) if (n.includes(d)) return { isHazardous: true, table: 2 };
  return { isHazardous: false };
};
