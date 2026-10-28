import React, { useState } from 'react';
import apiClient from '../api/client';
import { Upload, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle, Plus, Image as ImageIcon, X } from 'lucide-react';

export const SyllabusUpload = ({ onCourseCreated }) => {
  const [title, setTitle] = useState('');
  const [syllabusRaw, setSyllabusRaw] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const sampleSyllabus = `Module 1: Foundations of Machine Learning & Linear Algebra
- Vectors, Matrices, Eigenvalues, and Linear Transformations
- Loss functions, Gradient Descent, and Optimization

Module 2: Supervised Learning & Deep Neural Networks
- Linear and Logistic Regression
- Multilayer Perceptrons, Backpropagation, and Activation Functions

Module 3: Sequence Modeling & Attention Mechanisms
- Recurrent Neural Networks & LSTMs
- Self-Attention and Transformer Architectures`;

  const handleFillSample = () => {
    setTitle('CS229: Machine Learning Foundations');
    setSyllabusRaw(sampleSyllabus);
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext)) ||
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type.startsWith('image/');

    if (isValid) {
      setAttachedFile(file);
      setError('');
    } else {
      setError('Please select a supported document or image (.pdf, .doc, .docx, .png, .jpg, .jpeg).');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Please provide a course title.');
      return;
    }

    if (!syllabusRaw.trim() && !attachedFile) {
      setError('Please provide syllabus content or upload a document (.pdf, .doc, .docx, or image).');
      return;
    }

    const finalCount = Math.min(50, Math.max(10, Number(questionCount) || 10));
    setLoading(true);
    setError('');
    setStatusMessage(`Planner Agent is structuring curriculum & pre-generating ${finalCount} assessment questions per module at ${difficulty} level...`);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (syllabusRaw.trim()) {
        formData.append('syllabus_raw', syllabusRaw.trim());
      }
      if (attachedFile) {
        formData.append('file', attachedFile);
      }
      formData.append('question_count', finalCount);
      formData.append('difficulty', difficulty);

      // Create course and trigger Multi-Agent Assessment Pre-Generation upfront (allow up to 3 minutes)
      const courseResponse = await apiClient.post('/courses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000
      });
      const createdCourse = courseResponse.data;

      setStatusMessage('Course & full question bank successfully pre-generated!');
      setTitle('');
      setSyllabusRaw('');
      setAttachedFile(null);
      setQuestionCount(10);
      setDifficulty('medium');

      if (onCourseCreated) {
        onCourseCreated(createdCourse);
      }
    } catch (err) {
      console.error('Course creation error details:', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        responseData: err.response?.data,
        configUrl: err.config?.url,
        configBaseURL: err.config?.baseURL,
      });

      let displayError = 'Failed to create course. Please verify your connection.';
      if (err.response?.data?.detail) {
        displayError = typeof err.response.data.detail === 'string'
          ? err.response.data.detail
          : JSON.stringify(err.response.data.detail);
      } else if (err.response?.data?.message) {
        displayError = err.response.data.message;
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        displayError = 'Request timed out waiting for AI syllabus planning and question generation. Generating 10-50 questions may take up to 2-3 minutes. Please try again.';
      } else if (err.message) {
        displayError = `Connection or request error: ${err.message}`;
      }

      setError(displayError);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-6 sm:p-8 border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400" aria-hidden="true">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Create New Course</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Paste your syllabus or upload a document/image (.pdf, .doc, .docx, .png, .jpg).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFillSample}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 px-3 py-1.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 transition-colors"
        >
          Load Sample Syllabus
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/50 flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50 flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-sm animate-pulse">
          <Sparkles className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Course Title */}
        <div>
          <label htmlFor="course-title-input" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Course Title <span className="text-rose-500">*</span>
          </label>
          <input
            id="course-title-input"
            name="course-title"
            type="text"
            required
            aria-required="true"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Organic Chemistry II or CS229 Machine Learning"
            className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition"
          />
        </div>

        {/* Syllabus Text (Optional if file attached) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="syllabus-content-input" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Syllabus Content or Topic Breakdown
            </label>
            <span className="text-[11px] text-[var(--text-muted)] font-medium">
              {attachedFile ? 'Optional (file attached)' : 'Required if no file uploaded'}
            </span>
          </div>
          <textarea
            id="syllabus-content-input"
            name="syllabus-content"
            rows={5}
            value={syllabusRaw}
            onChange={(e) => setSyllabusRaw(e.target.value)}
            placeholder="Paste your course outline, chapters, weekly lecture topics, or prerequisites here... (Optional if an outline file is attached below)"
            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition font-mono"
          />
        </div>

        {/* File Upload: PDF, Word DOCX, Images */}
        <div>
          <label htmlFor="syllabus-file-input" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
            Attach Document or Image (.pdf, .doc, .docx, .png, .jpg, .jpeg)
          </label>
          <div className="relative border-2 border-dashed border-[var(--border)] hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-5 transition-colors text-center cursor-pointer bg-[var(--bg-card-hover)] hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20">
            <input
              id="syllabus-file-input"
              name="syllabus-file"
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              onChange={handleFileChange}
              aria-label="Upload syllabus document or image file (.pdf, .doc, .docx, .png, .jpg, .jpeg)"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-1.5 text-[var(--text-secondary)]">
              <div className="flex items-center gap-2 text-[var(--text-muted)]" aria-hidden="true">
                <FileText className="w-5 h-5" />
                <ImageIcon className="w-5 h-5" />
              </div>
              {attachedFile ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>{attachedFile.name} ({(attachedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAttachedFile(null);
                    }}
                    className="ml-1 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 p-0.5 rounded"
                    title="Remove file"
                    aria-label="Remove attached file"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    Click or drag & drop syllabus document or image
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Supported: PDF, Word (.doc, .docx), PNG, JPG up to 25 MB
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Assessment Pre-Generation Configuration: Question Count & Hardness Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="question-count-input" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Question Count
              </label>
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Min: 10, Max: 50</span>
            </div>
            <input
              id="question-count-input"
              name="question-count"
              type="number"
              min={10}
              max={50}
              required
              value={questionCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val)) {
                  setQuestionCount('');
                } else {
                  setQuestionCount(Math.min(50, Math.max(1, val)));
                }
              }}
              onBlur={() => {
                const num = Number(questionCount);
                if (!num || num < 10) setQuestionCount(10);
                else if (num > 50) setQuestionCount(50);
              }}
              aria-label="Question Count: Number of questions per module, min 10, max 50"
              placeholder="e.g. 15 (10-50 questions)"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-semibold text-[var(--text-primary)] placeholder-[var(--text-muted)] transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="hardness-level-select" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Hardness Level
              </label>
              <span className="text-[11px] text-[var(--text-muted)] font-medium">Cognitive Tier</span>
            </div>
            <select
              id="hardness-level-select"
              name="hardness-level"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              aria-label="Hardness Level: Select assessment difficulty tier"
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-semibold text-[var(--text-primary)] transition cursor-pointer"
            >
              <option value="easy">Easy (High School level)</option>
              <option value="medium">Medium (College level)</option>
              <option value="hard">Hard (Competitive Exam level, prompting the AI for deep reasoning and critical thinking questions)</option>
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:opacity-95 shadow-md shadow-indigo-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Analyzing Document & Structuring Curriculum...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Generate Course & Learning Modules</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

