import React from 'react';
import { MasteryDashboard } from '../components/MasteryDashboard';
import { BarChart2, Award, Sparkles } from 'lucide-react';

export const Progress = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-2">
            <Award className="w-3.5 h-3.5" />
            <span>Postgres-Backed Mastery Profile</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Student Learning Mastery & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time tracking computed by the Evaluator Agent across all completed assessments
          </p>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <MasteryDashboard />
    </div>
  );
};
