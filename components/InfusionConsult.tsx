"use client";
import { useState } from 'react';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { FileText, Loader2, Send, Network, ChevronDown, ChevronUp, ExternalLink, Link as LinkIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { INFUSION_SYSTEM_PROMPT } from '@/lib/ai-prompts';

type GroundingSource = { uri: string; title: string };

// Render markdown links as new-tab anchors with safe rel attributes so users
// can verify clinical citations without losing their consult brief.
const markdownComponents = {
  a: ({ href, children, ...props }: any) => (
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
  ),
};

function shortDomain(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return uri;
  }
}

export function InfusionConsult() {
  const [scenario, setScenario] = useState('');
  const [brief, setBrief] = useState('');
  const [thinking, setThinking] = useState('');
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!scenario.trim() || isLoading) return;

    setIsLoading(true);
    setError('');
    setBrief('');
    setThinking('');
    setSources([]);
    setIsThinkingExpanded(false); // keep minimized by default

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please ensure NEXT_PUBLIC_GEMINI_API_KEY is set in your AI Studio secrets.");
      }

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: scenario,
        config: {
          systemInstruction: INFUSION_SYSTEM_PROMPT,
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          // Google Search grounding so the brief cites real FDA labels,
          // PubMed articles, and society guidelines with verifiable URLs.
          tools: [{ googleSearch: {} }],
        }
      });

      let fullResponse = '';
      let fullThinking = '';
      const sourceMap = new Map<string, GroundingSource>();

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
        // Collect grounding chunks for verifiable, clickable sources.
        const grounding = chunk.candidates?.[0]?.groundingMetadata;
        const groundingChunks = grounding?.groundingChunks ?? [];
        for (const gc of groundingChunks) {
          const web = (gc as any).web ?? (gc as any).retrievedContext;
          if (web?.uri && !sourceMap.has(web.uri)) {
            sourceMap.set(web.uri, {
              uri: web.uri,
              title: web.title || web.uri,
            });
          }
        }
      }

      if (sourceMap.size > 0) {
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
            Expert-level IV pharmacy AI for outpatient and home infusion. Every brief is grounded in <strong>FDA package inserts, primary literature, and professional guidelines</strong> retrieved live via Google Search, with clickable source links for verification.
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
                <div className="markdown-body prose prose-sm prose-invert max-w-none">
                  <Markdown components={markdownComponents}>{brief}</Markdown>
                </div>
                {sources.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 mb-3">
                      <LinkIcon size={11} strokeWidth={1.5} />
                      <span className="font-medium">Retrieved Sources ({sources.length})</span>
                    </div>
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
                              ({shortDomain(src.uri)})
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
