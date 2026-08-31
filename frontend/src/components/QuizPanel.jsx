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
  const [selectedOption, setSelectedOption] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');

  const fetchNextQuestion = async () => {
    setLoading(true);
    setError('');
    setEvaluation(null);
    setSelectedOption('');

    try {
      const response = await apiClient.get(`/courses/${courseId}/next-question`);
      const payload = response.data?.payload;

      if (payload && payload.questions && payload.questions.length > 0) {
        setCurrentQuestion(payload.questions[0]);
      } else {
        setError('No active questions found for this module. Try creating another module or uploading syllabus.');
      }
    } catch (err) {
      console.error('Error fetching question:', err);
      setError(err.response?.data?.detail || 'Failed to load question. Please try again.');
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
    if (!selectedOption || !currentQuestion) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post(`/questions/${currentQuestion.id}/answer`, {
        answer_given: selectedOption,
        course_id: courseId
      });

      const payload = response.data?.payload;
      if (payload?.evaluation) {
        setEvaluation(payload.evaluation);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
      setError(err.response?.data?.detail || 'Failed to submit answer.');
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
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-800">Examiner Agent Generating Calibrated Question...</p>
        <p className="text-xs text-slate-400 mt-1">Retrieving lecture context and evaluating your mastery curve</p>
      </div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Quiz Generation Notice</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">{error}</p>
        <button
          onClick={fetchNextQuestion}
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
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Adaptive Assessment</h3>
            <p className="text-xs text-slate-400">Dynamic difficulty calibrated by Gemini</p>
          </div>
        </div>

        {currentQuestion && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${getDifficultyColor(currentQuestion.difficulty)}`}>
            {currentQuestion.difficulty || 'Medium'} Difficulty
          </span>
        )}
      </div>

      {/* Question Stem */}
      {currentQuestion && (
        <div className="mt-6">
          <p className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
            {currentQuestion.question_text}
          </p>

          {/* Options */}
          <div className="mt-5 space-y-2.5">
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
                  disabled={isEvaluated || submitting}
                  onClick={() => setSelectedOption(option)}
                  className={`w-full p-4 rounded-xl border text-left text-sm transition flex items-center justify-between ${optionStyle}`}
                >
                  <span>{option}</span>
                  {isSelected && !isEvaluated && (
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                  )}
                  {isEvaluated && isSelected && evaluation.is_correct && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  {isEvaluated && isSelected && !evaluation.is_correct && (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Submit or Next Question Action */}
          <div className="mt-6 flex items-center justify-between">
            {!evaluation ? (
              <button
                type="button"
                disabled={!selectedOption || submitting}
                onClick={handleSubmitAnswer}
                className="w-full sm:w-auto ml-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Grading with Evaluator...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Answer</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={fetchNextQuestion}
                className="w-full sm:w-auto ml-auto px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Continue to Next Question</span>
                <ArrowRight className="w-4 h-4" />
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
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="font-bold text-sm">
                {evaluation.is_correct ? 'Correct! Well Done.' : 'Incorrect Response'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200/60 shadow-2xs">
              <Award className="w-3.5 h-3.5 text-indigo-600" />
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
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
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
                  className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
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
