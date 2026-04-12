"use client";
import { useState } from 'react';
import { FileText, Loader2, Send, Network, ChevronDown, ChevronUp } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

export function InfusionConsult() {
  const [scenario, setScenario] = useState('');
  const [brief, setBrief] = useState('');
  const [thinking, setThinking] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!scenario.trim() || isLoading) return;

    setIsLoading(true);
    setError('');
    setBrief('');
    setThinking('');
    setIsThinkingExpanded(false); // keep minimized by default

    try {
      const response = await fetch('/api/infusion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenario }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate consult brief');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let fullResponse = '';
      let fullThinking = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const part = JSON.parse(line);
            if (part.thought && part.text) {
              fullThinking += part.text;
              setThinking(fullThinking);
            } else if (part.text) {
              fullResponse += part.text;
              setBrief(fullResponse);
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
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
            Expert-level IV pharmacy AI for outpatient and home infusion. Generate structured consult briefs for biologics, antibiotics, and oncology agents instantly. Powered by high-level reasoning.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        {/* Input Section */}
        <div className="flex flex-col gap-4 bg-[#121212] border border-white/10 rounded-xl p-6 shadow-sm">
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
        <div className="flex flex-col bg-[#121212] border border-white/10 rounded-xl overflow-hidden shadow-sm min-h-[400px]">
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
              <div className="markdown-body prose prose-sm prose-invert max-w-none">
                <Markdown>{brief}</Markdown>
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
