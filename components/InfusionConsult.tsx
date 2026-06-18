"use client";
import { useState, useEffect, useMemo } from 'react';
import { makeClient, streamClaude, getApiKey } from '@/lib/claude';
import { FileText, Loader2, Send, Network, ChevronDown, ChevronUp, ExternalLink, Link as LinkIcon, FlaskConical } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { INFUSION_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import { runPharmacyLookup, formatLookupForPrompt } from '@/lib/pharmacy-lookup';
import type { LookupResult } from '@/lib/pharmacy-lookup/types';
import { PharmacyLookupPanel } from './PharmacyLookupPanel';
import { WaitGame } from './WaitGame';
import { DRUG_DB } from '@/data/drug-database';
import { emitOpenDrug } from '@/lib/cross-tab-events';

type GroundingSource = { uri: string; title: string };

// Parse "1", "1, 2", "1-3", "1–3" inside a citation marker into a list of
// numbers so we can map each to its grounding source URL.
function parseCitationNumbers(content: string): number[] {
  const out: number[] = [];
  for (const part of content.split(',')) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = parseInt(range[2], 10);
      for (let i = start; i <= Math.min(end, start + 20); i++) out.push(i);
    } else {
      const n = parseInt(trimmed, 10);
      if (!isNaN(n)) out.push(n);
    }
  }
  return out;
}

