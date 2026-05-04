"use client";
import { useState } from 'react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { FileText, Loader2, Send, Network, ChevronDown, ChevronUp, ExternalLink, Link as LinkIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { INFUSION_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import { runPharmacyLookup, formatLookupForPrompt } from '@/lib/pharmacy-lookup';
import type { LookupResult } from '@/lib/pharmacy-lookup/types';
import { PharmacyLookupPanel } from './PharmacyLookupPanel';

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
    return 'via Google Search';
  }
  return host;
}

export function InfusionConsult() {
  const [scenario, setScenario] = useState('');
  const [brief, setBrief] = useState('');
  const [thinking, setThinking] = useState('');
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

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
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please ensure NEXT_PUBLIC_GEMINI_API_KEY is set in your AI Studio secrets.");
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

      const lookupResult = await lookupPromise;
      const lookupContext = lookupResult ? formatLookupForPrompt(lookupResult) : '';

      const ai = new GoogleGenAI({ apiKey });

      // Inject the lookup data into the system instruction so the brief
      // synthesizes against real FDA-label content rather than memory.
      const systemInstruction = lookupContext
        ? `${INFUSION_SYSTEM_PROMPT}\n\n---\n\n${lookupContext}`
        : INFUSION_SYSTEM_PROMPT;

      const response = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: scenario,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          // Google Search grounding so the brief cites real FDA labels,
          // PubMed articles, and society guidelines with verifiable URLs.
          tools: [{ googleSearch: {} }],
        }
      });

      let fullResponse = '';
      let fullThinking = '';
      const sourceMap = new Map<string, GroundingSource>();
      let lastEmittedSourceCount = 0;

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
            if ((part as any).thought && part.text) {
              fullThinking += part.text;
              setThinking(fullThinking);
            } else if (part.text) {
              fullResponse += part.text;
              setBrief(fullResponse);
            }
          }
        }
        // Collect grounding chunks for verifiable, clickable sources. Dedupe
        // by both URI and title so multiple grounding chunks pointing at the
        // same source (common when the model cites one document several times)
        // collapse into a single entry. The URI is the source of truth — it
        // resolves through Google's redirect to the actual destination page,
        // matching whatever the title says.
        const grounding = chunk.candidates?.[0]?.groundingMetadata;
        const groundingChunks = grounding?.groundingChunks ?? [];
        for (const gc of groundingChunks) {
          const web = (gc as any).web ?? (gc as any).retrievedContext;
          if (!web?.uri) continue;
          const title = (web.title || '').trim() || shortDomain(web.uri);
          // Dedup key combines normalized URI and title to avoid both URL-only
          // and title-only collisions losing distinct citations.
          const key = `${web.uri}::${title.toLowerCase()}`;
          if (!sourceMap.has(key)) {
            sourceMap.set(key, { uri: web.uri, title });
          }
        }
        // Stream sources to React state as soon as new ones arrive so the
        // [N] citation badges in the brief become clickable mid-stream rather
        // than only after the entire response finishes.
        if (sourceMap.size > lastEmittedSourceCount) {
          setSources(Array.from(sourceMap.values()));
          lastEmittedSourceCount = sourceMap.size;
        }
      }

      // Final flush in case the very last chunk added new sources.
      if (sourceMap.size > lastEmittedSourceCount) {
        setSources(Array.from(sourceMap.values()));
      }
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
            Expert-level IV pharmacy AI for outpatient and home infusion. Every brief now runs the <strong>PharmOracle lookup pipeline</strong> first — extracting drug names, querying <strong>openFDA labels &amp; shortages</strong>, and checking <strong>NIOSH / ISMP / vesicant</strong> registries — then anchors the AI synthesis to that verified data with clickable Google Search citations.
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
                                prose-h2:text-[18px] prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/10 first:prose-h2:mt-0
                                prose-h3:text-[15px] prose-h3:mt-7 prose-h3:mb-3 prose-h3:text-blue-300 prose-h3:tracking-wide first:prose-h3:mt-0
                                prose-h4:text-[13px] prose-h4:mt-5 prose-h4:mb-2 prose-h4:text-slate-200 prose-h4:uppercase prose-h4:tracking-wider
                                prose-p:my-3 prose-p:leading-7 prose-p:text-slate-300
                                prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-li:leading-relaxed prose-li:text-slate-300
                                prose-strong:text-white prose-strong:font-semibold
                                prose-em:text-slate-200
                                prose-table:my-5 prose-table:text-[12px]
                                prose-th:bg-white/5 prose-th:text-slate-200 prose-th:font-semibold prose-th:px-3 prose-th:py-2
                                prose-td:px-3 prose-td:py-2 prose-td:border-white/10
                                prose-hr:my-6 prose-hr:border-white/10
                                prose-blockquote:border-l-blue-500/40 prose-blockquote:bg-blue-500/5 prose-blockquote:py-1 prose-blockquote:not-italic">
                  <Markdown components={markdownComponents}>
                    {injectCitationLinks(brief, sources)}
                  </Markdown>
                </div>
                {sources.length > 0 && (
                  <div className="mt-8 pt-5 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                      <LinkIcon size={11} strokeWidth={1.5} />
                      <span className="font-medium">Verified Sources ({sources.length})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic mb-3">
                      Click any <span className="inline-flex items-center justify-center text-[9px] font-bold tabular-nums text-blue-300 bg-blue-500/15 border border-blue-500/30 rounded px-1.5 py-0.5 mx-0.5 align-middle leading-none">N</span> badge in the brief above to open its grounded source — same URLs listed below, sourced live from Google Search grounding metadata.
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
