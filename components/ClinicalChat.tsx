"use client";
import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CLINICAL_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import { sanitizePHI } from '@/lib/sanitization';
import { Send, ShieldAlert, Bot, User, Loader2, Paperclip, X, FileText, Sparkles, ExternalLink, Link as LinkIcon } from 'lucide-react';
import Markdown from 'react-markdown';
import { formatDomain } from '@/lib/utils';

// Render markdown links. Citation links (text matches "[N]" pattern) get
// rendered as small superscript badges so they don't disrupt prose flow;
// regular links keep the underline + external-icon treatment.
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

// Parse citation marker contents like "1", "1, 3", "1-3", "1–3" into number list.
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

// Convert plain "[N]" markers in the model's response into markdown links
// pointing at the corresponding grounded source URL. Multi-citation markers
// (e.g. "[1, 3]") expand into adjacent badges.
type GroundingSourceLite = { uri: string; title: string };
function injectCitationLinks(text: string, sources: GroundingSourceLite[]): string {
  if (!sources.length) return text;
  return text.replace(/\[(\d+(?:\s*[,\-–]\s*\d+)*)\](?!\()/g, (match, group) => {
    const nums = parseCitationNumbers(group);
    if (!nums.length) return match;
    return nums
      .map(n => {
        const src = sources[n - 1];
        if (!src) return `[${n}]`;
        return `[\\[${n}\\]](${src.uri})`;
      })
      .join('');
  });
}

// Gemini grounding URIs are vertexaisearch.cloud.google.com redirects that
// resolve to the actual cited source. The `web.title` is the destination
// page's title, so the link does point to the right document — but the
// redirect host isn't useful as a label. When the title hints at a well-
// known publisher (DailyMed, PubMed, FDA, etc.), prefer that label instead.
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
  const host = formatDomain(src.uri);
  if (host.includes('vertexaisearch') || host.includes('grounding-api-redirect')) {
    return 'via Google Search';
  }
  return host;
}

// Mock RAG Retrieval Database
const MOCK_CLINICAL_DB = {
  exactInteractions: [
    {
      keywords: ['apixaban', 'amiodarone'],
      context: `Source: Lexicomp Drug Interactions (2024)\nContext: Amiodarone is a moderate inhibitor of CYP3A4 and P-glycoprotein (P-gp). Apixaban is a substrate of both CYP3A4 and P-gp. Coadministration may increase apixaban exposure, increasing the risk of bleeding.\nRecommendation: According to the manufacturer, no dose adjustment of apixaban is required when coadministered with amiodarone, but clinical monitoring for bleeding is advised.`
    },
    {
      keywords: ['lisinopril', 'ibuprofen'],
      context: `Source: Clinical Pharmacology (2024)\nContext: NSAIDs like ibuprofen can reduce the antihypertensive effect of ACE inhibitors like lisinopril and increase the risk of renal impairment.\nRecommendation: Monitor blood pressure and renal function if coadministration cannot be avoided.`
    },
    {
      keywords: ['fluoxetine', 'tramadol'],
      context: `Source: FDA Drug Safety Communication\nContext: Coadministration of fluoxetine (a strong CYP2D6 inhibitor and SSRI) with tramadol increases the risk of serotonin syndrome and may reduce the analgesic efficacy of tramadol (which requires CYP2D6 activation).\nRecommendation: Avoid concurrent use if possible; monitor closely for serotonin toxicity.`
    }
  ],
  classInfo: [
    {
      keywords: ['doac', 'apixaban', 'rivaroxaban', 'dabigatran', 'anticoagulant'],
      context: `Source: AHA/ACC Guidelines\nContext: Direct Oral Anticoagulants (DOACs) are generally preferred over warfarin for non-valvular atrial fibrillation due to a lower risk of life-threatening bleeding and fewer drug interactions. However, they are substrates for P-gp and/or CYP3A4.`
    },
    {
      keywords: ['nsaid', 'ibuprofen', 'naproxen', 'celecoxib', 'meloxicam'],
      context: `Source: General Clinical Guidelines\nContext: Nonsteroidal anti-inflammatory drugs (NSAIDs) can cause GI bleeding, renal impairment, and fluid retention. They frequently interact with antihypertensives and anticoagulants.`
    },
    {
      keywords: ['ssri', 'fluoxetine', 'sertraline', 'citalopram', 'escitalopram'],
      context: `Source: Psychiatric Guidelines\nContext: Selective Serotonin Reuptake Inhibitors (SSRIs) carry a risk of serotonin syndrome when combined with other serotonergic agents. They can also increase bleeding risk, especially when combined with NSAIDs or anticoagulants.`
    }
  ]
};

