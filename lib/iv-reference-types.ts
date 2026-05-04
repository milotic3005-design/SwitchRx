export interface Reconstitution {
  diluent: string;
  volume: string;
  concentration: string;
}

export interface Dilution {
  preferredDiluent: string;
  volumeRange: string;
  finalConcentrationRange: string;
}

export interface Infusion {
  rate: string;
  duration: string;
  filterRequired: string;
  lightProtection: string;
  pvtFreeLinRequired: string;
}

export interface BUD {
  usp797Category: string;
  roomTemp: string;
  refrigerated: string;
  frozen: string;
  basisNote: string;
}

export interface Hazardous {
  niosh: string;
  cstd: string;
  disposal: string;
}

export interface Extravasation {
  risk: string;
  compress: string;
  antidote: string;
  management: string;
}

export interface Sequencing {
  order: string;
  ySite: string;
}

export interface Emetogenic {
  risk: string;
  premeds: string;
}

export interface Toxicities {
  limits: string;
  adjustments: string;
}

export interface ClinicalSummary {
  pearls: string;
  dosing: string;
  monitoring: string;
}

export interface Drug {
  id: string;
  genericName: string;
  brandName: string;
  category: string;
  drugClass: string;
  vialSizes: string[];
  reconstitution: Reconstitution;
  dilution: Dilution;
  infusion: Infusion;
  bud: BUD;
  storageIntact: string;
  highAlert: boolean;
  vesicant: boolean;
  sourceUrl: string;
  summary: ClinicalSummary;
  hazardous: Hazardous;
  extravasation: Extravasation;
  sequencing: Sequencing;
  emetogenic: Emetogenic;
  toxicities: Toxicities;
}
