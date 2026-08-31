import React, { useState } from 'react';
import apiClient from '../api/client';
import { Sparkles, Send, Loader2, BookOpen, ChevronRight, MessageSquare, Bot } from 'lucide-react';

export const ConceptExplainer = ({ courseId, initialTopic = '', initialQuestion = '' }) => {
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState(initialTopic || 'General Concept');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I am your AI Socratic Tutor. Need clarification on any concept, theorem, or quiz question? Ask me below!",
      references: []
    }
  ]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (customQuery = null, customTopic = null) => {
    const textToSend = customQuery || query;
    const activeTopic = customTopic || topic || 'General Concept';

    if (!textToSend.trim()) return;

    const userMessage = { role: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await apiClient.post(`/courses/${courseId}/explain`, {
        topic: activeTopic,
        student_query: textToSend,
        question_text: initialQuestion || null,
        remediate: true
      });

      const assistantMessage = {
        role: 'assistant',
        text: response.data?.explanation || 'Explanation generated.',
        references: response.data?.references || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Explanation error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, I was unable to generate an explanation right now. Please verify your connection or try another topic.',
          references: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (promptText) => {
    handleAsk(promptText);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[520px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-purple-50/50 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>Socratic AI Tutor</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            </h3>
            <p className="text-[11px] text-slate-500">Grounded in your course documents</p>
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-xs'
                  : 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/60'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Citations & Lecture Excerpts */}
              {msg.references && msg.references.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1.5">
                    <BookOpen className="w-3 h-3 text-indigo-600" />
                    <span>Lecture Sources (RAG Citations)</span>
                  </span>
                  <div className="space-y-1">
                    {msg.references.slice(0, 2).map((ref, rIdx) => (
                      <div
                        key={rIdx}
                        className="text-[11px] bg-white p-2 rounded-lg border border-slate-200/70 text-slate-600 truncate"
                        title={ref.text}
                      >
                        <span className="font-semibold text-indigo-700">[{ref.metadata?.filename || 'Document'}]: </span>
                        {ref.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>AI Tutor is formulating intuitive step-by-step guidance...</span>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-slate-400 font-medium shrink-0">Suggestions:</span>
        <button
          onClick={() => handleQuickPrompt("Can you give an intuitive real-world analogy for this concept?")}
          className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 whitespace-nowrap transition"
        >
          💡 Real-world analogy
        </button>
        <button
          onClick={() => handleQuickPrompt("Can you show a step-by-step worked example?")}
          className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 whitespace-nowrap transition"
        >
          📝 Step-by-step example
        </button>
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 border-t border-slate-100 bg-white rounded-b-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about this topic..."
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
