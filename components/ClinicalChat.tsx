"use client";
import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { CLINICAL_SYSTEM_PROMPT } from '@/lib/ai-prompts';
import { sanitizePHI } from '@/lib/sanitization';
import { Send, ShieldAlert, Bot, User, Loader2, Paperclip, X, FileText } from 'lucide-react';
import Markdown from 'react-markdown';

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

// Module-level cache to persist state across component unmounts/remounts
let cachedMessages: {role: 'user' | 'model', content: string, fileName?: string}[] = [];
let cachedInput = '';
let cachedAttachedFile: { name: string, type: string, base64: string } | null = null;
let cachedChatSession: any = null;

export function ClinicalChat() {
  const [messages, setMessages] = useState<{role: 'user' | 'model', content: string, fileName?: string}[]>(cachedMessages);
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
    if (!chatSessionRef.current) {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Gemini API key is missing.");
        return false;
      }
      
      try {
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-3-flash-preview',
          config: {
            systemInstruction: CLINICAL_SYSTEM_PROMPT,
            temperature: 0.1, // Low temperature for deterministic, factual responses
            tools: [{ googleSearch: {} }],
          }
        });
        cachedChatSession = chatSessionRef.current;
        return true;
      } catch (err) {
        console.error("Failed to initialize chat:", err);
        return false;
      }
    }
    return true;
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

    if (!initChat()) {
      setMessages((prev) => [...prev, { role: 'model', content: 'Error: Unable to initialize AI chat. Please check API configuration.' }]);
      setIsLoading(false);
      return;
    }

    try {
      // 1. RAG Retrieval
      const context = await retrieveClinicalContext(sanitizedInput);
      
      // 2. Construct Prompt with Context
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
      
      // 3. Call Gemini API using chat session for multi-turn history
      const streamResponse = await chatSessionRef.current.sendMessageStream({ message: messageParts });
      
      let fullResponse = '';
      for await (const chunk of streamResponse) {
        if (chunk.text) {
          fullResponse += chunk.text;
          // Update the last message with the new chunk
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = fullResponse;
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
          <h2 className="text-[16px] font-medium text-blue-400">Clinical Chat (RAG-Enabled)</h2>
          <p className="text-[14px] text-blue-200/80 mt-1">
            This AI assistant uses retrieved clinical context when available, and general clinical knowledge otherwise. 
            <strong> PHI is automatically sanitized before processing.</strong> Try asking about &quot;Apixaban and Amiodarone interaction&quot; to see RAG in action.
          </p>
        </div>
      </div>

      <div className="flex-1 bg-[#121212] border border-white/10 rounded-xl shadow-sm overflow-hidden flex flex-col">
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
                  <div className="markdown-body prose prose-sm prose-invert max-w-none">
                    <Markdown>{msg.content}</Markdown>
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
        
        <div className="p-4 border-t border-white/10 bg-[#121212]">
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