// Mock RAG Retrieval
async function retrieveClinicalContext(query: string) {
  // In a real app, this would query a vector database (e.g., Pinecone, Weaviate) 
  // containing verified clinical monographs and guidelines.
  await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network
  
  const lowerQuery = query.toLowerCase();

  // 1. Prioritize exact matches for specific drug-drug interactions or conditions
  for (const interaction of MOCK_CLINICAL_DB.exactInteractions) {
    const isExactMatch = interaction.keywords.every(keyword => lowerQuery.includes(keyword));
    if (isExactMatch) {
      return interaction.context;
    }
  }

  // 2. Broaden search to related terms or drug classes if no exact match
  const matchedClasses = [];
  
  // Define broader class associations for nuanced searching
  const classAssociations: Record<string, string[]> = {
    'nsaid': ['nsaid', 'ibuprofen', 'naproxen', 'celecoxib', 'meloxicam', 'diclofenac', 'ketorolac'],
    'anticoagulant': ['anticoagulant', 'doac', 'apixaban', 'rivaroxaban', 'dabigatran', 'warfarin', 'heparin', 'enoxaparin'],
    'ssri': ['ssri', 'fluoxetine', 'sertraline', 'citalopram', 'escitalopram', 'paroxetine'],
    'ace inhibitor': ['ace inhibitor', 'lisinopril', 'enalapril', 'ramipril', 'benazepril']
  };

  // Check if query mentions any specific drugs that belong to a class, or the class itself
  const mentionedClasses = new Set<string>();
  
  for (const [className, drugs] of Object.entries(classAssociations)) {
    if (drugs.some(drug => lowerQuery.includes(drug))) {
      mentionedClasses.add(className);
    }
  }

  // If we identified classes, check for known interactions between those classes
  if (mentionedClasses.has('nsaid') && mentionedClasses.has('anticoagulant')) {
    matchedClasses.push(`Source: Clinical Guidelines (Class Interaction)\nContext: Concurrent use of NSAIDs and anticoagulants significantly increases the risk of major gastrointestinal bleeding. NSAIDs inhibit platelet aggregation and can cause gastric mucosal damage, compounding the bleeding risk from anticoagulation.\nRecommendation: Avoid concurrent use if possible. If necessary, use the lowest effective NSAID dose for the shortest duration, and consider adding a proton pump inhibitor (PPI) for GI protection.`);
  }
  
  if (mentionedClasses.has('nsaid') && mentionedClasses.has('ace inhibitor')) {
     matchedClasses.push(`Source: Clinical Guidelines (Class Interaction)\nContext: NSAIDs can reduce the antihypertensive effect of ACE inhibitors and increase the risk of acute kidney injury, especially in volume-depleted patients or the elderly.\nRecommendation: Monitor blood pressure and renal function closely. Consider alternative analgesics like acetaminophen if appropriate.`);
  }

  // Also pull in general class info for any mentioned classes
  for (const info of MOCK_CLINICAL_DB.classInfo) {
    // Check if the info block matches any of the broad classes we identified, or direct keywords
    const hasMatch = info.keywords.some(keyword => 
      lowerQuery.includes(keyword) || 
      Array.from(mentionedClasses).some(cls => classAssociations[cls]?.includes(keyword))
    );
    
    if (hasMatch) {
      // Avoid duplicating the class interaction text if we already added it
      if (!matchedClasses.some(m => m.includes(info.context.substring(0, 50)))) {
        matchedClasses.push(info.context);
      }
    }
  }

  if (matchedClasses.length > 0) {
    return matchedClasses.join('\n\n---\n\n');
  }
  
  return `No specific clinical context found in the verified database for this query.`;
}

