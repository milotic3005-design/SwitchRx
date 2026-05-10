/**
 * Cross-tab event bus — lets one feature ask another to open with context,
 * without needing a global store. Implemented via window CustomEvents so any
 * component (regardless of where it is in the React tree) can publish or
 * subscribe.
 *
 * Two flows currently wired:
 *   InfusionConsult → DrugReference: a drug name in the streamed brief is
 *     rendered as a clickable chip. Click → emits `openDrug(drugId)` →
 *     page.tsx switches the tab AND DrugReference opens that drug's modal.
 *
 *   DrugReference → InfusionConsult: each modal has an "Ask Copilot about
 *     this drug" button. Click → emits `askCopilot(scenario)` →
 *     page.tsx switches the tab AND InfusionConsult prefills its scenario.
 */

export type OpenDrugDetail = {
  /** Either the SwitchRx Drug.id (e.g. "a32") or the lowercased generic
   *  name (e.g. "vancomycin"). The DrugReference resolver handles both. */
  drugKey: string;
};

export type AskCopilotDetail = {
  scenario: string;
  /** When true, auto-clicks "Generate Consult Brief" after prefill. */
  autoSubmit?: boolean;
};

const OPEN_DRUG = 'switchrx:open-drug-reference';
const ASK_COPILOT = 'switchrx:ask-copilot';

export function emitOpenDrug(detail: OpenDrugDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OpenDrugDetail>(OPEN_DRUG, { detail }));
}

export function emitAskCopilot(detail: AskCopilotDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<AskCopilotDetail>(ASK_COPILOT, { detail }));
}

export function onOpenDrug(handler: (detail: OpenDrugDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapper = (e: Event) => handler((e as CustomEvent<OpenDrugDetail>).detail);
  window.addEventListener(OPEN_DRUG, wrapper);
  return () => window.removeEventListener(OPEN_DRUG, wrapper);
}

export function onAskCopilot(handler: (detail: AskCopilotDetail) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapper = (e: Event) => handler((e as CustomEvent<AskCopilotDetail>).detail);
  window.addEventListener(ASK_COPILOT, wrapper);
  return () => window.removeEventListener(ASK_COPILOT, wrapper);
}
