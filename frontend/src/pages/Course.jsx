import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';
import { QuizPanel } from '../components/QuizPanel';
import { ConceptExplainer } from '../components/ConceptExplainer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { 
  ArrowLeft, 
  BookOpen, 
  Layers, 
  FileText, 
  Loader2, 
  AlertCircle,
  Trash2,
  AlertTriangle,
  X,
  HelpCircle
} from 'lucide-react';

export const Course = () => {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Safely retrieve pre-generated course passed through React Router state
  const preloadedCourse = location.state?.course && location.state.course.id === courseId
    ? location.state.course
    : null;

  const [course, setCourse] = useState(preloadedCourse);
  const [loading, setLoading] = useState(!preloadedCourse);
  const [error, setError] = useState('');
  const [activeExplainTopic, setActiveExplainTopic] = useState('');
  const [activeExplainQuestion, setActiveExplainQuestion] = useState('');
  const [activeExplainExplanation, setActiveExplainExplanation] = useState('');
  const explainerRef = useRef(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState(
    preloadedCourse?.modules?.[0]?.id || ''
  );

  useEffect(() => {
    let isMounted = true;

    const fetchCourseDetails = async () => {
      try {
        const response = await apiClient.get(`/courses/${courseId}`);
        if (!isMounted) return;

        setCourse(response.data);
        if (response.data?.modules?.length > 0) {
          setSelectedModuleId((prev) => prev || response.data.modules[0].id);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching course:', err);
        // Only set error if we don't already have preloaded course state
        if (!preloadedCourse) {
          setError('Course not found or access denied.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (courseId) {
      fetchCourseDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [courseId, preloadedCourse]);

  const handleExplainTopic = (questionText, topic, explanation = '') => {
    setActiveExplainQuestion(questionText || '');
    setActiveExplainTopic(topic || 'Current Topic');
    setActiveExplainExplanation(explanation || '');

    // Automatically focus/scroll into view if on smaller screens or collapsed
    if (explainerRef.current) {
      explainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDeleteCourse = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await apiClient.delete(`/courses/${courseId}`);
      navigate('/');
    } catch (err) {
      console.error('Failed to delete course:', err);
      setDeleteError(err.response?.data?.detail || 'Failed to delete course. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && !course) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-[var(--text-secondary)]">Loading course curriculum...</p>
      </div>
    );
  }

  if ((error && !course) || !course) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" aria-hidden="true" />
        <h1 className="text-lg font-bold text-[var(--text-primary)]">{error || 'Course Not Found'}</h1>
        <Link
          to="/"
          aria-label="Back to My Courses"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to My Courses</span>
        </Link>
      </div>
    );
  }

  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const documents = Array.isArray(course?.documents) ? course.documents : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Course Navigation Header */}
      <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            aria-label="Back to All Courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to All Courses</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
            {course.title || 'Untitled Course'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
            <span>{modules.length} Modules</span>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/60 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
            <span>{documents.length} PDF Documents</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteError('');
            }}
            aria-label={`Delete course: ${course.title || 'course'}`}
            className="px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100/80 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-900/60 transition flex items-center gap-1.5 font-bold cursor-pointer"
            title="Delete this course"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Delete Course</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Adaptive Quiz Panel wrapped in Error Boundary (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <ErrorBoundary
            fallbackTitle="Quiz Assessment Error"
            fallbackDescription="A rendering issue occurred within the quiz module view. Details and debug trace are provided below:"
          >
            <QuizPanel
              courseId={courseId}
              modules={modules}
              activeModuleId={selectedModuleId}
              onModuleSelect={(modId) => setSelectedModuleId(modId)}
              onExplainTopic={handleExplainTopic}
            />
          </ErrorBoundary>

          {/* Module Syllabus Preview Accordion */}
          <div className="bg-[var(--bg-card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                <span>Structured Curriculum Modules</span>
              </h2>
            </div>

            <div className="space-y-3">
              {modules.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-card-hover)] rounded-xl border border-dashed border-[var(--border)]">
                  <HelpCircle className="w-6 h-6 text-[var(--text-secondary)] mx-auto mb-1.5" />
                  <p>No modules have been planned for this course yet.</p>
                </div>
              ) : (
                modules.map((mod, idx) => {
                  const isCurrent = (mod?.id === selectedModuleId);
                  const questionCount = Array.isArray(mod?.questions) ? mod.questions.length : 0;

                  return (
                    <div
                      key={mod?.id || idx}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isCurrent 
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-200 dark:ring-indigo-800' 
                          : 'border-[var(--border)] bg-[var(--bg-card-hover)] hover:border-indigo-500/30'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                            isCurrent ? 'bg-indigo-600 text-white' : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-[var(--text-primary)]">{mod?.title || `Module ${idx + 1}`}</span>
                          {questionCount > 0 && (
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 px-1.5 py-0.5 rounded-md">
                              {questionCount} Qs
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {mod?.prerequisites_json && Array.isArray(mod.prerequisites_json) && mod.prerequisites_json.length > 0 && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
                              Prereq: {mod.prerequisites_json.join(', ')}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedModuleId(mod?.id)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                              isCurrent
                                ? 'bg-indigo-600 text-white'
                                : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-indigo-600 dark:text-indigo-400 border border-[var(--border)]'
                            }`}
                          >
                            {isCurrent ? 'Active Quiz' : 'Practice'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Socratic AI Tutor Chat (5 cols) */}
        <div className="lg:col-span-5" ref={explainerRef}>
          <ErrorBoundary
            fallbackTitle="AI Tutor Chat Error"
            fallbackDescription="An error occurred inside the Concept Explainer chat widget:"
          >
            <ConceptExplainer
              courseId={courseId}
              initialTopic={activeExplainTopic}
              initialQuestion={activeExplainQuestion}
              initialExplanation={activeExplainExplanation}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-delete-title"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-[var(--bg-card)] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400" aria-hidden="true">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                disabled={isDeleting}
                aria-label="Close delete course dialog"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError('');
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <h3 id="course-delete-title" className="text-lg font-black text-[var(--text-primary)]">Delete Course</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-[var(--text-primary)] font-semibold">{course.title}</strong>? All generated modules, quiz questions, attempts, and indexed lecture documents will be deleted. This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteCourse}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Course'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
