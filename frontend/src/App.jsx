import React, { useState, useEffect } from 'react';
import { BookOpen, GraduationCap, CheckCircle2, ShieldAlert } from 'lucide-react';

function App() {
  const [backendStatus, setBackendStatus] = useState('Checking backend connection...');
  const [isHealthy, setIsHealthy] = useState(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setBackendStatus('Backend is connected and healthy!');
          setIsHealthy(true);
        } else {
          setBackendStatus('Backend returned unexpected status.');
          setIsHealthy(false);
        }
      })
      .catch((err) => {
        setBackendStatus(`Backend connection pending (${apiUrl}/health)`);
        setIsHealthy(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between">
      <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
              Syllabus Tutor
            </h1>
            <p className="text-xs text-slate-400">Multi-Agent Academic Tutoring Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isHealthy === true 
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
              : isHealthy === false 
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {isHealthy ? 'Backend Online' : 'Connecting...'}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6 shadow-xl">
          <BookOpen className="w-12 h-12 text-sky-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            Syllabus-Driven Multi-Agent Academic Tutor
          </h2>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed mb-6">
            Autonomous multi-agent architecture combining Planner, Researcher, Examiner, and Evaluator 
            agents powered by Google Gemini and Supabase RAG.
          </p>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            {backendStatus}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        Phase 1: Project Scaffolding & Environment Setup
      </footer>
    </div>
  );
}

export default App;
