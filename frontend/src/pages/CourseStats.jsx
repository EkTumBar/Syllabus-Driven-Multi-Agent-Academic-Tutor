import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  Layers,
  BookOpen,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
  FileText,
  Clock,
  Sparkles,
  ShieldAlert,
  Archive,
  RefreshCw
} from 'lucide-react';

export const CourseStats = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Hard Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/courses/${courseId}/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to load course statistics:', err);
      setError(err.response?.data?.detail || 'Unable to load statistics for this course.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchStats();
    }
  }, [courseId]);

  const handlePermanentDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await apiClient.delete(`/courses/${courseId}`);
      // Redirect back to mastery overview with status message
      navigate('/progress', { 
        state: { message: `Course "${stats?.title || 'Syllabus'}" and its cloud storage assets were permanently deleted.` } 
      });
    } catch (err) {
      console.error('Hard delete error:', err);
      const detail = err.response?.data?.detail || 'Failed to permanently delete course. Please try again.';
      setDeleteError(detail);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-base font-semibold text-[var(--text-primary)]">Aggregating Course Mastery Analytics...</p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">Retrieving question attempts, accuracies, and syllabus progress</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-8 rounded-2xl bg-[var(--bg-card)] border border-rose-300 dark:border-rose-500/30 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 dark:text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Course Statistics Unavailable</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">{error || 'Course not found.'}</p>
          <div className="pt-2">
            <Link
              to="/progress"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Mastery Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const accuracy = stats.accuracy_percentage ?? 0;
  const mastery = stats.mastery_percentage ?? 0;
  const progress = stats.progress_percentage ?? 0;
  const correct = stats.correct_answers ?? 0;
  const wrong = stats.wrong_answers ?? 0;
  const totalAttempts = stats.total_attempts ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/progress"
          className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Syllabi & Mastery Overview</span>
        </Link>

        <div className="flex items-center gap-2">
          {stats.is_archived ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              <Archive className="w-3.5 h-3.5" />
              <span>Archived Subject</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active Curriculum</span>
            </span>
          )}

          <Link
            to={`/course/${stats.course_id}`}
            className="px-4 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open Syllabus Course</span>
          </Link>
        </div>
      </div>

      {/* Course Title Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-slate-50 dark:from-[#0d162b] dark:via-[#101b33] dark:to-[#151c3d] p-6 sm:p-8 border border-[var(--border)] shadow-sm dark:shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>Syllabus Performance & Question Analytics</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight">
              {stats.title}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-2">
              {stats.syllabus_raw || 'Structured syllabus modules and adaptive CBT assessment analytics.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)] pt-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {stats.total_modules} Modules
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {stats.total_questions} Pre-generated Questions
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                Created {new Date(stats.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Quick Mastery Grade Ring Indicator */}
          <div className="flex items-center gap-4 bg-[var(--bg-card)]/90 backdrop-blur-md p-4 rounded-2xl border border-[var(--border)] shrink-0 shadow-xs">
            <div className="w-16 h-16 rounded-xl bg-indigo-50 dark:bg-gradient-to-tr dark:from-indigo-500/20 dark:to-purple-500/20 border border-indigo-100 dark:border-indigo-500/30 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-300">{Math.round(mastery)}%</span>
              <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">Mastery</span>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {mastery >= 80 ? 'Mastered Topic 🏆' : (mastery >= 50 ? 'Proficient Steady' : 'Needs Practice')}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">{stats.total_attempts} total responses submitted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row: 4 Essential KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Mastery Score */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Subject Mastery</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-300">{Math.round(mastery)}%</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">overall curve</span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full" style={{ width: `${Math.max(5, mastery)}%` }} />
          </div>
        </div>

        {/* Metric 2: Course Progress */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Curriculum Progress</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600 dark:text-purple-300">{Math.round(progress)}%</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">questions attempted</span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full" style={{ width: `${Math.max(5, progress)}%` }} />
          </div>
        </div>

        {/* Metric 3: Correct Answers */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Correct Responses</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{correct}</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">of {totalAttempts} submissions</span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-1.5 rounded-full" 
              style={{ width: `${totalAttempts > 0 ? (correct / totalAttempts) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* Metric 4: Incorrect Answers */}
        <div className="bg-[var(--bg-card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-[var(--text-secondary)]">
            <span>Incorrect Responses</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600 dark:text-rose-400">{wrong}</span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">mistakes reviewed</span>
          </div>
          <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-rose-500 h-1.5 rounded-full" 
              style={{ width: `${totalAttempts > 0 ? (wrong / totalAttempts) * 100 : 0}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Answer Accuracy Comparison Breakdown Card */}
      <div className="bg-[var(--bg-card)] p-6 sm:p-8 rounded-3xl border border-[var(--border)] shadow-sm dark:shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Right vs. Wrong Answer Distribution</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Comparative analysis of your submissions across all modules of this subject
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-[var(--text-primary)]">{accuracy}%</span>
            <span className="text-xs text-[var(--text-secondary)] ml-1.5">Net Accuracy</span>
          </div>
        </div>

        {/* Comparative Segmented Bar */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-[var(--border)] rounded-xl overflow-hidden flex shadow-inner">
            <div 
              className="bg-emerald-500 hover:bg-emerald-400 transition-all duration-300 relative group"
              style={{ width: `${totalAttempts > 0 ? (correct / totalAttempts) * 100 : 50}%` }}
              title={`Correct: ${correct}`}
            />
            <div 
              className="bg-rose-500 hover:bg-rose-400 transition-all duration-300 relative group"
              style={{ width: `${totalAttempts > 0 ? (wrong / totalAttempts) * 100 : 50}%` }}
              title={`Incorrect: ${wrong}`}
            />
          </div>

          <div className="flex items-center justify-between text-xs font-semibold pt-1">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>Correct Answers: {correct} ({totalAttempts > 0 ? Math.round((correct / totalAttempts) * 100) : 0}%)</span>
            </div>
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span>Incorrect Answers: {wrong} ({totalAttempts > 0 ? Math.round((wrong / totalAttempts) * 100) : 0}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Breakdown Grid */}
      <div className="bg-[var(--bg-card)] p-6 sm:p-8 rounded-3xl border border-[var(--border)] shadow-sm dark:shadow-md space-y-6">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Module-by-Module Performance Breakdown</span>
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Individual mastery level and test history per curriculum module
          </p>
        </div>

        {stats.modules?.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] text-center text-[var(--text-secondary)] text-xs">
            No modules registered under this syllabus yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.modules.map((mod, index) => {
              const modMastery = Math.round(mod.mastery_score || 0);
              return (
                <div 
                  key={mod.id || index}
                  className="p-5 rounded-2xl bg-[var(--bg-card-hover)] border border-[var(--border)] hover:border-indigo-500/30 transition space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Module {mod.order_index || index + 1}
                      </span>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] line-clamp-1">{mod.title}</h3>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                      modMastery >= 80 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
                        : (modMastery >= 40 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300')
                    }`}>
                      {modMastery}%
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-[var(--border)] text-xs">
                    <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                      <span className="block font-bold text-[var(--text-primary)]">{mod.total_questions}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Questions</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                      <span className="block font-bold text-emerald-600 dark:text-emerald-400">{mod.correct_count}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Correct</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border)]">
                      <span className="block font-bold text-rose-600 dark:text-rose-400">{mod.incorrect_count}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Wrong</span>
                    </div>
                  </div>

                  <div className="w-full bg-[var(--border)] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-1.5 rounded-full" 
                      style={{ width: `${Math.max(5, modMastery)}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Danger Zone: Hard Delete Section */}
      <div className="bg-rose-50/50 dark:bg-[#140e15] border border-rose-200 dark:border-rose-900/50 p-6 sm:p-8 rounded-3xl shadow-sm dark:shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Danger Zone: Permanent Course Deletion</h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
          Permanently remove this course from your account. This executes an unrecoverable clean purge: all syllabus records, pre-generated MCQs, question attempts, vector search embeddings, and attached PDF documents in Supabase Storage will be completely deleted.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Permanently Delete Course</span>
          </button>
        </div>
      </div>

      {/* Hard Delete Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-[var(--text-primary)]">Permanently Delete Subject?</h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-[var(--text-primary)] font-semibold">"{stats.title}"</strong>?
              </p>
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-left text-xs text-rose-800 dark:text-rose-200 space-y-1">
                <p className="font-bold text-rose-700 dark:text-rose-300">This action cannot be undone:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[var(--text-secondary)]">
                  <li>Attached PDFs will be deleted from Supabase Storage</li>
                  <li>Vector chunks and embeddings will be wiped</li>
                  <li>All question banks and mastery attempts will be destroyed</li>
                </ul>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError('');
                }}
                className="w-1/2 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handlePermanentDelete}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Purging Cloud Assets...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Forever</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CourseStats;
