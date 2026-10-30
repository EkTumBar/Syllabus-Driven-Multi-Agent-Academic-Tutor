import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserList } from './UserList';
import { AdminLogs } from './AdminLogs';
import { AdminOverview } from './AdminOverview';
import { AdminPlannedSection } from './AdminPlannedSection';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  ScrollText,
  BookOpen,
  Bot,
  Settings,
} from 'lucide-react';

// `live` sections talk to existing backend routes. `planned` sections need new backend work.
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, live: true },
  { id: 'students', label: 'Students', icon: Users, live: true },
  { id: 'logs', label: 'Audit Logs', icon: ScrollText, live: true },
  { id: 'syllabus', label: 'Syllabus & Curriculum', icon: BookOpen, live: false },
  { id: 'agents', label: 'Agent Monitor', icon: Bot, live: false },
  { id: 'settings', label: 'System Settings', icon: Settings, live: false },
];

const PLANNED = {
  syllabus: {
    title: 'Syllabus & Curriculum Control',
    summary:
      'Manage the source material the tutor agents learn from, and keep the retrieval index in sync with it.',
    features: [
      'Upload new course materials and see which documents are indexed',
      'Edit the module and topic structure of a course',
      'Re-embed a course\'s chunks with a progress indicator',
    ],
    requires: [
      'Admin routes to list documents and chunk counts across courses',
      'A background re-embed job (embeddings are written by the backend, never the browser)',
    ],
  },
  agents: {
    title: 'LangGraph Agent Monitor',
    summary:
      'A technical view of the four agents (planner, researcher, examiner, evaluator) and the orchestrator that runs them.',
    features: [
      'Live log of agent runs with status and duration',
      'Token usage and estimated cost per agent',
      'Flags for runs that failed, retried repeatedly or looped',
    ],
    requires: [
      'A table that records each agent call (agent, tokens in/out, latency, error)',
      'Logging hooks in the LLM client and orchestrator to write those rows',
      'An admin route that streams or paginates the records',
    ],
  },
  settings: {
    title: 'System Settings',
    summary: 'Operational controls for the FastAPI backend.',
    features: [
      'Toggle maintenance mode',
      'Adjust global rate limits',
      'Rotate the Gemini API key without a redeploy',
    ],
    requires: [
      'A settings table plus middleware that reads it (maintenance flag, rate limits)',
      'Secrets such as the Gemini key stay in Render environment variables; the UI should only show masked values and trigger a rotation, never display or store the raw key',
    ],
  },
};

export const AdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const active = SECTIONS.some((s) => s.id === requested) ? requested : 'overview';
  const [logRefresh, setLogRefresh] = useState(0);

  const goTo = (id) => setSearchParams(id === 'overview' ? {} : { section: id });

  const renderSection = () => {
    switch (active) {
      case 'overview':
        return <AdminOverview />;
      case 'students':
        return <UserList onLogGenerated={() => setLogRefresh((n) => n + 1)} />;
      case 'logs':
        return <AdminLogs key={logRefresh} />;
      default:
        return <AdminPlannedSection {...PLANNED[active]} />;
    }
  };

  return (
    <div className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
      {/* Persistent sidebar (becomes a scrollable strip on small screens) */}
      <aside className="lg:w-64 shrink-0">
        <div className="lg:sticky lg:top-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3 shadow-xs">
          <div className="hidden lg:flex items-center gap-2 px-3 py-3 mb-2">
            <ShieldCheck className="w-4 h-4 text-purple-500" aria-hidden="true" />
            <span className="text-xs font-bold tracking-wide text-[var(--text-primary)]">
              Admin Control Center
            </span>
          </div>
          <nav
            aria-label="Administrator sections"
            className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible"
          >
            {SECTIONS.map(({ id, label, icon: Icon, live }) => {
              const isActive = id === active;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => goTo(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30'
                      : 'border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  {!live && (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300">Planned</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Wide main content area */}
      <section className="flex-1 min-w-0" aria-live="polite">
        {renderSection()}
      </section>
    </div>
  );
};
