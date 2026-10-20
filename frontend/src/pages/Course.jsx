import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { QuizPanel } from '../components/QuizPanel';
import { ConceptExplainer } from '../components/ConceptExplainer';
import { 
  ArrowLeft, 
  BookOpen, 
  Layers, 
  FileText, 
  Loader2, 
  AlertCircle,
  Sparkles,
  CheckCircle,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';

export const Course = () => {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeExplainTopic, setActiveExplainTopic] = useState('');
  const [activeExplainQuestion, setActiveExplainQuestion] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [generatingModId, setGeneratingModId] = useState(null);
  const [genCount, setGenCount] = useState(25);
  const [moduleStatusMsg, setModuleStatusMsg] = useState({});

  useEffect(() => {
    const fetchCourseDetails = async () => {
      try {
        const response = await apiClient.get(`/courses/${courseId}`);
        setCourse(response.data);
      } catch (err) {
        console.error('Error fetching course:', err);
        setError('Course not found or access denied.');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId]);

  const handleExplainTopic = (questionText, topic) => {
    setActiveExplainQuestion(questionText || '');
    setActiveExplainTopic(topic || 'Current Topic');
  };

  const handleGenerateQuestionsForModule = async (moduleId, count = 25) => {
    setGeneratingModId(moduleId);
    setModuleStatusMsg((prev) => ({ ...prev, [moduleId]: '' }));
    try {
      const res = await apiClient.post(`/courses/${courseId}/modules/${moduleId}/generate-questions?count=${count}`);
      setModuleStatusMsg((prev) => ({
        ...prev,
        [moduleId]: `Generated ${res.data?.count || count} MCQs successfully!`
      }));
      setSelectedModuleId(moduleId);
    } catch (err) {
      console.error('Failed to generate questions:', err);
      setModuleStatusMsg((prev) => ({
        ...prev,
        [moduleId]: err.response?.data?.detail || 'Failed to generate question bank.'
      }));
    } finally {
      setGeneratingModId(null);
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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading course curriculum...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" aria-hidden="true" />
        <h1 className="text-lg font-bold text-slate-900">{error || 'Course Not Found'}</h1>
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

  const modules = course.modules || [];
  const documents = course.documents || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Course Navigation Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/"
            aria-label="Back to All Courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to All Courses</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            {course.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
            <span>{modules.length} Modules</span>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-500" aria-hidden="true" />
            <span>{documents.length} PDF Documents</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowDeleteModal(true);
              setDeleteError('');
            }}
            aria-label={`Delete course: ${course.title}`}
            className="px-3 py-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/60 transition flex items-center gap-1.5 font-bold cursor-pointer"
            title="Delete this course"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Delete Course</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Adaptive Quiz Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <QuizPanel
            courseId={courseId}
            modules={modules}
            activeModuleId={selectedModuleId}
            onModuleSelect={(modId) => setSelectedModuleId(modId)}
            onExplainTopic={handleExplainTopic}
          />

          {/* Module Syllabus Preview Accordion */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" aria-hidden="true" />
                <span>Structured Curriculum Modules</span>
              </h2>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>Batch Size:</span>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={20}>20 MCQs</option>
                  <option value={25}>25 MCQs (Standard)</option>
                  <option value={30}>30 MCQs</option>
                  <option value={40}>40 MCQs</option>
                  <option value={50}>50 MCQs</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {modules.map((mod, idx) => {
                const isCurrent = (mod.id === selectedModuleId);
                const isGen = (generatingModId === mod.id);
                const status = moduleStatusMsg[mod.id];

                return (
                  <div
                    key={mod.id || idx}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrent 
                        ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200' 
                        : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] shrink-0 ${
                          isCurrent ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{mod.title}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {mod.prerequisites_json && mod.prerequisites_json.length > 0 && (
                          <span className="text-[10px] text-slate-500 font-medium hidden md:inline">
                            Prereq: {mod.prerequisites_json.join(', ')}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedModuleId(mod.id)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200'
                          }`}
                        >
                          {isCurrent ? 'Active Quiz' : 'Practice'}
                        </button>
                        <button
                          type="button"
                          disabled={isGen}
                          onClick={() => handleGenerateQuestionsForModule(mod.id, genCount)}
                          className="px-2.5 py-1 rounded-lg font-semibold text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title={`Pre-generate a batch of ${genCount} questions for this module`}
                        >
                          {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-indigo-600" />}
                          <span>Generate ({genCount})</span>
                        </button>
                      </div>
                    </div>

                    {status && (
                      <p className={`mt-2 text-[11px] font-medium ${
                        status.includes('fail') ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        {status}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Socratic AI Tutor Chat (5 cols) */}
        <div className="lg:col-span-5">
          <ConceptExplainer
            courseId={courseId}
            initialTopic={activeExplainTopic}
            initialQuestion={activeExplainQuestion}
          />
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
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600" aria-hidden="true">
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
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <h3 id="course-delete-title" className="text-lg font-black text-slate-900">Delete Course</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-800 font-semibold">{course.title}</strong>? All generated modules, quiz questions, attempts, and indexed lecture documents will be deleted. This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
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

