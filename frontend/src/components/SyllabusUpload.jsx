import React, { useState } from 'react';
import apiClient from '../api/client';
import { Upload, FileText, Sparkles, Loader2, CheckCircle2, AlertCircle, Plus, Image as ImageIcon, X } from 'lucide-react';

export const SyllabusUpload = ({ onCourseCreated }) => {
  const [title, setTitle] = useState('');
  const [syllabusRaw, setSyllabusRaw] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
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

    setLoading(true);
    setError('');
    setStatusMessage('Planner Agent is structuring your curriculum modules with Gemini...');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (syllabusRaw.trim()) {
        formData.append('syllabus_raw', syllabusRaw.trim());
      }
      if (attachedFile) {
        formData.append('file', attachedFile);
      }

      // Create course and trigger Planner Agent with multimodal file support
      const courseResponse = await apiClient.post('/courses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const createdCourse = courseResponse.data;

      setStatusMessage('Course successfully created!');
      setTitle('');
      setSyllabusRaw('');
      setAttachedFile(null);

      if (onCourseCreated) {
        onCourseCreated(createdCourse);
      }
    } catch (err) {
      console.error('Course creation error:', err);
      setError(err.response?.data?.detail || 'Failed to create course. Please verify your connection.');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Create New Course</h2>
            <p className="text-xs text-slate-500">
              Paste your syllabus or upload a document/image (.pdf, .doc, .docx, .png, .jpg).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFillSample}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 px-3 py-1.5 rounded-lg border border-indigo-200/60 transition-colors"
        >
          Load Sample Syllabus
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200/70 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {statusMessage && (
        <div className="mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200/70 flex items-center gap-2 text-indigo-700 text-sm animate-pulse">
          <Sparkles className="w-4 h-4 shrink-0 text-indigo-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Course Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Course Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Organic Chemistry II or CS229 Machine Learning"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-800 transition"
          />
        </div>

        {/* Syllabus Text (Optional if file attached) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Syllabus Content or Topic Breakdown
            </label>
            <span className="text-[11px] text-slate-400 font-medium">
              {attachedFile ? 'Optional (file attached)' : 'Required if no file uploaded'}
            </span>
          </div>
          <textarea
            rows={5}
            value={syllabusRaw}
            onChange={(e) => setSyllabusRaw(e.target.value)}
            placeholder="Paste your course outline, chapters, weekly lecture topics, or prerequisites here... (Optional if an outline file is attached below)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-800 transition font-mono"
          />
        </div>

        {/* File Upload: PDF, Word DOCX, Images */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Attach Document or Image (.pdf, .doc, .docx, .png, .jpg, .jpeg)
          </label>
          <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-5 transition-colors text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center gap-1.5 text-slate-600">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText className="w-5 h-5" />
                <ImageIcon className="w-5 h-5" />
              </div>
              {attachedFile ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{attachedFile.name} ({(attachedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAttachedFile(null);
                    }}
                    className="ml-1 text-slate-400 hover:text-rose-600"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-medium text-slate-700">
                    Click or drag & drop syllabus document or image
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Supported: PDF, Word (.doc, .docx), PNG, JPG up to 25 MB
                  </span>
                </>
              )}
            </div>
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
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Document & Structuring Curriculum...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Course & Learning Modules</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
