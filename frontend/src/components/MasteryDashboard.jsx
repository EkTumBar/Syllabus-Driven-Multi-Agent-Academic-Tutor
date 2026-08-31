import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { 
  BarChart2, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Loader2, 
  BookOpen, 
  Target 
} from 'lucide-react';

export const MasteryDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMastery = async () => {
      try {
        const response = await apiClient.get('/profile/mastery');
        setData(response.data);
      } catch (err) {
        console.error('Error fetching mastery profile:', err);
        setError('Failed to load mastery data.');
      } finally {
        setLoading(false);
      }
    };

    fetchMastery();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium text-slate-600">Calculating your student mastery metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 rounded-2xl border border-red-200 text-red-700 text-sm flex items-center gap-2">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const summary = data?.summary || {};
  const records = data?.records || [];

  const getTierColor = (score) => {
    if (score >= 0.8) return { bg: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 border-emerald-200' };
    if (score >= 0.4) return { bg: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-50 border-amber-200' };
    return { bg: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-50 border-rose-200' };
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Average Mastery</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {((summary.average_score || 0) * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-slate-400 font-medium">overall accuracy</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Mastered Topics</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">
              {summary.mastered_count || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">≥ 80% score</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Needs Review</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600">
              {summary.remediation_needed_count || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">&lt; 40% score</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">Total Attempts</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {summary.total_attempts || 0}
            </span>
            <span className="text-xs text-slate-400 font-medium">quiz questions answered</span>
          </div>
        </div>
      </div>

      {/* Visual Mastery Bar Chart */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Topic-by-Topic Mastery Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live progression tracked by the Evaluator Agent in Postgres
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No quiz attempts recorded yet.</p>
            <p className="text-xs mt-1">Start answering questions in any course to build your mastery curve.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {records.map((rec) => {
              const tier = getTierColor(rec.score_0to1);
              const percentage = Math.round(rec.score_0to1 * 100);

              return (
                <div key={rec.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{rec.topic}</span>
                      <span className="text-[11px] text-slate-400">
                        ({rec.attempts_count} attempt{rec.attempts_count === 1 ? '' : 's'})
                      </span>
                    </div>

                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${tier.badge} ${tier.text}`}>
                      {percentage}% Mastery
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tier.bg} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.max(5, percentage)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
