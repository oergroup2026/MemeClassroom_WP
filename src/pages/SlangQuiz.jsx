import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  collection, query, where, onSnapshot, doc, runTransaction, increment, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { SLANG_QUIZ_QUESTIONS } from "../data/slangQuizQuestions";

const QUESTIONS_PER_ATTEMPT = 10;
const PASS_THRESHOLD = 70;
const BADGE_NAME = "Slang Master";

// Mirrors Profile.jsx's calculateLevel()/LEVEL_NAMES exactly — the "Slang
// Master" badge is awarded through the same generic, multi-level
// progression system as "Resource Sharer", "Meme Creator", etc. (Bronze at
// 1 quiz, Silver at 5, Gold at 10, Platinum at 25, Diamond at 50), driven
// off the `slang_quizzes_completed` counter in `user_stats` rather than a
// bespoke single-tier badge. Profile.jsx's checkAndAwardBadges effect is
// what actually writes the badge doc (next time the user opens /profile).
// Every completed attempt counts, whether or not it was a passing score.
const LEVEL_THRESHOLDS = [0, 1, 5, 10, 25, 50];
const LEVEL_NAMES = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const levelForCount = (count) => {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (count >= LEVEL_THRESHOLDS[i]) { level = i; break; }
  }
  return level;
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const resultMessage = (pct) => {
  if (pct >= 90) return { emoji: "🏆", title: "Slang Legend!", body: "You basically speak fluent internet. Teach the rest of us." };
  if (pct >= PASS_THRESHOLD) return { emoji: "🎉", title: "Nice one!", body: "You're fluent enough to survive the comments section." };
  if (pct >= 40) return { emoji: "💪", title: "Getting there!", body: "You caught a few — a bit more scrolling through the Slang Decoder and you'll have it." };
  return { emoji: "🌱", title: "Every legend starts somewhere.", body: "Head back to the Slang Decoder dictionary, then come try again." };
};

// ─── Slang Decoder Quiz ───────────────────────────────────────────────────────
// Modeled on MemeLiteracyTest.jsx's Firestore-first / local-fallback question
// loading and its per-question "explanation" phase (immediate correct/
// incorrect feedback + a plain-language explanation before moving on), kept
// intentionally simpler (single quiz, no multi-test launcher, no
// dimensions, no AI coaching). Badge progress is tracked via Profile.jsx's
// existing generic tiered-badge system (see LEVEL_THRESHOLDS above), not a
// bespoke single-tier award.
const SlangQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [firestoreQuestions, setFirestoreQuestions] = useState([]);
  const [phase, setPhase] = useState("intro"); // intro | quiz | explanation | results
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [newLevelName, setNewLevelName] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "slang_quiz_questions"), where("is_active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => setFirestoreQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Failed to load slang quiz questions:", err);
        setFirestoreQuestions([]);
      }
    );
    return () => unsub();
  }, []);

  // Pool merges Firestore-curated questions with the bundled local bank,
  // deduped by question text so admin edits don't create duplicates.
  const pool = useMemo(() => {
    const byText = new Map();
    [...firestoreQuestions, ...SLANG_QUIZ_QUESTIONS].forEach((q) => {
      const key = (q.question_text || "").trim().toLowerCase();
      if (key && !byText.has(key)) byText.set(key, q);
    });
    return Array.from(byText.values());
  }, [firestoreQuestions]);

  const startQuiz = useCallback(() => {
    const sample = shuffle(pool).slice(0, Math.min(QUESTIONS_PER_ATTEMPT, pool.length));
    setActiveQuestions(sample);
    setCurrentQ(0);
    setSelectedOption(null);
    setLastAnswerCorrect(null);
    setAnswers([]);
    setNewLevelName(null);
    setPhase("quiz");
  }, [pool]);

  const question = activeQuestions[currentQ];

  const computeScore = (allAnswers) => {
    const correct = allAnswers.filter((a) => a.isCorrect).length;
    const pct = activeQuestions.length > 0 ? Math.round((correct / activeQuestions.length) * 100) : 0;
    return { correct, pct };
  };

  const saveResult = async (allAnswers) => {
    if (!user) return;
    try {
      const { correct, pct } = computeScore(allAnswers);
      const passed = pct >= PASS_THRESHOLD;

      const resultsColRef = collection(db, "slang_quiz_results");
      const statsRef = doc(db, "user_stats", user.uid);
      let leveledUpTo = null;

      await runTransaction(db, async (tx) => {
        const statsSnap = await tx.get(statsRef);
        const newResultRef = doc(resultsColRef);
        tx.set(newResultRef, {
          user_id: user.uid,
          score_pct: pct,
          correct_count: correct,
          total_questions: activeQuestions.length,
          passed,
          completed_at: serverTimestamp(),
        });

        // Every completed attempt counts toward the Slang Master badge,
        // whether or not it was a passing score.
        if (statsSnap.exists()) {
          const oldCount = statsSnap.data().slang_quizzes_completed || 0;
          tx.update(statsRef, { slang_quizzes_completed: increment(1) });
          const oldLevel = levelForCount(oldCount);
          const newLevel = levelForCount(oldCount + 1);
          if (newLevel > oldLevel) leveledUpTo = LEVEL_NAMES[newLevel];
        }
      });

      if (leveledUpTo) setNewLevelName(leveledUpTo);
    } catch (err) {
      console.error("Failed to save slang quiz result:", err);
    }
  };

  const handleSelectAnswer = () => {
    if (selectedOption === null || !question) return;
    const isCorrect = selectedOption === question.correct_index;
    setLastAnswerCorrect(isCorrect);
    setAnswers((prev) => [...prev, { questionId: question.id, selected: selectedOption, isCorrect }]);
    setPhase("explanation");
  };

  const handleNextQuestion = () => {
    if (currentQ + 1 < activeQuestions.length) {
      setCurrentQ((i) => i + 1);
      setSelectedOption(null);
      setLastAnswerCorrect(null);
      setPhase("quiz");
    } else {
      saveResult(answers);
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
            Every quiz you complete counts toward your <strong>🏆 {BADGE_NAME}</strong> badge — the more you play, the higher you level up, from Bronze to Diamond.
          </p>
          <button
            onClick={startQuiz}
            disabled={pool.length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm px-8 py-3 rounded-xl transition inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Start Quiz
          </button>
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

          <button
            onClick={handleSelectAnswer}
            disabled={selectedOption === null}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition"
          >
            Check Answer
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
              <p className="text-xs text-gray-400">That attempt counts toward your {BADGE_NAME} badge. Check your profile to see your progress.</p>
            )
          ) : (
            <p className="text-xs text-gray-400">Sign in next time to save your result and work toward the {BADGE_NAME} badge.</p>
          )}

          {/* Prompt to keep going — the pool is large enough that another
              round is genuinely a fresh set of questions, not a repeat. */}
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 space-y-1">
            <p className="font-extrabold text-purple-800 dark:text-purple-300 text-sm">🔥 Keep the streak going!</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              There are {pool.length}+ words in the bank — round two will hit you with a fresh mix.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={startQuiz}
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
