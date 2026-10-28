import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { SyllabusUpload } from '../components/SyllabusUpload';
import { 
  BookOpen, 
  Plus, 
  ArrowRight, 
  FileText, 
  Layers, 
  Loader2, 
  Sparkles, 
  GraduationCap,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

export const Home = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses');
      setCourses(response.data || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleCourseCreated = (newCourse) => {
    setCourses((prev) => [newCourse, ...prev]);
    setShowUpload(false);
    if (newCourse?.id) {
      navigate(`/course/${newCourse.id}`, { state: { course: newCourse } });
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      // Soft-delete: toggle is_archived to True to remove from main dashboard
      await apiClient.patch(`/courses/${courseToDelete.id}/archive`, { is_archived: true });
      setCourses((prev) => prev.filter((c) => c.id !== courseToDelete.id));
      setCourseToDelete(null);
    } catch (err) {
      console.error('Failed to archive course:', err);
      setDeleteError(err.response?.data?.detail || 'Failed to archive course. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 text-white p-8 sm:p-10 shadow-lg shadow-indigo-500/15">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI-Powered Syllabus Learning Environment</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Welcome to Your Intelligent Academic Workspace
          </h1>
          <p className="mt-3 text-sm sm:text-base text-indigo-100/90 leading-relaxed">
            Upload your syllabus or lecture documents. Four collaborative AI agents will structure your modules, formulate adaptive quiz questions, evaluate your responses, and tutor you through complex topics.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-white text-indigo-700 hover:bg-indigo-50 transition shadow-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{showUpload ? 'Close Upload Form' : 'Upload New Syllabus'}</span>
            </button>
            <Link
              to="/progress"
              aria-label="View My Mastery and Learning Analytics"
              className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-white/10 hover:bg-white/20 border border-white/20 text-white transition backdrop-blur-md"
            >
              View My Mastery
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>
      </div>

      {/* Conditional Syllabus Upload Form */}
      {showUpload && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <SyllabusUpload onCourseCreated={handleCourseCreated} />
        </div>
      )}

      {/* Courses Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">Your Enrolled Courses</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Select a course to start your adaptive quiz and concept explanation session
            </p>
          </div>

          {!showUpload && courses.length > 0 && (
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 border border-indigo-200/60 dark:border-indigo-800/60 transition"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Course</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--text-secondary)]">Loading your courses...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-3xl p-12 border border-[var(--border)] text-center shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-4" aria-hidden="true">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">No Courses Yet</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              Get started by uploading your first course syllabus or pasting your lecture topics.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 px-6 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Upload Your First Syllabus</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const moduleCount = course.modules?.length || 0;
              const docCount = course.documents?.length || 0;

              return (
                <div
                  key={course.id}
                  className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border)] shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-all flex flex-col justify-between group relative"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform" aria-hidden="true">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCourseToDelete(course);
                          setDeleteError('');
                        }}
                        title={`Delete course: ${course.title}`}
                        aria-label={`Delete course: ${course.title}`}
                        className="opacity-70 group-hover:opacity-100 focus:opacity-100 p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/40 transition-all duration-150"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {course.title}
                    </h3>

                    <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2 leading-relaxed">
                      {course.syllabus_raw}
                    </p>

                    <div className="mt-4 flex items-center gap-3 text-xs text-[var(--text-secondary)] font-medium pt-3 border-t border-[var(--border)]">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
                        <span>{moduleCount} Modules</span>
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" aria-hidden="true" />
                        <span>{docCount} Documents</span>
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/course/${course.id}`}
                    state={{ course }}
                    aria-label={`Enter Course Workspace for ${course.title}`}
                    className="mt-6 w-full py-2.5 px-4 rounded-xl font-bold text-xs text-center text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white border border-indigo-100 dark:border-indigo-800/60 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Enter Course Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Course Deletion */}
      {courseToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-course-title"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="bg-[var(--bg-card)] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400" aria-hidden="true">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                type="button"
                disabled={isDeleting}
                aria-label="Close delete course dialog"
                onClick={() => {
                  setCourseToDelete(null);
                  setDeleteError('');
                }}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <h3 id="delete-course-title" className="text-lg font-black text-[var(--text-primary)]">Archive Course</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                Remove <strong className="text-[var(--text-primary)] font-semibold">{courseToDelete.title}</strong> from your active dashboard. You can still access its full performance metrics, restore it, or permanently delete it anytime under <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">Mastery & Progress</strong>.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setCourseToDelete(null);
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
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Archiving...' : 'Archive Course'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

