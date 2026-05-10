import { XMLParser } from 'fast-xml-parser';
import type { LabelSection } from '../types/evidence';

const LOINC_LABELS: Record<string, string> = {
  '34066-1': 'Boxed Warning',
  '34068-7': 'Dosage and Administration',
  '34070-3': 'Warnings and Precautions',
  '34073-7': 'Drug Interactions',
  '43678-2': 'How Supplied / Storage and Handling',
  '50742-1': 'Stability',
  '34076-0': 'Contraindications',
  '42229-5': 'Special Populations',
};

interface SplSection {
  code?: { '@_code'?: string };
  title?: string;
  text?: unknown;
}

const flattenText = (node: unknown): string => {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join(' ');
  if (typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).map(flattenText).join(' ');
  }
  return String(node);
};

const collectSections = (node: unknown, out: SplSection[]): void => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectSections(child, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.section) collectSections(obj.section, out);
  if (obj.code && (obj.code as Record<string, unknown>)['@_code']) {
    out.push(obj as SplSection);
  }
  for (const v of Object.values(obj)) {
    if (typeof v === 'object') collectSections(v, out);
  }
};

const summarize = (text: string, maxChars = 800): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > maxChars ? clean.slice(0, maxChars - 1) + '…' : clean;
};

export const parseSplSections = (
  xml: string,
  setid: string,
  loincCodes: readonly string[]
): LabelSection[] => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xml);

  const sections: SplSection[] = [];
  collectSections(doc, sections);

  const wanted = new Set(loincCodes);
  const result: LabelSection[] = [];

  for (const s of sections) {
    const code = s.code?.['@_code'];
    if (!code || !wanted.has(code)) continue;
    result.push({
      loinc_code: code,
      section_name: LOINC_LABELS[code] ?? s.title ?? code,
      content_summary: summarize(flattenText(s.text)),
      setid,
      source: 'dailymed',
    });
  }
  return result;
};
