"use client";
import { useState } from 'react';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';

export function GuidelineSummarizer() {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSummarize = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setSummary(data.text || 'No summary generated.');
    } catch (error) {
      console.error("Error summarizing:", error);
      setSummary("Error generating summary. Please check API configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <FileText size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Guideline Summarizer</h2>
          <p className="text-slate-500">Paste lengthy clinical guidelines for rapid, structured summarization.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col h-[600px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">Original Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste clinical guideline text here..."
            className="flex-1 w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono text-sm"
          />
          <button
            onClick={handleSummarize}
            disabled={isLoading || !text.trim()}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
            {isLoading ? 'Summarizing...' : 'Generate Clinical Summary'}
          </button>
        </div>

        <div className="flex flex-col h-[600px]">
          <label className="block text-sm font-medium text-slate-700 mb-2">AI Summary</label>
          <div className="flex-1 w-full p-6 bg-slate-50 border border-slate-200 rounded-xl overflow-y-auto">
            {summary ? (
              <div className="markdown-body prose prose-sm max-w-none prose-indigo">
                <Markdown>{summary}</Markdown>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-center px-8">
                The structured summary will appear here, highlighting key recommendations, dosing, and contraindications.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
