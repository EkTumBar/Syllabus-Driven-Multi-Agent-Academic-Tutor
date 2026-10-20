import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  Award, 
  AlertTriangle,
  BookOpen,
  Check,
  RefreshCw,
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';

export const QuizPanel = ({ courseId, onExplainTopic }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [currentModuleId, setCurrentModuleId] = useState('');
  const [questionIndex, setQuestionIndex] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(1);
  const [selectedOption, setSelectedOption] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [generatingBank, setGeneratingBank] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState('');

  const fetchNextQuestion = async () => {
    setLoading(true);
    setError('');
    setEvaluation(null);
    setSelectedOption('');
    setCurrentQuestion(null);
    setBankSuccessMsg('');

    try {
      const response = await apiClient.get(`/courses/${courseId}/next-question`);
      const data = response.data;
      const payload = data?.payload;

      setCurrentModuleId(data?.current_module_id || '');

      if (payload && payload.questions && payload.questions.length > 0) {
        const q = payload.questions[0];
        setCurrentQuestion(q);
        setCurrentTopic(payload.topic || 'Current Module');
        setQuestionIndex(payload.question_index || 1);
        setTotalQuestions(payload.total_questions || payload.questions.length);
        setIsCompleted(false);
      } else if (payload?.type === 'completed' || data?.status === 'completed') {
        setIsCompleted(true);
      } else {
        setError('No active questions found. Generate a pre-stored question bank below to begin!');
      }
    } catch (err) {
      console.error('Error fetching question:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to load question. Please try again.';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchNextQuestion();
    }
  }, [courseId]);

  const handleSubmitAnswer = async () => {
    if (!selectedOption || !currentQuestion || submitting || evaluation !== null) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post(`/questions/${currentQuestion.id}/answer`, {
        answer_given: selectedOption,
        course_id: courseId
      });

      const payload = response.data?.payload;
      const evalData = payload?.evaluation || payload?.last_evaluation;
      if (evalData) {
        setEvaluation({
          ...evalData,
          remediate: Boolean(evalData.remediate || payload?.type === 'remediation'),
          guidance: payload?.guidance,
          review_excerpts: payload?.review_excerpts,
        });
      } else {
        setError('Unexpected response format from the server. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      const detailMsg = err.response?.data?.detail || err.message || 'Failed to submit answer. Please try again.';
      setError(detailMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateFreshBank = async (count = 25) => {
    if (!currentModuleId && !courseId) return;
    setGeneratingBank(true);
    setError('');
    setBankSuccessMsg('');

    try {
      // If we don't have moduleId yet, fetch course to get first module
      let modId = currentModuleId;
      if (!modId) {
        const cRes = await apiClient.get(`/courses/${courseId}`);
        const mods = cRes.data?.modules || [];
        if (mods.length > 0) {
          modId = mods[0].id;
          setCurrentModuleId(modId);
        }
      }

      if (!modId) {
        throw new Error('No modules found in course. Please create syllabus modules first.');
      }

      const res = await apiClient.post(`/courses/${courseId}/modules/${modId}/generate-questions?count=${count}`);
      setBankSuccessMsg(`Successfully pre-generated ${res.data?.count || count} unique questions! Starting exam...`);
      setIsCompleted(false);
      // Fetch fresh question
      setTimeout(() => {
        fetchNextQuestion();
      }, 800);
    } catch (err) {
      console.error('Failed to generate question bank:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to generate question bank. Please try again.');
    } finally {
      setGeneratingBank(false);
    }
  };

  const handleResetQuiz = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post(`/courses/${courseId}/reset-quiz`);
      setIsCompleted(false);
      fetchNextQuestion();
    } catch (err) {
      console.error('Failed to reset quiz progress:', err);
      setError(err.response?.data?.detail || 'Failed to reset quiz progress.');
      setLoading(false);
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'hard':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'medium':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center min-h-[380px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-800">Loading Exam Question...</p>
        <p className="text-xs text-slate-500 mt-1">Performing fast local lookup from pre-generated question bank</p>
      </div>
    );
  }

  // Completed State
  if (isCompleted) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900">Module Assessment Complete! 🎉</h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
            You have worked through all pre-generated questions in this module. You can retake this bank or generate a brand new set of unique questions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetQuiz}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Question Bank</span>
          </button>
          <button
            type="button"
            disabled={generatingBank}
            onClick={() => handleGenerateFreshBank(25)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
          >
            {generatingBank ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>Generate Fresh 25 MCQs (New Variations)</span>
          </button>
        </div>
      </div>
    );
  }

  // Error without question
  if (error && !currentQuestion) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-800">No Questions Found</h2>
        <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto">{error}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={fetchNextQuestion}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Retry
          </button>
          <button
            type="button"
            disabled={generatingBank}
            onClick={() => handleGenerateFreshBank(25)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          >
            {generatingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Pre-Generate 25 Question Bank</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round((questionIndex / Math.max(1, totalQuestions)) * 100));

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
      {/* NTA / JEE / NEET CBT Header */}
      <div className="pb-4 border-b border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold tracking-wider uppercase">
              CBT Exam Mode
            </span>
            <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {currentTopic}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentQuestion && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${getDifficultyColor(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty || 'Medium'}
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Question {questionIndex} of {totalQuestions}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div 
            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {bankSuccessMsg && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{bankSuccessMsg}</span>
        </div>
      )}

      {/* Question Stem */}
      {currentQuestion && (
        <div className="mt-5">
          <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
            {currentQuestion.question_text}
          </p>

          {/* Options */}
          <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Question choices">
            {currentQuestion.options_json?.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isEvaluated = evaluation !== null;

              let optionStyle = 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70 text-slate-700';

              if (isSelected && !isEvaluated) {
                optionStyle = 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-medium ring-2 ring-indigo-500/20';
              } else if (isEvaluated) {
                if (isSelected && evaluation.is_correct) {
                  optionStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                } else if (isSelected && !evaluation.is_correct) {
                  optionStyle = 'border-rose-500 bg-rose-50 text-rose-900 font-semibold';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isEvaluated || submitting}
                  onClick={() => setSelectedOption(option)}
                  className={`w-full p-4 rounded-xl border text-left text-sm transition flex items-center justify-between ${optionStyle}`}
                >
                  <span className="leading-snug">{option}</span>
                  {isSelected && !isEvaluated && (
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 ml-2" aria-hidden="true"></div>
                  )}
                  {isEvaluated && isSelected && evaluation.is_correct && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 ml-2" aria-hidden="true" />
                  )}
                  {isEvaluated && isSelected && !evaluation.is_correct && (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 ml-2" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Submission Error Banner */}
          {error && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={submitting}
                className="font-semibold text-rose-700 hover:text-rose-900 underline ml-auto text-xs shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Submit or Next Question Action */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={generatingBank}
              onClick={() => handleGenerateFreshBank(25)}
              className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition flex items-center gap-1.5"
              title="Pre-generate another unique batch of 25 questions"
            >
              {generatingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Generate Fresh Question Bank (25 MCQs)</span>
            </button>

            {!evaluation ? (
              <button
                type="button"
                disabled={!selectedOption || submitting}
                onClick={handleSubmitAnswer}
                aria-label="Submit Answer"
                className="w-full sm:w-auto ml-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={fetchNextQuestion}
                aria-label="Continue to Next Question"
                className="w-full sm:w-auto ml-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Continue to Next Question</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Evaluation Feedback Card */}
      {evaluation && (
        <div className={`mt-6 p-5 rounded-2xl border animate-in fade-in duration-150 ${
          evaluation.is_correct
            ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
            : 'bg-rose-50/70 border-rose-200/80 text-rose-950'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {evaluation.is_correct ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" aria-hidden="true" />
              )}
              <span className="font-bold text-sm">
                {evaluation.is_correct ? 'Correct! Well Done.' : 'Incorrect Response'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200/60 shadow-2xs">
              <Award className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
              <span>Mastery: {(evaluation.mastery_score * 100).toFixed(0)}%</span>
              <span className={evaluation.is_correct ? 'text-emerald-600' : 'text-rose-600'}>
                ({evaluation.score_change > 0 ? `+${evaluation.score_change}` : evaluation.score_change})
              </span>
            </div>
          </div>

          <div className="mt-2 text-xs sm:text-sm text-slate-700 leading-relaxed bg-white/70 p-3.5 rounded-xl border border-slate-200/50">
            <strong className="block text-slate-900 font-semibold mb-1">Detailed Academic Explanation:</strong>
            {evaluation.explanation || evaluation.feedback || currentQuestion?.explanation}
          </div>

          {/* Remediation Callout Banner */}
          {evaluation.remediate && (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-100/80 border border-amber-300/80 flex items-start justify-between gap-3 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <span className="font-bold">Adaptive Remediation Triggered:</span>
                  <p className="mt-0.5 text-amber-800">
                    You encountered difficulty with this topic. We recommend reviewing foundational concepts before proceeding.
                  </p>
                </div>
              </div>

              {onExplainTopic && (
                <button
                  type="button"
                  onClick={() => onExplainTopic(currentQuestion?.question_text, currentTopic || 'this concept')}
                  aria-label="Explain Concept with Socratic AI Tutor"
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Explain Concept</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
