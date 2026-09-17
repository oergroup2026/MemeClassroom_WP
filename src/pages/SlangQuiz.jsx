import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { SLANG_QUIZ_QUESTIONS } from "../data/slangQuizQuestions";

const QUESTIONS_PER_ATTEMPT = 10;
const PASS_THRESHOLD = 70;
const BADGE_NAME = "Slang Master";
const BADGE_ICON = "🏆";

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
// loading and its badge-award-into-`badges` pattern, kept intentionally
// simpler (single quiz, no multi-test launcher, no dimensions).
const SlangQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [firestoreQuestions, setFirestoreQuestions] = useState([]);
  const [phase, setPhase] = useState("intro"); // intro | quiz | results
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [badgeJustEarned, setBadgeJustEarned] = useState(false);

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
    setAnswers([]);
    setBadgeJustEarned(false);
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
      await addDoc(collection(db, "slang_quiz_results"), {
        user_id: user.uid,
        score_pct: pct,
        correct_count: correct,
        total_questions: activeQuestions.length,
        passed,
        completed_at: serverTimestamp(),
      });

      if (passed) {
        const badgeQ = query(
          collection(db, "badges"),
          where("user_id", "==", user.uid),
          where("badge_name", "==", BADGE_NAME)
        );
        const badgeSnap = await getDocs(badgeQ);
        if (badgeSnap.empty) {
          await addDoc(collection(db, "badges"), {
            user_id: user.uid,
            category: "slang",
            level: 1,
            badge_name: BADGE_NAME,
            badge_icon: BADGE_ICON,
            description: `Passed the Slang Decoder quiz with ${pct}% score`,
            awarded_at: serverTimestamp(),
          });
          const badgeDetails = {
            title: "you earned a badge",
            badgeName: BADGE_NAME,
            description: `Passed the Slang Decoder quiz with ${pct}% score`,
          };
          sessionStorage.setItem("mc_pending_badge_popup", JSON.stringify(badgeDetails));
          window.dispatchEvent(new CustomEvent("mc_badge_earned", { detail: badgeDetails }));
          setBadgeJustEarned(true);
        }
      }
    } catch (err) {
      console.error("Failed to save slang quiz result:", err);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || !question) return;
    const isCorrect = selectedOption === question.correct_index;
    const nextAnswers = [...answers, { questionId: question.id, selected: selectedOption, isCorrect }];
    setAnswers(nextAnswers);

    if (currentQ + 1 < activeQuestions.length) {
      setCurrentQ((i) => i + 1);
      setSelectedOption(null);
    } else {
      saveResult(nextAnswers);
      setPhase("results");
    }
  };

  const { correct, pct } = computeScore(answers);
  const msg = resultMessage(pct);
  const passed = pct >= PASS_THRESHOLD;

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
            Score {PASS_THRESHOLD}% or higher to earn the <strong>{BADGE_ICON} {BADGE_NAME}</strong> badge.
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
            onClick={handleSubmitAnswer}
            disabled={selectedOption === null}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition"
          >
            {currentQ + 1 < activeQuestions.length ? "Next Question →" : "Finish Quiz"}
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
            passed && badgeJustEarned ? (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <p className="font-extrabold text-amber-800 dark:text-amber-300">🏅 Badge Unlocked: {BADGE_NAME}!</p>
              </div>
            ) : passed ? (
              <p className="text-xs text-gray-400">You've already earned the {BADGE_NAME} badge — nice consistency!</p>
            ) : (
              <p className="text-xs text-gray-400">Score {PASS_THRESHOLD}%+ to earn the {BADGE_ICON} {BADGE_NAME} badge.</p>
            )
          ) : (
            <p className="text-xs text-gray-400">Sign in next time to save your result and earn the {BADGE_NAME} badge.</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={startQuiz}
              className="flex-1 py-3 rounded-xl font-bold text-sm border-2 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-purple-300 transition"
            >
              🔁 Try Another 10
            </button>
            <Link
              to="/resources?tab=slang"
              className="flex-1 py-3 rounded-xl font-bold text-sm text-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md transition hover:-translate-y-0.5"
            >
              Back to Slang Decoder →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlangQuiz;
