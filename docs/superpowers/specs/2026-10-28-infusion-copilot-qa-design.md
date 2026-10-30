# Infusion Copilot → conversational, cited Q&A

**Date:** 2026-10-28 · **Branch:** `copilot-qa` · **Status:** approved design, awaiting spec review

## Changes after implementation

These decisions came from live checks and user requests while the design was being built, and they win
where the sections below disagree: the Depth row in §2, the shortage check in §4 and §8, the Quick
addendum in §7 and the FDA-label titling in §4. R numbers are the rulings in the build ledger.

- **R10, no shortage check (user request).** openFDA's shortage feed is per product, so one discontinued vial
  marked a whole drug "DISCONTINUED". It is removed; the copy says "Verified FDA label check on every question".
- **R11, Clinical Chat removed (user request).** Its tab, buttons, component, prompt and identifier scrubber are
  gone. The IDSA advisor keeps its own follow-up chat.
- **R12, password screen (user's choice).** Checked in the browser, so the password ships in the bundle: a
  screen, not security. Unlock lasts until the tab closes; a Lock button locks again.
- **R13, both depths at HIGH thinking.** Quick at LOW skipped Google Search live, so the depths differ only by
  the length addendum. A finished answer with no sources shows an amber caution.
- **R14, lookup reuse.** A follow-up that names no drug reuses the thread's latest earlier lookup with drugs.
  FDA labels also match by application number or DailyMed set id.
- **R15, readable titles.** Pages are never fetched for titles; a domain-only title gets one from the URL path,
  e.g. "Inflectra › Dosage admin".
- **R16, follow-up voice.** Suggested follow-ups are questions the clinician would ask the Copilot, never
  questions back to the clinician.
- **R17, refines R14.** Reuse only when the follow-up names no drug at all; a named drug keeps its own lookup
  and safety flags, found or not.
- **R18, refines R15.** Literature sources (journals, PubMed, PMC, books) keep their domain title; publisher
  path words and DOIs are skipped.
- **R19.** The application-number match needs a label path (`/label/` or `…lbl.pdf`). A reused lookup is a
  reference to the earlier turn, shown as "Using drug info from earlier in this thread".
- **R20.** The Quick addendum says brevity applies only to the written answer, not to searching.
- **R21, search reminder.** "(Search Google before answering and base every number on what you find.)" goes
  on the new question only. Live, about 5 of 6 answers were grounded; both depths stay at HIGH.
- **R22, planned: one automatic retry.** A finished answer with text but no sources is re-run once in the
  background; the retry replaces it only if it has sources, and Stop keeps the first answer.

Fixes from the final review:

- The question box keeps one draft per place (home and each thread), so a question typed or handed over
  for one case is never sent as a follow-up in another thread.
- An FDA page is titled "… prescribing information" by drug name only when it is a label link (DailyMed,
  or a Drugs@FDA label path), not a shortage page or safety communication.
- The lookup section tells the model it is authoritative for what it covers and to still search before
  answering; it no longer says to search "ONLY for items not covered".
- A path segment with at least five digits and no more letters than digits counts as an ID, and
  europepmc.org is a journal host, so article links keep their domain title.

## 1. Goal

Rebuild the Infusion Copilot tab as a conversational clinical Q&A modeled on the
interaction design of OpenEvidence (openevidence.com), studied 2026-10-28 via its
public homepage, user guide, and two publicly shared answers. Clinicians ask any
infusion question, get an answer that leads with the bottom line and sizes itself
to the question, see exactly which source backs each sentence, and ask follow-ups
in the same thread.

We borrow layout and interaction patterns only. We do **not** copy OpenEvidence's
name, wordmark, the "EvidenceGrade™" mark, its physician-named model tiers, its
color palette, or its fonts. The Copilot keeps SwitchRx's own theme (dark + light).

## 2. Decisions (made with the user)

| Topic | Decision |
|---|---|
| Core model | Conversational Q&A, adaptive answer length, follow-ups in-thread. The verified pharmacy lookup still runs on every question. |
| References | Verified rich metadata: follow Gemini's redirect links server-side; PubMed/PMC details from NCBI; FDA labels from existing label data; else page title + site. |
| Evidence badge | Source-mix badge computed from cited sources (e.g. "FDA label · 2 guidelines · 1 trial"). No AI-assigned grade. |
| History | Saved threads in this browser (localStorage), per-thread delete + "Clear all history", visible "saved on this device" notice. |
| Depth | Two modes on the same model: Quick (thinking LOW, brief) and Thorough (thinking HIGH, default). |
| Architecture | Approach B: stream gains citation-support events; reference enrichment is a separate cached server step. |
| Live verification | Push `copilot-qa`, test real questions on a Vercel preview before merging to `main`. |

## 3. Non-goals

- Deep-consult tier (multi-minute research reports).
- AI-graded evidence strength.
- Answer feedback (thumbs up/down) — no backend to receive it.
- "Copy as image", OpenEvidence's highlighted "key source" card.
- Server-side or cross-device history; accounts.
- Changes to Clinical Chat, Guideline Summarizer, or the IDSA advisor beyond tolerating the new stream event.
- Mobile layout of the top navigation (pre-existing issue).

## 4. Data flow (one question)

1. **Pharmacy lookup** — existing `runPharmacyLookup(question)` (drug extraction,
   openFDA label, shortages, safety flags), raced against the existing 12 s cap.
   Its formatted context is appended to the system prompt for this turn only.
2. **Answer stream** — `streamAI` → `POST /api/ai/stream` with
   `messages` = last 6 completed turns of the thread (question + answer text with
   the follow-up block removed) + the new question, and `thinkingLevel`
   (`'low' | 'high'`, default `'high'`). Server emits existing `text` / `thinking`
   / `sources` events plus a new `supports` event (§6.1).
3. **Source resolution** — after the stream ends, client calls
   `POST /api/sources/resolve` with the turn's grounding sources (§6.2). Server
   resolves real URLs, classifies, fetches NCBI metadata, caches, returns
   enriched sources.
4. **Composition (client, pure functions)** — while the answer streams, prose
   renders without chips and the follow-up block stays hidden. Once the stream
   ends: citation chips placed from `supports` (labeled with the site name until
   enrichment returns, then upgraded to `shortName`); references = cited sources
   only, numbered by first citation; source-mix badge counted from them;
   follow-ups parsed from the answer's fenced block. FDA-label sources whose
   title or URL names a drug found by this turn's pharmacy lookup are titled
   "<Brand> (<generic>) prescribing information" from the lookup data.
5. **Persist** the completed turn to the thread in localStorage.

## 5. Units

Pure logic (Vitest-tested), in `lib/copilot/`:
- `citations.ts` — `placeCitations(answer, supports, sources)` → answer markdown
  with chip markers + ordered list of cited source indices.
- `label-titles.ts` — `titleFdaLabels(sources, lookup)` → FDA-label titles from
  the turn's pharmacy lookup data.
- `followups.ts` — `splitFollowUps(text)` → `{ body, followUps, pending }`;
  hides a partially streamed block.
- `source-types.ts` — `classifySource(meta)` → `SourceType`;
  `sourceMix(sources)` → badge data.
- `threads.ts` — `ThreadStore` over localStorage (versioned key
  `switchrx.copilot.threads.v1`, cap 50 threads, oldest dropped, tolerant of
  corrupt data and blocked storage).

Server, in `lib/source-metadata/` + route:
- `resolve-redirect.ts` — allowlisted redirect resolution (§9).
- `ncbi.ts` — batched PubMed `esummary`; PMC → PMID via the ID converter.
- `enrich.ts` — orchestrates resolve → classify → NCBI, with timeouts and an
  in-memory cache (24 h TTL, per server instance).
- `app/api/sources/resolve/route.ts`.

Server changes to existing files:
- `lib/ai-server.ts` — collect `groundingSupports`, emit `supports`; accept
  `thinkingLevel`.
- `app/api/ai/stream/route.ts` — pass `thinkingLevel` through.
- `lib/ai.ts` — `onSupports` callback; `thinkingLevel` option; new types.
- `lib/ai-prompts.ts` — replace `INFUSION_SYSTEM_PROMPT` (Copilot-only) with
  `INFUSION_QA_SYSTEM_PROMPT` + depth addenda.

UI, in `components/copilot/`: `CopilotHome`, `ThreadView`, `AnswerBlock`,
`CitationChip` (+ reference popover), `ReferenceList`, `SourceMixBadge`,
`StepTimeline`, `Composer` (with depth picker), `HistoryDrawer`,
`ExampleQuestions` (data in `lib/copilot/examples.ts`).
`components/InfusionConsult.tsx` becomes a thin container keeping its export
name and `prefillScenario` prop. Reused unchanged: pharmacy lookup pipeline,
`PharmacyLookupPanel` (inside the expanded timeline), drug-name chips that open
Drug Reference, `WaitGame`.

Fonts: add Source Serif 4 via `next/font` (`--font-serif`), used for answer
prose only.

Tooling: add `vitest` (devDependency) and an `npm test` script.

## 6. Interfaces

### 6.1 Stream event (additive)

```ts
// lib/ai-server.ts StreamEvent union gains:
{ type: 'supports'; supports: { text: string; sourceIndices: number[] }[] }
```
`text` is Gemini's `segment.text`; `sourceIndices` index into the turn's
`sources` list (same order as the `sources` event). Gemini's
`groundingChunkIndices` refer to the `groundingChunks` array of the same
`groundingMetadata` object, so the server translates each index through that
array (chunk → uri/title) and then through the de-duplicating source collector
to the emitted position. Emitted whenever new supports arrive; deduplicated by
`text`. Consumers that ignore unknown events
(all current ones) are unaffected.

`POST /api/ai/stream` body gains optional `thinkingLevel: 'low' | 'high'`
(maps to `ThinkingLevel.LOW` / `ThinkingLevel.HIGH`; default `HIGH`).

### 6.2 `POST /api/sources/resolve`

```ts
// request
{ sources: { uri: string; title: string }[] }        // ≤ 40 items
// response
{ sources: EnrichedSource[] }                        // same length and order
type SourceType = 'fda-label' | 'guideline' | 'systematic-review' | 'trial'
                | 'journal' | 'agency' | 'web';
interface EnrichedSource {
  uri: string;            // original grounding URI
  url: string | null;     // resolved destination, null if unresolved
  site: string;           // display host, e.g. "pubmed.ncbi.nlm.nih.gov"
  title: string;          // article/page title (NCBI title when available)
  shortName: string;      // chip label: journal abbrev ("N Engl J Med"),
                          // "FDA label", org ("IDSA"), or site
  journal?: string;       // full journal name
  year?: number;
  authors?: string;       // "Fowler VG Jr, Boucher HW, Corey GR, et al."
  pmid?: string;
  type: SourceType;
}
```
Typing rules (first match wins): FDA/DailyMed hosts → `fda-label`; NCBI
`pubtype` "Practice Guideline"/"Guideline" or a host on the society list in
`source-types.ts` (initially idsociety.org, ashp.org, nccn.org, ins1.org,
ons.org, asco.org, hematology.org, rheumatology.org) → `guideline`; pubtype
"Systematic Review"/"Meta-Analysis" → `systematic-review`; pubtype
"Randomized Controlled Trial"/"Clinical Trial*" → `trial`; any PubMed/PMC or
known journal host → `journal`; cdc.gov/nih.gov/who.int/cms.gov → `agency`;
else `web`. "Recent" tag = `year ≥ currentYear − 2`.

### 6.3 Thread storage

```ts
interface CopilotThread { id: string; title: string; createdAt: number;
  updatedAt: number; turns: CopilotTurn[] }
interface CopilotTurn { id: string; question: string; depth: 'quick'|'thorough';
  askedAt: number; answer: string; followUps: string[];
  supports: { text: string; sourceIndices: number[] }[];
  sources: EnrichedSource[]; lookup: LookupResult | null;
  status: 'done' | 'stopped' | 'error'; error?: string }
```
Only completed/stopped/errored turns are saved. Title = first question,
truncated to 80 chars.

## 7. AI instructions (`INFUSION_QA_SYSTEM_PROMPT`)

- Role: decision support for infusion clinicians (biologics, antimicrobials,
  oncology supportive care, OPAT/home infusion); not patient-directed advice;
  flag cases needing inpatient care.
- Research order: FDA label/DailyMed → guidelines (IDSA, ASHP, INS, NCCN, ONS)
  → primary literature → stability/compatibility references. Use the verified
  lookup data when present; state disagreements with search results.
- Shape: answer in the first 1–2 sentences; size to the question (quick fact →
  one short paragraph; complex → short `###` sections, no fixed template); bold
  doses, rates, concentrations, stability times, thresholds; tables for
  comparisons/schedules; "Important caveats" when relevant.
- No `[N]` markers, source lists, or URLs (the app attaches citations). If a
  specific number cannot be confirmed by search, say so in words.
- Thread context: reuse patient details from earlier turns; if critical data is
  missing (weight, CrCl), state the assumption and what is needed.
- End with exactly:
  ````
  ```followups
  - question one
  - question two
  - question three
  ```
  ````
- Depth addenda: Quick → "Be brief: 1–3 short paragraphs or a short list; skip
  background." Thorough → full treatment.

## 8. Screens

Single reading column (max ≈ 768 px). Theme colors; amber/rose reserved for
safety signals; serif for answer prose only.

**Home (empty thread):** centered "Infusion Copilot" title; large auto-growing
question box with depth picker ("Thorough ▾"; Quick/Thorough with one-line
descriptions) and send arrow; Enter sends, Shift+Enter newlines. Trust line:
"Verified FDA label & shortage check on every question" (no HIPAA claim).
Quiet note: "Saved on this device · avoid patient identifiers". Three shortcut
chips (Dose & renal adjustment, Preparation & stability, Infusion reactions) that
fill but don't send. "Explore example questions ▾": ~10 infusion categories ×
2–3 examples (dosing, stability/BUD, rates, premeds/reactions, monitoring/TDM,
compatibility & line access, OPAT, biologics, oncology supportive care,
shortages & alternatives); clicking fills the box. "History" button opens the
left drawer.

**Thread:** per turn — question echo (muted box); meta row (depth tag + time
left, source-mix badge right; badge click → sources grouped by type); critical
and warning safety flags from the lookup as a visible amber/rose strip; step
timeline collapsed to one line (Identified drugs → Checked FDA labels, shortages
& safety lists → Searched literature & guidelines → Done; live while running;
expands to show `PharmacyLookupPanel`); answer (serif, chips at sentence ends,
hover/tap → reference card popover with "See all references"; drug-name chips
→ Drug Reference); references (collapsible, numbered, title link opens new tab,
journal/site · year · authors, type tag + "Recent"); suggested follow-ups on the
latest turn only (click sends immediately); "Copy answer" (text + numbered
references); Stop while generating. Composer pinned to the bottom of the tab;
"New question" at top. During the pre-first-token pause in Thorough mode, a
"Play while you wait" link reveals `WaitGame` (no longer automatic).

Prefill from other tabs (Drug Reference, Mixing Guide "Ask Copilot") fills the
composer of a new thread without sending.

## 9. Errors and security

- Lookup fails/slow → proceed after 12 s; timeline step shows "FDA lookup
  unavailable" (amber).
- Stream error or Stop → keep partial text, mark "Stopped"/show error, offer Retry.
- Source resolution failure/timeout (4 s per link, 10 s overall) → fall back to
  grounding title + site; `type` from host only.
- No supports returned → no inline chips; references shown as "Sources
  searched" with a note that they couldn't be tied to specific sentences.
- Support text not found in the final answer → that chip is dropped (never
  misplaced); its sources still appear under references.
- localStorage blocked/full → in-memory thread with a "history can't be saved"
  notice; cap 50 threads.
- **SSRF guard:** `/api/sources/resolve` accepts only `https://` URIs whose host
  is `vertexaisearch.cloud.google.com`; reads the `Location` header with
  `redirect: 'manual'` and never fetches the destination page. Outbound calls are
  limited to that host and NCBI (`eutils.ncbi.nlm.nih.gov`,
  `pmc.ncbi.nlm.nih.gov`) with IDs parsed from resolved URLs. ≤ 40 URIs per
  request; NCBI requests carry `tool=switchrx`.

## 10. Testing and verification

- Vitest, test-first, for every `lib/copilot/*` unit and the server modules
  (redirect allowlist + timeout with mocked fetch; NCBI parsing against a saved
  real esummary response).
- Dev-only demo: a recorded realistic turn (answer, supports, enriched sources,
  lookup) replayed through the real UI with simulated streaming, enabled only
  when `NODE_ENV === 'development'`. Browser checks: home, examples, streaming,
  chips/popovers, references, badge, follow-up click, history
  save/reopen/delete/clear, Stop/Retry, dark + light, narrow width.
- One real NCBI call against a known PMID.
- Regression: typecheck, lint (no new errors), production build; other
  `streamAI` consumers compile and ignore the new event.
- Live end-to-end on a Vercel preview of `copilot-qa` before merging.

## 11. Risks

- Gemini may return few or no `groundingSupports` for some answers; handled by
  the "Sources searched" fallback, but citation density could be lower than
  OpenEvidence's.
- Grounding redirect links may expire; resolution runs immediately after each
  answer and saved threads store the resolved metadata.
- `segment.text` may not match the streamed text exactly (whitespace/markdown);
  matching normalizes whitespace, and unmatched supports are dropped rather than
  guessed.
