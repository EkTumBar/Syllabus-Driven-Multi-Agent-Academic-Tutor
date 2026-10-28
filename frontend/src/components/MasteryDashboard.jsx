import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  BarChart2, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  TrendingUp, 
  Loader2, 
  BookOpen, 
  Target,
  ArrowRight,
  Layers,
  FileText,
  Calendar,
  Archive,
  Eye,
  Sparkles,
  Check
} from 'lucide-react';

export const MasteryDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [masteryData, setMasteryData] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'archived'
  const [notification, setNotification] = useState(location.state?.message || '');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [masteryRes, coursesRes] = await Promise.all([
          apiClient.get('/profile/mastery').catch(() => ({ data: null })),
          apiClient.get('/courses?include_archived=true').catch(() => ({ data: [] }))
        ]);
        setMasteryData(masteryRes.data);
        setCourses(coursesRes.data || []);
      } catch (err) {
        console.error('Error fetching mastery and courses:', err);
        setError('Failed to load mastery data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Clear toast notification after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleToggleArchive = async (e, course) => {
    e.stopPropagation();
    const newArchivedState = !course.is_archived;
    try {
      await apiClient.patch(`/courses/${course.id}/archive`, { is_archived: newArchivedState });
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_archived: newArchivedState } : c))
      );
    } catch (err) {
      console.error('Failed to toggle archive status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] text-[var(--text-primary)]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-semibold">Aggregating Subject Analytics & Mastery Curves...</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">Reading database metrics across all enrolled syllabi</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const summary = masteryData?.summary || {};
  const records = masteryData?.records || [];

  const filteredCourses = courses.filter((c) => {
    if (filter === 'active') return !c.is_archived;
    if (filter === 'archived') return c.is_archived;
    return true;
  });

  const activeCount = courses.filter((c) => !c.is_archived).length;
  const archivedCount = courses.filter((c) => c.is_archived).length;

  const getTierColor = (score) => {
    if (score >= 0.8) return { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' };
    if (score >= 0.4) return { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' };
    return { bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400', badge: 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20' };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Notification Banner */}
      {notification && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{notification}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification('')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Global Mastery Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Average Accuracy</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[var(--text-primary)]">
              {((summary.average_score || 0) * 100).toFixed(0)}%
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">overall proficiency</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Mastered Topics</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {summary.mastered_count || 0}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-medium">≥ 80% accuracy</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Total Syllabi</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[var(--text-primary)]">{courses.length}</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">({activeCount} active, {archivedCount} archived)</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Total Attempts</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[var(--text-primary)]">{summary.total_attempts || 0}</span>
            <span className="text-xs text-[var(--text-muted)] font-medium">questions evaluated</span>
          </div>
        </div>
      </div>

      {/* Section: Distinct Syllabus / Subject Blocks Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Enrolled Syllabi & Course Performance Blocks</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Select any curriculum block below to inspect detailed answer breakdowns and mastery stats.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              All ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filter === 'active' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('archived')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                filter === 'archived' ? 'bg-indigo-600 text-white shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[var(--bg-card)] border border-dashed border-[var(--border)] text-center space-y-3">
            <BookOpen className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">No courses match the current filter.</p>
            <p className="text-xs text-[var(--text-muted)]">
              {filter === 'archived'
                ? 'You do not have any archived courses. Soft-delete courses from your home dashboard to archive them.'
                : 'Upload a syllabus to get started with multi-agent learning.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course) => {
              const modulesCount = course.modules?.length || 0;
              const docsCount = course.documents?.length || 0;

              return (
                <div
                  key={course.id}
                  onClick={() => navigate(`/mastery/${course.id}`)}
                  className="group relative bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-3xl p-6 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      {course.is_archived ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                          <Archive className="w-3 h-3" />
                          <span>Archived</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </span>
                      )}

                      <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(course.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition line-clamp-1">
                        {course.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                        {course.syllabus_raw || 'Adaptive multi-agent curriculum and CBT assessment.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>{modulesCount} Modules</span>
                      </span>
                      {docsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                          <span>{docsCount} Document{docsCount === 1 ? '' : 's'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={(e) => handleToggleArchive(e, course)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <Archive className="w-3 h-3" />
                      <span>{course.is_archived ? 'Restore to Home' : 'Archive'}</span>
                    </button>

                    <div className="inline-flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all">
                      <span>View Course Stats</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Topic-by-Topic Mastery Curve */}
      <div className="bg-[var(--bg-card)] p-6 sm:p-8 rounded-3xl border border-[var(--border)] shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Topic-by-Topic Mastery Breakdown</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Computed by the Evaluator Agent across all completed assessments
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)] text-xs">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
            <p className="font-semibold text-[var(--text-primary)]">No topic mastery records logged yet.</p>
            <p className="text-[var(--text-muted)] mt-0.5">Begin answering module quiz questions to populate your skill tree.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => {
              const tier = getTierColor(rec.score_0to1);
              const percentage = Math.round(rec.score_0to1 * 100);

              return (
                <div key={rec.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card-hover)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)] text-sm">{rec.topic}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        ({rec.attempts_count} attempt{rec.attempts_count === 1 ? '' : 's'})
                      </span>
                    </div>

                    <span className={`font-bold px-2.5 py-0.5 rounded-full border text-xs ${tier.badge} ${tier.text}`}>
                      {percentage}% Mastery
                    </span>
                  </div>

                  <div className="w-full h-2 bg-[var(--border)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tier.bg} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.max(5, percentage)}%` }}
                    />
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
export default MasteryDashboard;
