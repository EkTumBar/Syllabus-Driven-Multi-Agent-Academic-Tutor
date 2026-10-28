import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api/client';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  Award, 
  AlertTriangle,
  Layers,
  ChevronRight,
  HelpCircle,
  FileQuestion,
  Send
} from 'lucide-react';

/**
 * Normalizes different AI-generated or database question option shapes:
 * - Array of strings: ["A. Option 1", "B. Option 2", ...]
 * - JSON-encoded string: '["A. Option 1", "B. Option 2"]'
 * - Object with letter keys: { "A": "...", "B": "..." }
 */
const getNormalizedOptions = (question) => {
  if (!question) return [];
  const raw = question?.options_json ?? question?.options ?? question?.choices;

  if (Array.isArray(raw)) {
    return raw.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === 'string' ? item : String(item)));
      }
    } catch {
      const splitLines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
      if (splitLines.length > 1) return splitLines;
    }
  }

  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw).map(([k, v]) => `${k}. ${v}`);
  }

  return [];
};

/**
 * Safely extracts question stem across various schema conventions
 */
const getQuestionStem = (question) => {
  if (!question) return '';
  return question?.question_text || question?.question || question?.stem || question?.title || 'Assessment Question';
};

/**
 * Helper to normalize an answer or choice for matching.
 * Handles "A. Binary Search", "A) Binary Search", "(A) Binary Search", "A", or plain text.
 */
const normalizeAnswerKey = (str) => {
  if (!str) return { letter: '', text: '' };
  const trimmed = String(str).trim();
  const match = trimmed.match(/^[\(\[]?([A-Da-d])[\)\]\.\:\s]+(.*)$/);
  if (match) {
    return {
      letter: match[1].toUpperCase(),
      text: match[2].trim().toLowerCase()
    };
  }
  if (/^[A-Da-d]$/i.test(trimmed)) {
    return {
      letter: trimmed.toUpperCase(),
      text: ''
    };
  }
  return {
    letter: '',
    text: trimmed.toLowerCase()
  };
};

/**
 * Robust evaluation check supporting exact match, letter prefix match, or option text match.
 * Prevents false positives where an option starting with a letter falsely matches another letter key.
 */
const checkAnswerMatch = (selected, correct) => {
  if (!selected || !correct) return false;
  const sStr = String(selected).trim();
  const cStr = String(correct).trim();

  // 1. Direct case-insensitive match
  if (sStr.toLowerCase() === cStr.toLowerCase()) return true;

  const sNorm = normalizeAnswerKey(sStr);
  const cNorm = normalizeAnswerKey(cStr);

  // 2. Both have identified letter keys (e.g. "A. Option" vs "A" or "A. Option")
  if (sNorm.letter && cNorm.letter) {
    return sNorm.letter === cNorm.letter;
  }

  // 3. One is pure letter key, other has letter extracted
  if (cNorm.letter && sNorm.letter) {
    return cNorm.letter === sNorm.letter;
  }

  // 4. Content text comparison ignoring letter prefixes
  if (sNorm.text && cNorm.text && sNorm.text === cNorm.text) {
    return true;
  }

  return false;
};