// The model writes plain bracketed markers like [1], [2], [1, 3] inline.
// Convert each marker into a markdown link pointing at the corresponding
// grounded source URL (via the verified-sources list). Multi-citation markers
// like [1, 3] become two adjacent badges. Markers with no matching source
// (because grounding hasn't returned it yet) are left as-is.
function injectCitationLinks(text: string, sources: GroundingSource[]): string {
  if (!sources.length) return text;
  // Match [N], [N, M], [N-M], [N–M] but NOT already followed by ( (already a link)
  return text.replace(/\[(\d+(?:\s*[,\-–]\s*\d+)*)\](?!\()/g, (match, group) => {
    const nums = parseCitationNumbers(group);
    if (!nums.length) return match;
    const links = nums.map(n => {
      const src = sources[n - 1];
      if (!src) return `[${n}]`;
      // Markdown link with bracketed text: [\[N\]](url) so the rendered
      // text shows as "[N]" but is detected by our link component as a citation.
      return `[\\[${n}\\]](${src.uri})`;
    });
    return links.join('');
  });
}

// Render markdown links. Special-case detection: if the link's visible text
// matches the citation pattern "[N]", render as a small inline badge instead
// of a regular underlined link with external-icon — keeps the brief readable
// when there are many inline citations.
const markdownComponents = {
  a: ({ href, children, ...props }: any) => {
    const flat = (Array.isArray(children) ? children.join('') : String(children ?? '')).trim();
    const isCitation = /^\[\d+\]$/.test(flat);
    if (isCitation) {
      const num = flat.replace(/[\[\]]/g, '');
      return (
        <a
          {...props}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open verified source [${num}] in a new tab`}
          className="inline-flex items-center justify-center text-[10px] font-bold tabular-nums text-blue-300 bg-blue-500/15 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-400/60 rounded px-1.5 py-0.5 mx-0.5 align-super no-underline transition-colors leading-none"
        >
          {num}
        </a>
      );
    }
    // Drug Reference cross-link: links written as #drug:<key> resolve to a
    // chip-style affordance that switches tabs and opens the matching drug
    // monograph. Plain text links remain untouched.
    if (typeof href === 'string' && href.startsWith('#drug:')) {
      const drugKey = href.slice('#drug:'.length);
      return (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); emitOpenDrug({ drugKey }); }}
          title={`Open ${flat} in Drug Reference`}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 hover:border-emerald-400/60 rounded-md px-1.5 py-0.5 mx-0.5 no-underline transition-colors leading-none align-baseline"
        >
          <FlaskConical size={10} strokeWidth={2} className="shrink-0 opacity-80" />
          {children}
        </button>
      );
    }
    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-words inline-flex items-center gap-0.5"
      >
        {children}
        <ExternalLink size={11} strokeWidth={1.5} className="inline shrink-0 opacity-70" />
      </a>
    );
  },
};

/**
 * Build a regex (and reverse map) that detects any drug name from DRUG_DB
 * inside the brief text. Sorted by length DESC so "Piperacillin/Tazobactam"
 * matches before "Piperacillin" alone. Word-boundary anchored so we don't
 * grab substrings inside other words.
 */
type DrugMatcher = { regex: RegExp; lookup: Map<string, string> };
function buildDrugMatcher(): DrugMatcher {
  const entries: Array<{ pattern: string; key: string }> = [];
  for (const d of DRUG_DB) {
    const candidates = [d.genericName, d.brandName].filter(Boolean) as string[];
    for (const name of candidates) {
      // Skip very short names (≤3 chars) to avoid noise like "PD" matching prose
      if (name.length < 4) continue;
      entries.push({ pattern: name, key: d.genericName.toLowerCase() });
    }
  }
  entries.sort((a, b) => b.pattern.length - a.pattern.length);
  const lookup = new Map<string, string>();
  for (const e of entries) lookup.set(e.pattern.toLowerCase(), e.key);
  // Build alternation, escaping regex metacharacters; "/" needs no escape inside class.
  const escaped = entries.map(e => e.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // \b doesn't work next to "/", so use a custom boundary that allows "/" or "-"
  // Use lookbehind/lookahead for non-letter characters.
  const regex = new RegExp(`(?<![A-Za-z])(${escaped.join('|')})(?![A-Za-z])`, 'gi');
  return { regex, lookup };
}

/**
 * Replace drug names in markdown text with `[Name](#drug:<key>)` so the link
 * renderer turns them into clickable chips. Skips replacements inside fenced
 * code blocks, inline code, and existing markdown links to avoid breaking
 * citation links or formatted code.
 */
function injectDrugLinks(text: string, matcher: DrugMatcher): string {
  if (!text) return text;
  // Split out segments we should NOT touch (fenced code, inline code, links).
  const segments: Array<{ kind: 'safe' | 'skip'; content: string }> = [];
  const skipRegex = /(```[\s\S]*?```|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = skipRegex.exec(text)) !== null) {
    if (m.index > last) segments.push({ kind: 'safe', content: text.slice(last, m.index) });
    segments.push({ kind: 'skip', content: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ kind: 'safe', content: text.slice(last) });

  return segments
    .map(seg => {
      if (seg.kind === 'skip') return seg.content;
      // For each safe segment, replace each drug-name match ONCE per segment to
      // avoid pelting every occurrence of "vancomycin" with a chip — keeps the
      // brief readable. Track replaced keys per-segment.
      const seen = new Set<string>();
      return seg.content.replace(matcher.regex, (match) => {
        const key = matcher.lookup.get(match.toLowerCase());
        if (!key || seen.has(key)) return match;
        seen.add(key);
        return `[${match}](#drug:${key})`;
      });
    })
    .join('');
}

// ── Markdown repair (run before react-markdown) ────────────────────
// The model sometimes emits:
//   • Bare section LABELS ("Recommended Regimen", "Monitoring Parameters",
//     "Baseline & Ongoing Monitoring:") as plain lines instead of "###" headings
//     — so they render flush against the surrounding paragraphs with no break.
//   • Bold lead-in items ("**Induction:**", "**Maintenance:**", ...) on
//     consecutive lines without a blank line between them — markdown
//     collapses them into one paragraph joined by <br>, so the prose
//     paragraph margins (my-5) never get applied between them.
//
// Repair both before render so the brief reads with proper section rhythm.
function repairBriefMarkdown(raw: string): string {
  let out = raw;

  // 1) Promote bare Title-Case section labels (≤7 words, optionally with a
  //    trailing colon) to ### headings. Stays conservative: skips lines that
  //    already start with #, *, -, |, a digit, or look like a sentence (too
  //    many words / mid-line periods).
  out = out.replace(
    /^(?!#|\*|-|\||>|\d+\.)([A-Z][A-Za-z0-9 &/()\-]{1,60})(:?)\s*$/gm,
    (line, label: string) => {
      const trimmed = label.trim();
      const words = trimmed.split(/\s+/);
      if (words.length > 7) return line;          // too long for a label
      if (/[a-z][.!?]/.test(trimmed)) return line; // looks like a sentence
      // Must contain at least one Title-Cased multi-letter word beyond the
      // first to avoid promoting random short fragments.
      const titleish = words.filter(w => /^[A-Z][a-z]/.test(w)).length;
      if (titleish < 1) return line;
      return `### ${trimmed}`;
    },
  );

  // 2) Insert a blank line between two adjacent bold-lead paragraphs so each
  //    becomes its own <p>. Pattern: a line that starts with **...** followed
  //    by EXACTLY one newline followed by another line starting with **...**.
  //    Re-run until no more matches because each replacement only consumes one
  //    boundary at a time.
  const boldLeadJoin = /^(\*\*[^*\n]+\*\*[^\n]*)\n(\*\*[^*\n]+\*\*)/gm;
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(boldLeadJoin, '$1\n\n$2');
  }

  // 3) Ensure a blank line BEFORE any heading that isn't already preceded by one.
  out = out.replace(/([^\n])\n(#{1,6} )/g, '$1\n\n$2');

  return out;
}

function shortDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return uri;
  }
}

// Gemini grounding URIs are typically vertexaisearch.cloud.google.com redirect
// URLs that resolve to the actual source. The `web.title` from the API is the
// title of the *destination* page, so the link DOES point to that source —
// but the redirect domain is unhelpful to display. When we can infer the real
// publisher from the title (DailyMed, PubMed, FDA, etc.), prefer that label.
function inferPublisherFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes('dailymed')) return 'dailymed.nlm.nih.gov';
  if (t.includes('pubmed')) return 'pubmed.ncbi.nlm.nih.gov';
  if (t.includes('pmc') && t.includes('ncbi')) return 'ncbi.nlm.nih.gov/pmc';
  if (t.includes('accessdata.fda.gov') || t.includes('fda.gov')) return 'fda.gov';
  if (t.includes('nejm') || t.includes('new england journal')) return 'nejm.org';
  if (t.includes('jama')) return 'jamanetwork.com';
  if (t.includes('lancet')) return 'thelancet.com';
  if (t.includes('idsociety') || t.includes('idsa')) return 'idsociety.org';
  if (t.includes('ashp')) return 'ashp.org';
  if (t.includes('nccn')) return 'nccn.org';
  if (t.includes('uptodate')) return 'uptodate.com';
  if (t.includes('lexicomp')) return 'wolterskluwer.com';
  return null;
}

function displayDomain(src: { uri: string; title: string }): string {
  const fromTitle = inferPublisherFromTitle(src.title);
  if (fromTitle) return fromTitle;
  const host = shortDomain(src.uri);
  // Hide the noisy vertex AI redirect host — the title still carries the source
  if (host.includes('vertexaisearch') || host.includes('grounding-api-redirect')) {
    return 'via web search';
  }
  return host;
}

export function InfusionConsult({
  prefillScenario,
}: {
  prefillScenario?: { scenario: string; autoSubmit: boolean; token: number } | null;
} = {}) {
  const [scenario, setScenario] = useState('');
  const [brief, setBrief] = useState('');
  const [thinking, setThinking] = useState('');
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  // Build drug-name regex once per session — DRUG_DB is static at runtime.
  const drugMatcher = useMemo(() => buildDrugMatcher(), []);

  // Apply a pre-filled scenario coming from another tab (e.g. Drug Reference's
  // "Ask Copilot" button). Re-fires whenever the parent passes a new token.
  useEffect(() => {
    if (!prefillScenario?.scenario) return;
    setScenario(prefillScenario.scenario);
    // Optionally auto-submit. We hold off here so the user can review and
    // tweak before pressing Generate; flip if you want zero-click handoff.
  }, [prefillScenario?.token, prefillScenario?.scenario]);

  const handleGenerate = async () => {
    if (!scenario.trim() || isLoading) return;

    setIsLoading(true);
    setIsLookupLoading(true);
    setError('');
    setBrief('');
    setThinking('');
    setSources([]);
    setLookup(null);
    setIsThinkingExpanded(false); // keep minimized by default

    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error("Anthropic API key is missing. Please ensure NEXT_PUBLIC_ANTHROPIC_API_KEY is set in your environment.");
      }

      // Phase 1: Run the pharmacy lookup pipeline first (drug extraction +
      // openFDA label + shortage check + safety flags). This blocks the brief
      // by ~1–2s but gives the AI verified ground-truth context, surfaces
      // safety flags to the user immediately, and dramatically reduces
      // hallucinated dosing/stability claims.
      const lookupPromise = runPharmacyLookup(scenario, apiKey)
        .then(result => {
          setLookup(result);
          return result;
        })
        .catch(err => {
          // Lookup failure shouldn't kill the brief — log and continue with
          // the AI alone (degraded mode).
          console.error('Pharmacy lookup failed:', err);
          return null;
        })
        .finally(() => setIsLookupLoading(false));

      // Bound how long the brief will wait for the lookup. Each external call
      // already has its own 8s timeout, but this is a belt-and-suspenders guard
      // so the brief ALWAYS starts within ~12s even if the pipeline stalls. If
      // the lookup wins the race we use its data; if the timeout wins, the brief
      // proceeds on web search alone and the lookup panel still fills in via its
      // own setLookup when it eventually resolves.
      const lookupResult = await Promise.race([
        lookupPromise,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 12000)),
      ]);
      const lookupContext = lookupResult ? formatLookupForPrompt(lookupResult) : '';

      const client = makeClient();

      // Inject the lookup data into the system instruction so the brief
      // synthesizes against real FDA-label content rather than memory.
      const systemInstruction = lookupContext
        ? `${INFUSION_SYSTEM_PROMPT}\n\n---\n\n${lookupContext}`
        : INFUSION_SYSTEM_PROMPT;

      // Stream the brief with adaptive thinking + live web search so it cites
      // real FDA labels, PubMed articles, and society guidelines with
      // verifiable URLs (the [N] citation badges resolve to these sources).
      await streamClaude({
        client,
        system: systemInstruction,
        prompt: scenario,
        maxTokens: 8000,
        webSearch: true,
        cb: {
          onText: full => setBrief(full),
          onThinking: full => setThinking(full),
          onSources: srcs => setSources(srcs),
        },
      });
    } catch (err: any) {
      console.error("Error generating consult brief:", err);
      setError(err.message || "An error occurred while generating the consult brief.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
      <div className="flex items-start gap-4 bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
        <Network className="text-blue-400 shrink-0 mt-1" size={16} strokeWidth={1.5} />
        <div>
          <h2 className="text-[16px] font-medium text-blue-400">Rapid Infusion Consult Copilot</h2>
          <p className="text-[14px] text-blue-200/80 mt-1">
            Expert-level IV pharmacy AI for outpatient and home infusion. Every brief runs a <strong>verified-data lookup</strong> first — extracting drug names, querying <strong>openFDA labels &amp; shortages</strong>, and checking <strong>NIOSH / ISMP / vesicant</strong> registries — then anchors the AI synthesis to that verified data with clickable web-search citations.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        {/* Input Section */}
        <div className="flex flex-col gap-4 glass-panel p-6 shadow-sm">
          <h3 className="text-[15px] font-medium text-white flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            Clinical Scenario
          </h3>
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="e.g., 65yo M (85kg, SCr 1.2) with MRSA bacteremia requiring outpatient daptomycin. Needs dosing, monitoring, and administration instructions..."
            className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-xl p-4 text-[14px] text-slate-200 placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none resize-y transition-all"
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !scenario.trim()}
            className="w-full sm:w-auto self-end bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analyzing Scenario...
              </>
            ) : (
              <>
                <Send size={18} />
                Generate Consult Brief
              </>
            )}
          </button>
        </div>

        {/* Pharmacy Lookup panel — appears as soon as classification + lookup
            return, before the AI brief streams in. Renders nothing until a
            generation has been triggered. */}
        <PharmacyLookupPanel lookup={lookup} isLoading={isLookupLoading} />

        {/* Output Section */}
        <div className="flex flex-col glass-panel overflow-hidden shadow-sm min-h-[400px]">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h3 className="text-[15px] font-medium text-white">Consult Brief</h3>
            {isLoading && !brief && <span className="text-[12px] text-blue-400 animate-pulse flex items-center gap-1"><Network size={12}/> High Reasoning Active</span>}
          </div>
          
          {/* Thinking Section */}
          {(thinking || isLoading) && (
            <div className="border-b border-white/10 bg-black/20">
              <button 
                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                className="w-full flex items-center justify-between p-4 text-[13px] text-slate-400 hover:text-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Network size={14} className={isLoading && !brief ? "animate-pulse text-blue-400" : "text-blue-400"} />
                  <span className="font-medium">AI Reasoning Process</span>
                </div>
                {isThinkingExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              <AnimatePresence>
                {isThinkingExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-0 text-[13px] text-slate-500 font-mono whitespace-pre-wrap border-t border-white/5 bg-black/40 max-h-[300px] overflow-y-auto">
                      {thinking || "Initializing reasoning engine..."}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex-1 p-6 overflow-y-auto bg-[#0a0a0a]">
            {error ? (
              <div className="text-red-400 text-[14px]">{error}</div>
            ) : brief ? (
              <div className="flex flex-col">
                {/* Enhanced typography: bigger gaps between H2/H3 sections, looser
                    line-height, more breathing room between list items. Citation
                    badges are injected before render so [N] markers map to real
                    grounded URLs. */}
                <div className="consult-brief prose prose-sm prose-invert max-w-none
                                prose-headings:font-semibold prose-headings:text-white
                                prose-h2:text-[18px] prose-h2:mt-12 prose-h2:mb-5 prose-h2:pb-3 prose-h2:border-b prose-h2:border-white/10 first:prose-h2:mt-0
                                prose-h3:text-[15px] prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-blue-300 prose-h3:tracking-wide first:prose-h3:mt-2
                                prose-h4:text-[13px] prose-h4:mt-6 prose-h4:mb-2.5 prose-h4:text-slate-200 prose-h4:uppercase prose-h4:tracking-wider
                                prose-p:my-5 prose-p:leading-7 prose-p:text-slate-300
                                prose-ul:my-5 prose-ol:my-5 prose-li:my-2.5 prose-li:leading-relaxed prose-li:text-slate-300
                                prose-strong:font-semibold
                                prose-em:text-slate-200
                                prose-table:my-6 prose-table:text-[12px]
                                prose-th:bg-white/5 prose-th:text-slate-200 prose-th:font-semibold prose-th:px-3 prose-th:py-2
                                prose-td:px-3 prose-td:py-2 prose-td:border-white/10
                                prose-hr:my-8 prose-hr:border-white/10
                                prose-blockquote:border-l-blue-500/40 prose-blockquote:bg-blue-500/5 prose-blockquote:py-1 prose-blockquote:not-italic">
                  <Markdown components={markdownComponents}>
                    {/* Layer order matters:
                          1) repair markdown formatting (promote bare section
                             labels to ### headings, force blank lines between
                             bold-lead paragraphs so each gets its own <p>),
                          2) citation links consume [N] markers,
                          3) drug-name detection wraps Generic/Brand names in
                             `#drug:<key>` chips that switch tabs to Drug
                             Reference on click. */}
                    {injectDrugLinks(injectCitationLinks(repairBriefMarkdown(brief), sources), drugMatcher)}
                  </Markdown>
                </div>
                {sources.length > 0 && (
                  <div className="mt-8 pt-5 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                      <LinkIcon size={11} strokeWidth={1.5} />
                      <span className="font-medium">Verified Sources ({sources.length})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mb-3">
                      Click any <span className="inline-flex items-center justify-center text-[9px] font-bold tabular-nums text-blue-300 bg-blue-500/15 border border-blue-500/30 rounded px-1.5 py-0.5 mx-0.5 align-middle leading-none">N</span> badge in the brief above to open its grounded source — same URLs listed below, sourced live from Claude web search.
                    </p>
                    <ol className="space-y-2">
                      {sources.map((src, idx) => (
                        <li key={src.uri + idx} className="text-[12px] flex gap-2">
                          <span className="text-slate-500 shrink-0 tabular-nums">[{idx + 1}]</span>
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/40 hover:decoration-blue-300 break-all inline-flex items-start gap-1 leading-snug"
                            title={src.uri}
                          >
                            <span>{src.title}</span>
                            <span className="text-slate-500 text-[11px] whitespace-nowrap">
                              ({displayDomain(src)})
                            </span>
                            <ExternalLink size={10} strokeWidth={1.5} className="inline shrink-0 mt-0.5 opacity-70" />
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-5 py-4">
                <div className="flex items-center gap-2 text-[13px] text-blue-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Synthesizing your consult brief…</span>
                </div>
                <WaitGame active={isLoading && !brief} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[14px] text-slate-500 text-center px-8">
                Your structured consult brief will appear here after generating.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
