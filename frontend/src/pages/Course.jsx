import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  CheckCircle
} from 'lucide-react';

export const Course = () => {
  const { id: courseId } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeExplainTopic, setActiveExplainTopic] = useState('');
  const [activeExplainQuestion, setActiveExplainQuestion] = useState('');

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
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">{error || 'Course Not Found'}</h2>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Courses</span>
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            {course.title}
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>{modules.length} Modules</span>
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-purple-500" />
            <span>{documents.length} PDF Documents</span>
          </span>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Adaptive Quiz Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <QuizPanel
            courseId={courseId}
            onExplainTopic={handleExplainTopic}
          />

          {/* Module Syllabus Preview Accordion */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Structured Curriculum Modules</span>
            </h3>

            <div className="space-y-2">
              {modules.map((mod, idx) => (
                <div
                  key={mod.id || idx}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{mod.title}</span>
                  </div>

                  {mod.prerequisites_json && mod.prerequisites_json.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      Prereq: {mod.prerequisites_json.join(', ')}
                    </span>
                  )}
                </div>
              ))}
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
    </div>
  );
};
