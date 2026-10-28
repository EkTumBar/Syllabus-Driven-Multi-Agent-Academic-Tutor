import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Sparkles, Send, Loader2, BookOpen, ChevronRight, MessageSquare, Bot } from 'lucide-react';

export const ConceptExplainer = ({ 
  courseId, 
  initialTopic = '', 
  initialQuestion = '', 
  initialExplanation = '' 
}) => {
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
  const lastInjectedRef = useRef('');
  const messagesEndRef = useRef(null);

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

  /**
   * Fix for Bug 2 / 3 (Dynamic Remediation Injection):
   * Listens for changes to incoming props (topic, question, explanation).
   * Injects the context into the chatbox and automatically asks the Socratic AI Tutor.
   */
  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }

    if (!initialQuestion) return;

    const fingerprint = `${initialTopic}:::${initialQuestion}:::${initialExplanation}`;
    if (lastInjectedRef.current === fingerprint) return;
    lastInjectedRef.current = fingerprint;

    const promptText = `I need clarification on this question from my assessment:
• Question: ${initialQuestion}
${initialExplanation ? `• Academic Explanation / Key: ${initialExplanation}\n` : ''}
Could you walk me through the foundational concept and explain how to reason through this?`;

    handleAsk(promptText, initialTopic || topic);
  }, [initialQuestion, initialTopic, initialExplanation]);

  // Auto-scroll messages into view
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleQuickPrompt = (promptText) => {
    handleAsk(promptText);
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm flex flex-col h-[520px]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-gradient-to-r from-indigo-50/50 dark:from-indigo-950/30 to-purple-50/50 dark:to-purple-950/30 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs" aria-hidden="true">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span>Socratic AI Tutor</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">Grounded in your course documents</p>
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
                  : 'bg-[var(--bg-card-hover)] text-[var(--text-primary)] rounded-tl-xs border border-[var(--border)]'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Citations & Lecture Excerpts */}
              {msg.references && msg.references.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[var(--border)]">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1 mb-1.5">
                    <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    <span>Lecture Sources (RAG Citations)</span>
                  </h3>
                  <div className="space-y-1">
                    {msg.references.slice(0, 2).map((ref, rIdx) => (
                      <div
                        key={rIdx}
                        className="text-[11px] bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] truncate"
                        title={ref.text}
                      >
                        <span className="font-semibold text-indigo-700 dark:text-indigo-400">[{ref.metadata?.filename || 'Document'}]: </span>
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
          <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span>AI Tutor is formulating intuitive step-by-step guidance...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 bg-[var(--bg-card-hover)] border-t border-[var(--border)] flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <span className="text-[var(--text-secondary)] font-medium shrink-0">Suggestions:</span>
        <button
          type="button"
          onClick={() => handleQuickPrompt("Can you give an intuitive real-world analogy for this concept?")}
          aria-label="Ask for real-world analogy"
          className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border)] hover:border-indigo-300 dark:hover:border-indigo-600 text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap transition cursor-pointer"
        >
          💡 Real-world analogy
        </button>
        <button
          type="button"
          onClick={() => handleQuickPrompt("Can you show a step-by-step worked example?")}
          aria-label="Ask for step-by-step worked example"
          className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border)] hover:border-indigo-300 dark:hover:border-indigo-600 text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap transition cursor-pointer"
        >
          📝 Step-by-step example
        </button>
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg-card)] rounded-b-2xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="socratic-query-input"
            name="socratic-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question about this topic..."
            aria-label="Ask a question about this topic"
            className="flex-1 px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            aria-label="Send question to AI Tutor"
            className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
};
