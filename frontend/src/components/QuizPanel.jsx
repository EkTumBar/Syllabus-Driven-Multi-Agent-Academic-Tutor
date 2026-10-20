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
  BookOpen
} from 'lucide-react';

export const QuizPanel = ({ courseId, onExplainTopic }) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentTopic, setCurrentTopic] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');
  const [contextWarning, setContextWarning] = useState(false);

  const fetchNextQuestion = async () => {
    setLoading(true);
    setError('');
    setEvaluation(null);
    setSelectedOption('');
    setCurrentQuestion(null); // clear stale question immediately so spinner shows
    setContextWarning(false);

    try {
      const response = await apiClient.get(`/courses/${courseId}/next-question`);
      const data = response.data;
      const payload = data?.payload;

      if (payload && payload.questions && payload.questions.length > 0) {
        const q = payload.questions[0];
        setCurrentQuestion(q);
        setCurrentTopic(payload.topic || data?.current_module_id || '');

        // Detect fallback question: explanation mentions AI could not use context
        const explanation = q.explanation || '';
        if (explanation.includes('Fallback question') || explanation.includes('could not generate a context-specific')) {
          setContextWarning(true);
        }
      } else {
        setError('No active questions found for this module. Try creating another module or uploading syllabus content.');
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
        setError('Received an unexpected response format from the tutor. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      const detailMsg = err.response?.data?.detail || err.message || 'Failed to submit answer. Please try again.';
      setError(detailMsg);
    } finally {
      setSubmitting(false);
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
        <p className="text-sm font-semibold text-slate-800">Examiner Agent Generating Calibrated Question...</p>
        <p className="text-xs text-slate-600 mt-1">Retrieving lecture context and evaluating your mastery curve</p>
      </div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-800">Quiz Generation Notice</h2>
        <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto">{error}</p>
        <button
          type="button"
          onClick={fetchNextQuestion}
          aria-label="Retry quiz question generation"
          className="mt-5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
      {/* Header Info */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600" aria-hidden="true">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Adaptive Assessment</h2>
            <p className="text-xs text-slate-600">
              {currentTopic ? `Topic: ${currentTopic}` : 'Dynamic difficulty calibrated by Gemini'}
            </p>
          </div>
        </div>

        {currentQuestion && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${getDifficultyColor(currentQuestion.difficulty)}`}>
            {currentQuestion.difficulty || 'Medium'} Difficulty
          </span>
        )}
      </div>

      {/* Context Warning Banner — shown when PDF context was unavailable */}
      {contextWarning && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            <strong>No PDF context found for this topic.</strong> The question above is a generic placeholder.
            Please ensure your course PDF was uploaded and indexed when creating the course.
          </span>
        </div>
      )}

      {/* Question Stem */}
      {currentQuestion && (
        <div className="mt-6">
          <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
            {currentQuestion.question_text}
          </p>

          {/* Options */}
          <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Question answer choices">
            {currentQuestion.options_json?.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isEvaluated = evaluation !== null;
              const isCorrectOption = option === currentQuestion.correct_answer || (evaluation && evaluation.is_correct && isSelected);

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
                  <span>{option}</span>
                  {isSelected && !isEvaluated && (
                    <div className="w-2 h-2 rounded-full bg-indigo-600" aria-hidden="true"></div>
                  )}
                  {isEvaluated && isSelected && evaluation.is_correct && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                  )}
                  {isEvaluated && isSelected && !evaluation.is_correct && (
                    <XCircle className="w-5 h-5 text-rose-600" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Submission Error Banner */}
          {error && (
            <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shadow-2xs">
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
          <div className="mt-6 flex items-center justify-between">
            {!evaluation ? (
              <button
                type="button"
                disabled={!selectedOption || submitting}
                onClick={handleSubmitAnswer}
                aria-label="Submit Answer"
                className="w-full sm:w-auto ml-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    <span>Grading with Evaluator...</span>
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
        <div className={`mt-6 p-5 rounded-2xl border ${
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

          <p className="text-xs sm:text-sm text-slate-700 mt-2 leading-relaxed">
            {evaluation.feedback || currentQuestion?.explanation}
          </p>

          {/* Remediation Callout Banner */}
          {evaluation.remediate && (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-100/80 border border-amber-300/80 flex items-start justify-between gap-3 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <span className="font-bold">Adaptive Remediation Triggered:</span>
                  <p className="mt-0.5 text-amber-800">
                    You encountered difficulty with this topic. We recommend reviewing the foundational concepts before proceeding.
                  </p>
                </div>
              </div>

              {onExplainTopic && (
                <button
                  type="button"
                  onClick={() => onExplainTopic(currentQuestion?.question_text, currentQuestion?.topic || 'this concept')}
                  aria-label="Explain Concept with Socratic AI Tutor"
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs flex items-center gap-1.5"
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
