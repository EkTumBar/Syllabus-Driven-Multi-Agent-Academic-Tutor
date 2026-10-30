import React from 'react';
import { Hammer } from 'lucide-react';

/**
 * Honest placeholder for admin screens that need new backend work.
 * It shows what the screen will do and exactly what the backend must provide,
 * so nothing here pretends to have data it does not have.
 */
export const AdminPlannedSection = ({ title, summary, features, requires }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-[11px] font-semibold">
        <Hammer className="w-3 h-3" aria-hidden="true" />
        Planned
      </span>
    </div>

    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 shadow-xs space-y-5">
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{summary}</p>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2">
          What this screen will do
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-secondary)]">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] mb-2">
          Backend work needed first
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-secondary)]">
          {requires.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

export default AdminPlannedSection;
