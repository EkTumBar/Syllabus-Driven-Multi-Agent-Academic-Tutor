import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';
import {
  Users,
  Activity,
  UserPlus,
  CheckSquare,
  BookOpen,
  FileText,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Server,
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, hint, accent = 'text-indigo-500' }) => (
  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <Icon className={`w-4 h-4 ${accent}`} aria-hidden="true" />
    </div>
    <p className="mt-3 text-3xl font-black tracking-tight text-[var(--text-primary)]">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{hint}</p>}
  </div>
);

const PlannedTile = ({ icon: Icon, label, note }) => (
  <div className="bg-[var(--bg-card)] border border-dashed border-[var(--border)] rounded-2xl p-5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      <Icon className="w-4 h-4 text-[var(--text-secondary)]" aria-hidden="true" />
    </div>
    <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Not tracked yet</p>
    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{note}</p>
  </div>
);

export const AdminOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/admin/overview');
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load platform overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Platform Overview</h2>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-secondary)]">
          <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading overview" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard
              icon={Users}
              label="Registered students"
              value={data.total_students}
              hint={`${data.total_admins} admin account${data.total_admins === 1 ? '' : 's'}`}
            />
            <StatCard
              icon={Activity}
              label="Daily active users"
              value={data.active_users_24h}
              hint="Students who answered a question in the last 24h"
              accent="text-emerald-500"
            />
            <StatCard
              icon={UserPlus}
              label="New sign-ups (7 days)"
              value={data.new_signups_7d}
              accent="text-sky-500"
            />
            <StatCard
              icon={CheckSquare}
              label="Questions answered (24h)"
              value={data.attempts_24h}
              accent="text-amber-500"
            />
            <StatCard icon={BookOpen} label="Courses" value={data.total_courses} accent="text-purple-500" />
            <StatCard icon={FileText} label="Uploaded documents" value={data.total_documents} accent="text-rose-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">API &amp; database</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                {data.database === 'ok' ? 'Responding' : 'Check database'}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                Checked {new Date(data.generated_at).toLocaleTimeString()}
              </p>
            </div>
            <PlannedTile
              icon={Cpu}
              label="AI token consumption"
              note="Needs per-call token logging from the Gemini client."
            />
            <PlannedTile
              icon={Server}
              label="Render server health"
              note="Needs a Render API key to read service status."
            />
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminOverview;
