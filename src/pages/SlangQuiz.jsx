import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { startQuiz as startServerQuiz, answerQuestion, finishQuiz } from "../utils/quizApi";

const QUESTIONS_PER_ATTEMPT = 10;
const PASS_THRESHOLD = 70;
const BADGE_NAME = "Slang Master";
// Must match SLANG_COUNTED_PER_DAY in functions/quizLogic.js.
const COUNTED_PER_DAY = 3;

const resultMessage = (pct) => {
  if (pct >= 90) return { emoji: "🏆", title: "Slang Legend!", body: "You basically speak fluent internet. Teach the rest of us." };
  if (pct >= PASS_THRESHOLD) return { emoji: "🎉", title: "Nice one!", body: "You're fluent enough to survive the comments section." };
  if (pct >= 40) return { emoji: "💪", title: "Getting there!", body: "You caught a few — a bit more scrolling through the Slang Decoder and you'll have it." };
  return { emoji: "🌱", title: "Every legend starts somewhere.", body: "Head back to the Slang Decoder dictionary, then come try again." };
};

// ─── Slang Decoder Quiz ───────────────────────────────────────────────────────
// Graded on the server (functions/quizzes.js), like MemeLiteracyTest.jsx: the
// browser gets 10 random questions without answers, learns each answer only
// after locking in a choice, and the server scores the attempt. A passed quiz
// counts toward the tiered Slang Master badge (Bronze at 1 … Diamond at 50),
// at most 3 a day; the server bumps user_stats.slang_quizzes_completed and the
// badge follows from that (derivedData.js syncBadges).
const SlangQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState("intro"); // intro | quiz | explanation | results
  const [attemptId, setAttemptId] = useState(null);
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [newLevelName, setNewLevelName] = useState(null);
  const [counted, setCounted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startQuiz = async () => {
    setBusy(true);
    setError("");
    try {
      const { attemptId: id, questions } = await startServerQuiz("slang");
      if (!questions.length) { setError("No quiz questions are available right now."); return; }
      setAttemptId(id);
      setActiveQuestions(questions);
      setCurrentQ(0);
      setSelectedOption(null);
      setLastAnswerCorrect(null);
      setAnswers([]);
      setNewLevelName(null);
      setCounted(null);
      setPhase("quiz");
    } catch (err) {
      console.error("Failed to start slang quiz:", err);
      setError("Could not load the quiz. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const question = activeQuestions[currentQ];

  const computeScore = (allAnswers) => {
    const correct = allAnswers.filter((a) => a.isCorrect).length;
    const pct = activeQuestions.length > 0 ? Math.round((correct / activeQuestions.length) * 100) : 0;
    return { correct, pct };
  };

  const saveResult = async () => {
    try {
      const result = await finishQuiz(attemptId);
      setCounted(result.saved ? result.slang_counted : null);
      if (result.slang_new_level) setNewLevelName(result.slang_new_level);
    } catch (err) {
      console.error("Failed to save slang quiz result:", err);
    }
  };

  const handleSelectAnswer = async () => {
    if (selectedOption === null || !question || busy) return;
    setBusy(true);
    setError("");
    try {
      // The answer and explanation are only revealed once the choice is locked in.
      const verdict = await answerQuestion(attemptId, currentQ, selectedOption);
      setActiveQuestions((qs) => qs.map((q, i) => (i === currentQ ? { ...q, correct_index: verdict.correct_index, explanation: verdict.explanation } : q)));
      setSelectedOption(verdict.selected);
      setLastAnswerCorrect(verdict.isCorrect);
      setAnswers((prev) => [...prev, { questionId: question.id, selected: verdict.selected, isCorrect: verdict.isCorrect }]);
      setPhase("explanation");
    } catch (err) {
      console.error("Failed to check answer:", err);
      setError("Could not check your answer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQ + 1 < activeQuestions.length) {
      setCurrentQ((i) => i + 1);
      setSelectedOption(null);
      setLastAnswerCorrect(null);
      setPhase("quiz");
    } else {
      saveResult();
      setPhase("results");
    }
  };

  const { correct, pct } = computeScore(answers);
  const msg = resultMessage(pct);

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <button
        onClick={() => navigate("/resources?tab=slang")}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Slang Decoder
      </button>

      {phase === "intro" && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <span className="text-5xl">🗣️</span>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Slang Decoder Quiz</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto">
            {QUESTIONS_PER_ATTEMPT} random questions pulled from a growing question bank — no two attempts are quite the same.
            Every quiz you pass ({PASS_THRESHOLD}%+, up to {COUNTED_PER_DAY} a day) counts toward your <strong>🏆 {BADGE_NAME}</strong> badge — the more you pass, the higher you level up, from Bronze to Diamond.
          </p>
          <button
            onClick={startQuiz}
            disabled={busy}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm px-8 py-3 rounded-xl transition inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Start Quiz
          </button>
          {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
          {!user && (
            <p className="text-xs text-gray-400">Sign in to save your result and earn the badge.</p>
          )}
        </div>
      )}

      {phase === "quiz" && question && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400">
            <span>Question {currentQ + 1} of {activeQuestions.length}</span>
            <span className="uppercase tracking-wider">{question.category}</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${((currentQ) / activeQuestions.length) * 100}%` }}
            />
          </div>

          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white leading-snug">
            {question.question_text}
          </h2>

          <div className="space-y-2.5">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-semibold transition ${
                  selectedOption === idx
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                    : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-purple-300"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
          <button
            onClick={handleSelectAnswer}
            disabled={selectedOption === null || busy}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition"
          >
            {busy ? "Checking…" : "Check Answer"}
          </button>
        </div>
      )}

      {phase === "explanation" && question && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between text-xs font-bold text-gray-400">
            <span>Question {currentQ + 1} of {activeQuestions.length}</span>
            <span className="uppercase tracking-wider">{question.category}</span>
          </div>

          {lastAnswerCorrect ? (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-2.5 rounded-xl text-sm font-bold">
              ✅ Correct!
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-xl text-sm font-bold">
              ❌ Not quite
            </div>
          )}

          <h2 className="text-lg font-extrabold text-gray-900 dark:text-white leading-snug">
            {question.question_text}
          </h2>

          <div className="space-y-2.5">
            {question.options.map((opt, idx) => {
              const isCorrectOpt = idx === question.correct_index;
              const isSelectedWrong = idx === selectedOption && !isCorrectOpt;
              return (
                <div
                  key={idx}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-semibold flex items-center justify-between ${
                    isCorrectOpt
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300"
                      : isSelectedWrong
                        ? "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400"
                  }`}
                >
                  <span>{opt}</span>
                  {isCorrectOpt && <span>✓</span>}
                  {isSelectedWrong && <span>✗</span>}
                </div>
              );
            })}
          </div>

          {question.explanation && (
            <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📖 Explanation</p>
              <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{question.explanation}</p>
            </div>
          )}

          <button
            onClick={handleNextQuestion}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm py-3 rounded-xl transition"
          >
            {currentQ + 1 < activeQuestions.length ? "Next Question →" : "See My Results"}
          </button>
        </div>
      )}

      {phase === "results" && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <span className="text-5xl">{msg.emoji}</span>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{msg.title}</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md mx-auto">{msg.body}</p>

          <div className="flex items-center justify-center gap-6 py-4">
            <div>
              <p className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">{pct}%</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Score</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-800 dark:text-zinc-200 tabular-nums">{correct}/{activeQuestions.length}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Correct</p>
            </div>
          </div>

          {user ? (
            newLevelName ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <p className="font-extrabold text-amber-800 dark:text-amber-300">🏅 New Badge: {newLevelName} {BADGE_NAME}!</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                {counted === true && `That pass counts toward your ${BADGE_NAME} badge. Check your profile to see your progress.`}
                {counted === false && pct >= PASS_THRESHOLD && `You've already had ${COUNTED_PER_DAY} passes count toward ${BADGE_NAME} today — come back tomorrow to level up.`}
                {counted === false && pct < PASS_THRESHOLD && `Score ${PASS_THRESHOLD}% or more to count toward your ${BADGE_NAME} badge.`}
              </p>
            )
          ) : (
            <p className="text-xs text-gray-400">Sign in next time to save your result and work toward the {BADGE_NAME} badge.</p>
          )}

          {/* Prompt to keep going — the pool is large enough that another
              round is genuinely a fresh set of questions, not a repeat. */}
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 space-y-1">
            <p className="font-extrabold text-purple-800 dark:text-purple-300 text-sm">🔥 Keep the streak going!</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              The question bank is big — round two will hit you with a fresh mix.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={startQuiz}
              disabled={busy}
              autoFocus
              className="flex-1 py-3.5 rounded-xl font-bold text-sm text-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md transition hover:-translate-y-0.5"
            >
              🔁 Take Another Round
            </button>
            <Link
              to="/resources?tab=slang"
              className="flex-1 py-3.5 rounded-xl font-bold text-sm text-center border-2 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-purple-300 transition"
            >
              Back to Slang Decoder
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlangQuiz;