// Module-level cache to persist state across component unmounts/remounts.
// Bump SESSION_VERSION whenever the chat config (model, system prompt, tools)
// changes so stale sessions are not reused.
const SESSION_VERSION = 2; // bumped: removed tools from chat config

type GroundingSource = { uri: string; title: string };
type ChatMessage = {
  role: 'user' | 'model',
  content: string,
  fileName?: string,
  isReformatting?: boolean,
  sources?: GroundingSource[],
};
let cachedMessages: ChatMessage[] = [];
let cachedInput = '';
let cachedAttachedFile: { name: string, type: string, base64: string } | null = null;
let cachedChatSession: any = null;
let cachedSessionVersion = 0;

export function ClinicalChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(cachedMessages);
  const [input, setInput] = useState(cachedInput);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string, type: string, base64: string } | null>(cachedAttachedFile);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(cachedChatSession);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update caches whenever state changes
  useEffect(() => { cachedMessages = messages; }, [messages]);
  useEffect(() => { cachedInput = input; }, [input]);
  useEffect(() => { cachedAttachedFile = attachedFile; }, [attachedFile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(',')[1];
      setAttachedFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64: base64String
      });
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
  };

  const initChat = () => {
    // Invalidate the cached session if the config version changed.
    if (cachedSessionVersion !== SESSION_VERSION) {
      cachedChatSession = null;
      chatSessionRef.current = null;
      cachedSessionVersion = SESSION_VERSION;
    }
    if (!chatSessionRef.current) {
      // Check for both NEXT_PUBLIC_GEMINI_API_KEY and GEMINI_API_KEY
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
      
      if (!apiKey) {
        console.error("Gemini API key is missing. Please ensure NEXT_PUBLIC_GEMINI_API_KEY is set in your secrets.");
        return "API_KEY_MISSING";
      }
      
      try {
        const ai = new GoogleGenAI({ apiKey });
        // Multi-turn chat sessions do NOT support the googleSearch grounding tool —
        // grounding is only available on single-turn generateContent calls.
        // Sources are fetched separately via a grounding sidecar call (see handleSend).
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-flash-latest',
          config: {
            systemInstruction: CLINICAL_SYSTEM_PROMPT,
            temperature: 0.1,
          }
        });
        cachedChatSession = chatSessionRef.current;
        return "SUCCESS";
      } catch (err: any) {
        console.error("Failed to initialize chat:", err);
        return err.message || "INITIALIZATION_ERROR";
      }
    }
    return "SUCCESS";
  };

  const handleReformat = async (index: number) => {
    const msgToReformat = messages[index];
    if (!msgToReformat || msgToReformat.role !== 'model' || msgToReformat.isReformatting) return;

    // Mark as reformatting
    setMessages(prev => {
      const newMsgs = [...prev];
      newMsgs[index] = { ...newMsgs[index], isReformatting: true };
      return newMsgs;
    });

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContentStream({
        model: 'gemini-flash-latest',
        contents: `Please reformat the following clinical text to provide a much better visual experience. Use structured Markdown: bolding for key terms, bullet points for lists, clear headers (###), and tables if appropriate. Make it highly readable for a clinician. Do not change the clinical meaning, only the formatting.\n\nText to reformat:\n${msgToReformat.content}`,
        config: {
          temperature: 0.1
        }
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[index] = { ...newMsgs[index], content: fullResponse };
            return newMsgs;
          });
        }
      }
    } catch (err) {
      console.error("Failed to reformat:", err);
    } finally {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[index] = { ...newMsgs[index], isReformatting: false };
        return newMsgs;
      });
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading) return;

    const sanitizedInput = sanitizePHI(input);
    const currentFile = attachedFile;
    
    setMessages((prev) => [...prev, { 
      role: 'user', 
      content: sanitizedInput,
      fileName: currentFile?.name 
    }]);
    
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    const initStatus = initChat();
    if (initStatus !== "SUCCESS") {
      const errorMsg = initStatus === "API_KEY_MISSING" 
        ? "Error: Gemini API key is missing. Please add it to your environment variables or AI Studio secrets."
        : `Error: Unable to initialize AI chat. Details: ${initStatus}`;
        
      setMessages((prev) => [...prev, { role: 'model', content: errorMsg }]);
      setIsLoading(false);
      return;
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY;

      // 1. RAG Retrieval
      const context = await retrieveClinicalContext(sanitizedInput);

      // 2. Grounding sidecar — runs a single-turn generateContent call with the
      //    Google Search tool enabled (the only supported surface for grounding).
      //    This is done in parallel with the chat response so latency is minimal.
      //    The grounded chunks give us real, verifiable URLs without breaking
      //    the multi-turn chat session (which doesn't support grounding tools).
      const groundingQuery = sanitizedInput || "clinical pharmacy infusion therapy";
      const groundingSidecar = apiKey
        ? new GoogleGenAI({ apiKey }).models.generateContent({
            model: 'gemini-flash-latest',
            contents: `Find the most authoritative clinical sources for this question: ${groundingQuery}`,
            config: {
              tools: [{ googleSearch: {} }],
              temperature: 0.0,
            },
          }).catch(() => null) // never block the main response
        : Promise.resolve(null);

      // 3. Construct main chat prompt with RAG context
      let promptWithContext = sanitizedInput || "Please analyze the attached document.";
      if (context !== 'No specific clinical context found in the verified database for this query.') {
        promptWithContext = `
Clinical Question: ${sanitizedInput}

Retrieved Clinical Context:
${context}

Please answer the question, incorporating the retrieved context.`;
      }

      // Construct message parts
      const messageParts: any[] = [{ text: promptWithContext }];
      if (currentFile) {
        messageParts.push({
          inlineData: {
            mimeType: currentFile.type,
            data: currentFile.base64
          }
        });
      }

      // Add a placeholder for the model's response
      setMessages((prev) => [...prev, { role: 'model', content: '' }]);

      // 4. Stream the multi-turn chat response
      const streamResponse = await chatSessionRef.current.sendMessageStream({ message: messageParts });

      let fullResponse = '';
      for await (const chunk of streamResponse) {
        if (chunk.text) {
          fullResponse += chunk.text;
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = fullResponse;
            return newMessages;
          });
        }
      }

      // 5. Await grounding sidecar and attach deduplicated sources to the
      //    message. Dedup by URI + normalized title so multiple grounding
      //    chunks pointing at the same source collapse into one entry. The
      //    URI resolves through Google's redirect to the real document the
      //    title describes — verified, not memorized.
      const groundingResult = await groundingSidecar;
      if (groundingResult) {
        const sourceMap = new Map<string, GroundingSource>();
        const chunks = groundingResult.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        for (const gc of chunks as any[]) {
          const web = gc.web ?? gc.retrievedContext;
          if (!web?.uri) continue;
          const title = (web.title || '').trim() || formatDomain(web.uri);
          const key = `${web.uri}::${title.toLowerCase()}`;
          if (!sourceMap.has(key)) {
            sourceMap.set(key, { uri: web.uri, title });
          }
        }
        if (sourceMap.size > 0) {
          const sources = Array.from(sourceMap.values());
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].sources = sources;
            return newMessages;
          });
        }
      }
    } catch (error) {
      console.error("Error calling Gemini:", error);
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].role === 'model' && !newMessages[newMessages.length - 1].content) {
            newMessages[newMessages.length - 1].content = 'Error: Unable to process request. Please check API configuration.';
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex items-start gap-4 bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
        <ShieldAlert className="text-blue-400 shrink-0 mt-1" size={16} strokeWidth={1.5} />
        <div>
          <h2 className="text-[16px] font-medium text-blue-400">Clinical Chat (RAG + Live Source Verification)</h2>
          <p className="text-[14px] text-blue-200/80 mt-1">
            Every response is grounded in <strong>FDA package inserts, primary literature, and professional guidelines</strong> retrieved live via Google Search. Clickable source links appear under each answer for verification. <strong>PHI is automatically sanitized before processing.</strong>
          </p>
        </div>
      </div>

      <div className="flex-1 glass-panel shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-[14px] text-slate-500">
              Ask a clinical question to begin.
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-white/10 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {msg.role === 'user' ? <User size={16} strokeWidth={1.5} /> : <Bot size={16} strokeWidth={1.5} />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 text-[14px] ${msg.role === 'user' ? 'bg-white text-black rounded-tr-none' : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'}`}>
                {msg.role === 'user' ? (
                  <div className="flex flex-col gap-2">
                    {msg.fileName && (
                      <div className="flex items-center gap-2 bg-black/10 p-2 rounded-lg text-[12px] border border-black/5">
                        <FileText size={14} strokeWidth={1.5} className="shrink-0" />
                        <span className="truncate">{msg.fileName}</span>
                      </div>
                    )}
                    {msg.content && <p>{msg.content}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {/* Citation badges + improved spacing for chat answers */}
                    <div className="prose prose-sm prose-invert max-w-none
                                    prose-headings:font-semibold prose-headings:text-white
                                    prose-h2:text-[17px] prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/10 first:prose-h2:mt-0
                                    prose-h3:text-[14px] prose-h3:mt-5 prose-h3:mb-2.5 prose-h3:text-blue-300 first:prose-h3:mt-0
                                    prose-h4:text-[12px] prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-slate-200 prose-h4:uppercase prose-h4:tracking-wider
                                    prose-p:my-2.5 prose-p:leading-7 prose-p:text-slate-300
                                    prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1.5 prose-li:leading-relaxed
                                    prose-strong:text-white
                                    prose-table:my-4 prose-table:text-[12px]
                                    prose-hr:my-5 prose-hr:border-white/10">
                      <Markdown components={markdownComponents}>
                        {injectCitationLinks(msg.content, msg.sources ?? [])}
                      </Markdown>
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                          <LinkIcon size={11} strokeWidth={1.5} />
                          <span className="font-medium">Verified Sources ({msg.sources.length})</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic mb-2">
                          Live Google Search grounding — each link resolves to the exact source named. Match the [N] markers above to the entries below.
                        </p>
                        <ol className="space-y-1.5">
                          {msg.sources.map((src, idx) => (
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
                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-end">
                      <button
                        onClick={() => handleReformat(i)}
                        disabled={msg.isReformatting}
                        className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50"
                      >
                        {msg.isReformatting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {msg.isReformatting ? "Reformatting..." : "Reformat for Readability"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Bot size={16} strokeWidth={1.5} />
              </div>
              <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-none p-4 flex items-center gap-2 text-[14px] text-slate-400">
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                Analyzing clinical context...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t border-white/10 bg-transparent">
          {attachedFile && (
            <div className="mb-3 flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-2 rounded-lg w-fit max-w-full">
              <FileText size={14} strokeWidth={1.5} className="shrink-0" />
              <span className="text-[12px] truncate font-medium">{attachedFile.name}</span>
              <button 
                onClick={removeFile}
                className="ml-2 p-1 hover:bg-blue-500/20 rounded-full transition-colors shrink-0"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="application/pdf,text/plain,image/*,.csv,.doc,.docx"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors border border-transparent hover:border-white/10"
              title="Attach File"
            >
              <Paperclip size={16} strokeWidth={1.5} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a clinical question or attach a file..."
              className="flex-1 px-4 py-3 border border-white/10 rounded-xl focus:ring-1 focus:ring-white/20 focus:border-white/20 outline-none bg-white/5 text-[14px] text-slate-200 placeholder:text-slate-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !attachedFile)}
              className="bg-white hover:bg-slate-200 disabled:opacity-50 disabled:hover:bg-white text-black px-5 py-3 rounded-xl transition-colors flex items-center justify-center"
            >
              <Send size={16} strokeWidth={1.5} />
            </button>
          </div>
          <p className="text-[12px] text-center text-slate-500 mt-2">
            AI-generated content. Verify with primary literature.
          </p>
        </div>
      </div>
    </div>
  );
}