export const QuizPanel = ({ 
  courseId, 
  onExplainTopic, 
  modules = [], 
  activeModuleId = '', 
  onModuleSelect 
}) => {
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentModuleId, setCurrentModuleId] = useState(activeModuleId || '');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // STRICT MCQ FLOW STATE
  // Step 1: selectedOption is ONLY updated on option click (NO auto-validation)
  const [selectedOption, setSelectedOption] = useState('');
  // Step 3: evaluation is populated ONLY after explicit Submit click (null = unvalidated)
  const [evaluation, setEvaluation] = useState(null);
  const [submittedAnswers, setSubmittedAnswers] = useState([]);
  const [error, setError] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);

  // Ref cache for module questions to prevent render loops
  const questionsCache = useRef({});

  // Sync activeModuleId from props
  useEffect(() => {
    if (activeModuleId && activeModuleId !== currentModuleId) {
      setCurrentModuleId(activeModuleId);
      setIsInitializing(true);
      setCurrentIndex(0);
      setSelectedOption('');
      setEvaluation(null);
      setIsCompleted(false);
      setError('');
    } else if (!currentModuleId && Array.isArray(modules) && modules.length > 0) {
      setCurrentModuleId(modules[0]?.id || '');
    }
  }, [activeModuleId, modules, currentModuleId]);

  // Load questions and persistent user progress synchronously before rendering CBT card
  const loadQuestionsAndProgress = useCallback(async () => {
    if (!courseId || !currentModuleId) return;

    // Keep component in initializing state until BOTH questions and progress resolve
    setIsInitializing(true);
    setSelectedOption('');
    setEvaluation(null);
    setError('');

    // 1. Check memory cache or modules prop first
    let modQuestions = questionsCache.current[currentModuleId] || [];
    const matchingMod = Array.isArray(modules) ? modules.find((m) => m?.id === currentModuleId) : null;
    if (!modQuestions.length && Array.isArray(matchingMod?.questions) && matchingMod.questions.length > 0) {
      modQuestions = matchingMod.questions;
      questionsCache.current[currentModuleId] = modQuestions;
    }

    // 2. Fetch questions from backend if not cached
    if (!modQuestions.length) {
      setLoading(true);
      try {
        const res = await apiClient.get(`/courses/${courseId}/modules/${currentModuleId}/questions`);
        const qs = Array.isArray(res.data) ? res.data : [];
        if (qs.length > 0) {
          modQuestions = qs;
          questionsCache.current[currentModuleId] = qs;
        } else {
          // Fallback: check next-question route
          const nextRes = await apiClient.get(`/courses/${courseId}/next-question?module_id=${currentModuleId}`);
          const payload = nextRes.data?.payload;
          if (Array.isArray(payload?.questions) && payload.questions.length > 0) {
            modQuestions = payload.questions;
            questionsCache.current[currentModuleId] = modQuestions;
          } else if (payload?.type === 'completed' || nextRes.data?.status === 'completed') {
            setIsCompleted(true);
          }
        }
      } catch (err) {
        console.error('Error loading questions:', err);
        setError(err.response?.data?.detail || 'Failed to load assessment questions.');
      }
    }

    // 3. Load saved progress to resolve target question index BEFORE rendering
    let targetIndex = 0;
    let savedAnswers = [];
    let moduleFinished = false;

    try {
      const progRes = await apiClient.get(`/courses/${courseId}/progress?module_id=${currentModuleId}`);
      if (progRes.data) {
        const savedIndex = Number(progRes.data.current_question_index) || 0;
        savedAnswers = Array.isArray(progRes.data.answers_submitted) ? progRes.data.answers_submitted : [];

        if (savedIndex >= modQuestions.length && modQuestions.length > 0) {
          moduleFinished = true;
        } else if (savedIndex > 0 && modQuestions.length > 0 && savedIndex < modQuestions.length) {
          targetIndex = savedIndex;
        }
      }
    } catch (progErr) {
      // Fallback to index 0 silently
    }

    // Commit synchronized state simultaneously to eliminate any FOUC / Question 1 flash
    setQuestions(modQuestions);
    setSubmittedAnswers(savedAnswers);
    setCurrentIndex(targetIndex);
    if (moduleFinished) {
      setIsCompleted(true);
    }
    setIsInitializing(false);
    setLoading(false);
  }, [courseId, currentModuleId, modules]);

  useEffect(() => {
    loadQuestionsAndProgress();
  }, [loadQuestionsAndProgress]);

  /**
   * Fix for Bug 1 (Dead Refresh Button):
   * Invalidates the question cache for the current module, resets error and loading states,
   * and triggers loadQuestionsAndProgress to natively re-fetch questions.
   */
  const handleRefreshQuestions = () => {
    if (currentModuleId) {
      questionsCache.current[currentModuleId] = null;
    }
    setError('');
    setLoading(false);
    loadQuestionsAndProgress();
  };

  const currentQuestion = questions[currentIndex] || null;
  const totalQuestions = questions.length;
  const questionIndex = currentIndex + 1;
  const currentTopic = (Array.isArray(modules) && modules.find((m) => m?.id === currentModuleId)?.title) || 'Current Module';

  const handleSelectModuleTab = (modId) => {
    if (!modId || modId === currentModuleId) return;
    setCurrentModuleId(modId);
    setIsInitializing(true);
    setCurrentIndex(0);
    setSelectedOption('');
    setEvaluation(null);
    setIsCompleted(false);
    setError('');
    if (onModuleSelect) {
      onModuleSelect(modId);
    }
  };

  /**
   * STEP 1: Option Selection
   * ONLY updates selectedOption. Does NOT validate, does NOT submit.
   */
  const handleSelectOption = (option) => {
    // If already evaluated for this question, option selection is locked
    if (evaluation !== null) return;
    setSelectedOption(option);
    setError('');
  };

  /**
   * STEP 2 & 3: Explicit Submit & Instant Local Evaluation
   * Triggered ONLY when user explicitly clicks the "Submit" button.
   * Instantly evaluates against currentQuestion.correct_answer and shows UI (0ms).
   * Dispatches PUT /courses/{id}/progress and POST /questions/{id}/answer asynchronously in background.
   */
  const handleSubmitAnswer = () => {
    if (!selectedOption || !currentQuestion || evaluation !== null) return;

    const questionId = currentQuestion?.id;
    const correctAnswer = currentQuestion?.correct_answer || '';
    const isCorrect = checkAnswerMatch(selectedOption, correctAnswer);

    // Instant local evaluation
    const localEval = {
      is_correct: isCorrect,
      explanation: currentQuestion?.explanation || (isCorrect ? 'Correct! Excellent deduction.' : `Incorrect. The correct answer is: ${correctAnswer}`),
      mastery_score: isCorrect ? 0.85 : 0.45,
      score_change: isCorrect ? 0.05 : -0.05,
      remediate: !isCorrect,
      optimistic: true
    };

    setEvaluation(localEval);

    const updatedAnswers = [
      ...submittedAnswers,
      { question_id: questionId, answer_given: selectedOption, is_correct: isCorrect }
    ];
    setSubmittedAnswers(updatedAnswers);

    // Asynchronously persist progress in background (does not block user)
    if (courseId) {
      apiClient.put(`/courses/${courseId}/progress`, {
        module_id: currentModuleId,
        current_question_index: currentIndex,
        answers_submitted: updatedAnswers
      }).catch((progErr) => {
        console.warn('Background progress persistence notice:', progErr);
      });
    }

    // Asynchronously submit answer to backend agent in background
    if (questionId) {
      apiClient.post(`/questions/${questionId}/answer`, {
        answer_given: selectedOption,
        course_id: courseId
      }).then((response) => {
        const payload = response.data?.payload;
        const evalData = payload?.evaluation || payload?.last_evaluation;
        if (evalData) {
          setEvaluation((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              // Strictly preserve local validation determination to prevent UI flashing
              is_correct: isCorrect,
              remediate: Boolean(evalData.remediate || payload?.type === 'remediation' || !isCorrect),
              mastery_score: typeof evalData.mastery_score === 'number' ? evalData.mastery_score : prev.mastery_score,
              score_change: typeof evalData.score_change === 'number' ? evalData.score_change : prev.score_change,
              explanation: evalData.feedback || evalData.explanation || prev.explanation,
              guidance: payload?.guidance || prev?.guidance,
              review_excerpts: payload?.review_excerpts || prev?.review_excerpts,
              optimistic: false
            };
          });
        }
      }).catch((bgErr) => {
        console.warn('Background answer evaluation notice:', bgErr);
      });
    }
  };

  /**
   * STEP 4: Next Question
   * Appears ONLY after evaluation is populated (i.e. user has clicked Submit).
   * Resets selectedOption and evaluation, moves to next index, and updates DB.
   */
  const handleNextQuestion = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      setSelectedOption('');
      setEvaluation(null);
      setError('');

      if (courseId) {
        apiClient.put(`/courses/${courseId}/progress`, {
          module_id: currentModuleId,
          current_question_index: nextIndex,
          answers_submitted: submittedAnswers
        }).catch(() => {});
      }
    } else {
      setIsCompleted(true);
      if (courseId) {
        apiClient.put(`/courses/${courseId}/progress`, {
          module_id: currentModuleId,
          current_question_index: questions.length,
          answers_submitted: submittedAnswers
        }).catch(() => {});
      }
    }
  };

  const handleRetakeModule = () => {
    setCurrentIndex(0);
    setSelectedOption('');
    setEvaluation(null);
    setIsCompleted(false);
    setError('');
    setSubmittedAnswers([]);
    if (courseId) {
      apiClient.put(`/courses/${courseId}/progress`, {
        module_id: currentModuleId,
        current_question_index: 0,
        answers_submitted: []
      }).catch(() => {});
    }
  };

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'hard':
        return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'medium':
      default:
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
  };

  // Completed State Screen
  if (isCompleted && !loading && !isInitializing) {
    const currentModuleIdx = Array.isArray(modules) ? modules.findIndex((m) => m?.id === currentModuleId) : -1;
    const nextModule = currentModuleIdx >= 0 && currentModuleIdx + 1 < modules.length 
      ? modules[currentModuleIdx + 1] 
      : null;

    return (
      <div className="bg-[var(--bg-card)] rounded-2xl p-8 border border-[var(--border)] shadow-sm text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
          <Award className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">Module Assessment Complete! 🎉</h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 max-w-md mx-auto">
            You have completed all questions for this module. You can retake this assessment or advance to the next curriculum unit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
          <button
            type="button"
            onClick={() => handleRetakeModule()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Retake Module Assessment</span>
          </button>

          {nextModule && (
            <button
              type="button"
              onClick={() => handleSelectModuleTab(nextModule.id)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Next: {nextModule.title || 'Next Module'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Error without question and not loading
  if (error && !currentQuestion && !loading && !isInitializing) {
    return (
      <div className="bg-[var(--bg-card)] rounded-2xl p-8 border border-[var(--border)] shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h2 className="text-base font-bold text-[var(--text-primary)]">No Assessment Questions Found</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-md mx-auto">{error}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => handleRefreshQuestions()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Questions</span>
          </button>
        </div>
      </div>
    );
  }

  const currentOptions = getNormalizedOptions(currentQuestion);
  const questionStem = getQuestionStem(currentQuestion);
  const progressPercent = Math.min(100, Math.round((questionIndex / Math.max(1, totalQuestions)) * 100));
  const isEvaluated = evaluation !== null;

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-6 sm:p-8 border border-[var(--border)] shadow-sm space-y-4">
      {/* Module Navigation Tabs */}
      {Array.isArray(modules) && modules.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[var(--border)] text-xs">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
            <Layers className="w-3 h-3 text-indigo-500" />
            <span>Modules:</span>
          </span>
          {modules.map((m, idx) => {
            const isActive = m?.id === currentModuleId;
            return (
              <button
                key={m?.id || idx}
                type="button"
                onClick={() => handleSelectModuleTab(m?.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition text-xs flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-[var(--bg-card-hover)] hover:bg-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span>M{idx + 1}</span>
                <span className="truncate max-w-[120px]">{m?.title || `Module ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state overlay: waits for BOTH questions and saved question index */}
      {(loading || isInitializing) ? (
        <div className="p-12 text-center flex flex-col items-center justify-center min-h-[320px]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Loading Assessment Questions...</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Retrieving question bank and synchronizing saved progress...</p>
        </div>
      ) : (
        <>
          {/* CBT Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold tracking-wider uppercase">
                  CBT Assessment Mode
                </span>
                <span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[200px] sm:max-w-xs">
                  {currentTopic}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {currentQuestion && (
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${getDifficultyColor(currentQuestion.difficulty)}`}>
                    {currentQuestion.difficulty || 'Medium'}
                  </span>
                )}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border)]">
                  Question {questionIndex} of {totalQuestions}
                </span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-[var(--bg-card-hover)] rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Question Stem */}
          {currentQuestion && (
            <div>
              <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-relaxed">
                {questionStem}
              </p>

              {/* Options List */}
              <div className="mt-5 space-y-2.5" role="radiogroup" aria-label="Question choices">
                {currentOptions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs text-center">
                    No multiple-choice options formatted for this question.
                  </div>
                ) : (
                  currentOptions.map((option, idx) => {
                    const isSelected = selectedOption === option;

                    // STEP 1 STYLING: When unvalidated, only show selection highlight
                    let optionStyle = 'border-[var(--border)] hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)]';

                    if (isSelected && !isEvaluated) {
                      optionStyle = 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-medium ring-2 ring-indigo-500/20';
                    } else if (isEvaluated) {
                      // STEP 3 STYLING: Once submitted, show Correct (green) or Incorrect (red)
                      if (isSelected && evaluation.is_correct) {
                        optionStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-400';
                      } else if (isSelected && !evaluation.is_correct) {
                        optionStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold ring-1 ring-rose-400';
                      } else if (!evaluation.is_correct && checkAnswerMatch(option, currentQuestion.correct_answer)) {
                        // Reveal correct answer if student got it wrong
                        optionStyle = 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-medium border-dashed';
                      } else {
                        optionStyle = 'border-[var(--border)] opacity-60 text-[var(--text-muted)]';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={isEvaluated}
                        onClick={() => handleSelectOption(option)}
                        className={`w-full p-4 rounded-xl border text-left text-sm transition flex items-center justify-between cursor-pointer ${optionStyle}`}
                      >
                        <span className="leading-snug">{option}</span>

                        {/* Unvalidated radio selection indicator */}
                        {isSelected && !isEvaluated && (
                          <div className="w-3 h-3 rounded-full bg-indigo-600 shrink-0 ml-2" aria-hidden="true" />
                        )}

                        {/* Post-Submit validation icons */}
                        {isEvaluated && isSelected && evaluation.is_correct && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" aria-hidden="true" />
                        )}
                        {isEvaluated && isSelected && !evaluation.is_correct && (
                          <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 ml-2" aria-hidden="true" />
                        )}
                        {isEvaluated && !isSelected && checkAnswerMatch(option, currentQuestion.correct_answer) && (
                          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md ml-2 shrink-0">
                            Correct Key
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Submission Error Banner */}
              {error && (
                <div className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS: STEP 2 (Submit) vs STEP 4 (Next Question) */}
              <div className="mt-6 flex items-center justify-end pt-2 border-t border-[var(--border)]">
                {!isEvaluated ? (
                  /* Step 2: User MUST explicitly click Submit */
                  <button
                    type="button"
                    disabled={!selectedOption}
                    onClick={() => handleSubmitAnswer()}
                    aria-label="Submit Answer"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <span>Submit Answer</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                ) : (
                  /* Step 4: Next Question appears ONLY after Submit is clicked */
                  <button
                    type="button"
                    onClick={() => handleNextQuestion()}
                    aria-label="Next Question"
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 shadow-md transition flex items-center justify-center gap-2 cursor-pointer animate-in fade-in duration-150"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Evaluation Feedback Card (Rendered ONLY after user clicks Submit) */}
          {evaluation && (
            <div className={`mt-6 p-5 rounded-2xl border animate-in fade-in duration-200 ${
              evaluation.is_correct
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/90 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-200'
                : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/90 dark:border-rose-800/80 text-rose-950 dark:text-rose-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {evaluation.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  )}
                  <span className="font-bold text-sm">
                    {evaluation.is_correct ? 'Correct Answer! Great Job.' : 'Incorrect Response'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)] shadow-2xs">
                  <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  <span>
                    Mastery: {typeof evaluation.mastery_score === 'number' ? (evaluation.mastery_score * 100).toFixed(0) : '80'}%
                  </span>
                  {typeof evaluation.score_change === 'number' && (
                    <span className={evaluation.is_correct ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      ({evaluation.score_change > 0 ? `+${evaluation.score_change}` : evaluation.score_change})
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed bg-[var(--bg-card)] p-3.5 rounded-xl border border-[var(--border)]">
                <strong className="block text-[var(--text-primary)] font-semibold mb-1">Academic Explanation:</strong>
                {evaluation.explanation || evaluation.feedback || currentQuestion?.explanation || 'Verified against course syllabus keys.'}
              </div>

              {/* Remediation Callout Banner if question was incorrect */}
              {evaluation.remediate && (
                <div className="mt-4 p-3.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/70 flex items-start justify-between gap-3 text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-xs">
                      <span className="font-bold">Adaptive Remediation Available:</span>
                      <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                        Ask our Socratic AI Tutor to walk through this concept in detail.
                      </p>
                    </div>
                  </div>

                  {onExplainTopic && (
                    <button
                      type="button"
                      onClick={() => onExplainTopic(
                        questionStem, 
                        currentTopic || 'this concept',
                        evaluation.explanation || evaluation.feedback || currentQuestion?.explanation || ''
                      )}
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
        </>
      )}
    </div>
  );
};

export default QuizPanel;
