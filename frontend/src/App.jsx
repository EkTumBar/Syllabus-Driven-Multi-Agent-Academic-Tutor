import React from 'react';
import { AuthProvider, useAuth } from './auth';
import AuthPage from './auth/AuthPage';
import { GraduationCap, LogOut, User as UserIcon, Shield, BookOpen } from 'lucide-react';

function AuthenticatedApp() {
  const { user, logout, isAdmin } = useAuth();

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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
            {isAdmin ? (
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
            ) : (
              <UserIcon className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span className="font-medium text-slate-200">{user?.email}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
              isAdmin ? 'bg-indigo-500/20 text-indigo-300' : 'bg-sky-500/20 text-sky-300'
            }`}>
              {user?.role}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center">
        <div className="p-8 rounded-3xl bg-slate-950/60 border border-slate-800 shadow-2xl max-w-lg w-full">
          <BookOpen className="w-12 h-12 text-sky-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Welcome to your Learning Space
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Authentication successfully verified. Ready for agent orchestration and course syllabi ingestion.
          </p>
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            Authenticated as <span className="text-sky-400">{user?.email}</span> ({user?.role})
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        Phase 3: Authentication + Role-Based Access Complete
      </footer>
    </div>
  );
}

function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Loading session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
