import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import {
  DIMENSIONS,
  DIMENSION_META,
  getLevel,
} from "../data/memeTestQuestions";
import { LOCAL_TESTS } from "../data/localTestCatalogue";
import { explainQuizMistake } from "../services/geminiClient";
import { startQuiz, answerQuestion, finishQuiz } from "../utils/quizApi";
import AiQuotaModal from "../components/AiQuotaModal";
import { useTour } from "../hooks/useTour";
import TourOverlay from "../components/TourOverlay";
import PageHelpPanel from "../components/PageHelpPanel";

// Option Button
const OptionButton = ({ text, index, mode, selected, isCorrect, isWrong, onClick }) => {
  const letter = ["A", "B", "C", "D"][index];
  let cls = "w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 text-sm flex items-start gap-3 font-medium";
  let lCls = "w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5";
  let trail = null;
  if (mode === "question") {
    if (selected) { cls += " border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 cursor-pointer"; lCls += " bg-purple-500 text-white"; }
    else { cls += " border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-purple-300 cursor-pointer"; lCls += " bg-gray-100 dark:bg-zinc-700 text-gray-500"; }
  } else {
    if (isCorrect) { cls += " border-green-500 bg-green-50 dark:bg-green-950/30 text-green-800 cursor-default"; lCls += " bg-green-500 text-white"; trail = <span className="ml-auto text-green-600 font-bold">&#x2713;</span>; }
    else if (isWrong) { cls += " border-red-400 bg-red-50 dark:bg-red-950/20 text-red-700 cursor-default"; lCls += " bg-red-400 text-white"; trail = <span className="ml-auto text-red-500 font-bold">&#x2717;</span>; }
    else { cls += " border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/40 text-gray-400 cursor-default"; lCls += " bg-gray-100 dark:bg-zinc-700 text-gray-400"; }
  }
  return (
    <button className={cls} onClick={onClick} disabled={mode === "explanation"}>
      <span className={lCls}>{letter}</span>
      <span className="leading-relaxed pt-0.5 flex-1">{text}</span>
      {trail}
    </button>
  );
};

// Meme Image
const MemeImage = ({ url, alt }) => {
  const [err, setErr] = useState(false);
  if (!url) return null;
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-black/5 dark:bg-zinc-900 mb-2">
      {!err
        ? <img src={url} alt={alt || "Meme"} onError={() => setErr(true)} className="w-full max-h-72 object-contain block mx-auto" />
        : <div className="flex flex-col items-center justify-center h-48"><span className="text-5xl mb-2">&#128444;</span><p className="text-sm text-gray-500">{alt}</p></div>
      }
    </div>
  );
};

// Progress Header
const ProgressHeader = ({ current, total, dimension, onBack }) => {
  const pct = Math.round((current / total) * 100);
  const meta = DIMENSION_META[dimension] || {};
  return (
    <div id="literacy-progress-header" className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors">&#8592; Exit Test</button>
        <span className="text-xs font-bold text-gray-500 tabular-nums">{current} / {total}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      {dimension && (
        <div className="mt-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${meta.pill || "bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"}`}>
            {meta.icon} {dimension}
          </span>
        </div>
      )}
    </div>
  );
};

// Test Launcher Card
const TestCard = ({ test, onClick }) => {
  const dc = { beginner: "bg-green-100 text-green-700", intermediate: "bg-blue-100 text-blue-700", advanced: "bg-orange-100 text-orange-700", expert: "bg-red-100 text-red-700" };
  return (
    <button onClick={onClick} className="group text-left w-full p-5 rounded-2xl border-2 border-gray-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{test.badge_icon || "&#129514;"}</span>
        <div className="flex-1">
          <h3 className="font-extrabold text-gray-900 dark:text-white text-sm group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">{test.title}</h3>
          {test.category && <p className="text-xs text-gray-400">{test.category}</p>}
        </div>
      </div>
      {test.description && <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3 line-clamp-2 leading-relaxed">{test.description}</p>}
      <div className="flex flex-wrap gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${dc[test.difficulty] || dc.beginner}`}>{test.difficulty}</span>
        <span className="text-[10px] text-gray-400">{test.question_count || "?"} questions</span>
        <span className="text-[10px] text-gray-400">Pass: {test.pass_threshold || 60}%</span>
        {test.badge_label && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{test.badge_icon} {test.badge_label}</span>}
      </div>
      <p className="mt-3 text-xs font-bold text-purple-600 dark:text-purple-400">Start Test &#8594;</p>
    </button>
  );
};

// Results Phase
const ResultsPhase = ({ overallPct, dimPcts, totalCorrect, totalQuestions, activeDimensions, testMeta, onRestart, resultSaved }) => {
  const [vis, setVis] = useState(false);
  const level = getLevel(overallPct);
  const passed = overallPct >= (testMeta?.pass_threshold ?? 60);
  useEffect(() => { const t = setTimeout(() => setVis(true), 200); return () => clearTimeout(t); }, []);
  return (
    <div className="max-w-2xl mx-auto pb-12">
      {testMeta?.badge_label && passed && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border border-amber-200 dark:border-amber-800 text-center">
          <div className="text-4xl mb-1">{testMeta.badge_icon}</div>
          <p className="font-extrabold text-amber-800 dark:text-amber-300">&#127881; Badge Unlocked: {testMeta.badge_label}!</p>
          {resultSaved && <p className="text-xs text-amber-600 mt-1">Saved to your profile</p>}
        </div>
      )}
      <div className={`border rounded-2xl p-6 mb-6 text-center ${level.bgClass}`}>
        <div className="text-5xl mb-2">{level.icon}</div>
        <h2 className={`text-2xl font-extrabold mb-1 ${level.colorClass}`}>{level.title}</h2>
        <p className="text-4xl font-extrabold text-gray-900 dark:text-white mb-1">{overallPct}%</p>
        <p className="text-sm text-gray-500">{totalCorrect} / {totalQuestions} correct</p>
        <p className={`text-xs font-bold mt-2 ${passed ? "text-green-600" : "text-red-500"}`}>
          {passed ? "Passed" : "Not passed"} (threshold: {testMeta?.pass_threshold ?? 60}%)
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-zinc-300 max-w-md mx-auto">{level.description}</p>
      </div>
      {activeDimensions.length > 0 && (
        <div className="bg-white/60 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-700 rounded-2xl p-5 mb-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Your Literacy Profile</h3>
          <div className="space-y-4">
            {activeDimensions.map(dim => {
              const pct = dimPcts[dim] ?? 0;
              const meta = DIMENSION_META[dim] || {};
              return (
                <div key={dim}>
                  <div className="flex justify-between mb-1"><span className="text-xs font-bold text-gray-700 dark:text-zinc-200">{meta.icon} {dim}</span><span className="text-xs font-extrabold tabular-nums">{pct}%</span></div>
                  <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${meta.bar || "bg-purple-500"}`} style={{ width: vis ? `${pct}%` : "0%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 mb-5">
        <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">&#128172; Reflection</p>
        <p className="text-sm text-indigo-800 dark:text-indigo-200">{level.reflection}</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={onRestart} className="flex-1 py-3.5 rounded-xl font-bold text-sm border-2 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-purple-300 transition-all">&#128257; Try Another Test</button>
        <Link to="/library" className="flex-1 py-3.5 rounded-xl font-bold text-sm text-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md transition-all hover:-translate-y-0.5">Browse Library &#8594;</Link>
      </div>
    </div>
  );
};

// Main Component
const MemeLiteracyTest = () => {
  const navigate = useNavigate();
  const { testId } = useParams();
  const { user } = useAuth();

  // Interactive Tour Hook
  const {
    isTourOpen,
    currentStep,
    totalSteps,
    currentStepData,
    pageTitle,
    hasSkippedTour,
    nextStep,
    prevStep,
    skipTour,
    resetTour,
  } = useTour("memeLiteracyTest");

  const [availableTests, setAvailableTests] = useState([]);
  const [launcherLoading, setLauncherLoading] = useState(true);
  const [testMeta, setTestMeta] = useState(null);
  const [testQuestions, setTestQuestions] = useState([]);
  const [loadingTest, setLoadingTest] = useState(false);
  const [phase, setPhase] = useState("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [resultSaved, setResultSaved] = useState(false);
  const [aiCoachingText, setAiCoachingText] = useState("");
  const [aiCoachingLoading, setAiCoachingLoading] = useState(false);
  const [showAiQuotaModal, setShowAiQuotaModal] = useState(false);
  const [attemptId, setAttemptId] = useState(null);
  const [quizError, setQuizError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleGetAiCoaching = async (q, lastAns) => {
    if (!q || !lastAns) return;
    setAiCoachingLoading(true);
    try {
      const text = await explainQuizMistake({
        questionTitle: q.question_text,
        selectedOption: q.options[lastAns.selected] || "None",
        correctOption: q.options[q.correct_index] || "Correct Option",
        explanation: q.explanation || ""
      });
      setAiCoachingText(text);
    } catch (err) {
      if (err.message === "QUOTA_EXCEEDED") {
        setShowAiQuotaModal(true);
      } else {
        console.error("AI coaching error:", err);
      }
    } finally {
      setAiCoachingLoading(false);
    }
  };

  useEffect(() => {
    // Always show local tests first, then append any active Firebase tests
    const q = query(collection(db, "literacy_tests"), where("is_active", "==", true));
    const unsub = onSnapshot(q, snap => {
      const firestoreTests = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
      const firestoreTitles = new Set(firestoreTests.map(t => (t.title || "").trim().toLowerCase()));
      // If a Firestore test matches a local test's title, prefer the Firestore version so admin edits take effect
      const filteredLocal = LOCAL_TESTS.filter(lt => !firestoreTitles.has((lt.title || "").trim().toLowerCase()));
      setAvailableTests([...firestoreTests, ...filteredLocal]);
      setLauncherLoading(false);
    }, () => {
      // On error (e.g. permission denied), still show local tests
      setAvailableTests([...LOCAL_TESTS]);
      setLauncherLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!testId) return;
    setPhase("intro"); setCurrentQ(0); setAnswers([]); setSelectedOption(null); setLastAnswer(null); setResultSaved(false);
    setAttemptId(null); setQuizError("");

    // Questions come from the server without their answers (functions/quizzes.js);
    // the attempt id ties this run's answers to the answer key it holds.
    // Re-run when the user signs in/out so the attempt belongs to the right account.
    let cancelled = false;
    setLoadingTest(true);
    const localMeta = LOCAL_TESTS.find(t => t.id === testId);
    const catalogueMeta = localMeta
      ? Promise.resolve(localMeta)
      : getDoc(doc(db, "literacy_tests", testId)).then(snap => snap.exists() ? { id: snap.id, ...snap.data() } : null).catch(() => null);
    Promise.all([startQuiz("literacy", testId), catalogueMeta])
      .then(([{ attemptId: id, meta, questions }, catalogue]) => {
        if (cancelled) return;
        // Display fields (description, difficulty…) come from the catalogue;
        // the badge/pass rules the server will apply override them.
        setTestMeta(meta || catalogue ? { ...(catalogue || {}), ...(meta || {}) } : null);
        setTestQuestions(questions);
        setAttemptId(id);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("Could not start test:", e);
        setTestMeta(null); setTestQuestions([]);
        setQuizError("Could not load this test. Please check your connection and try again.");
      })
      .finally(() => { if (!cancelled) setLoadingTest(false); });
    return () => { cancelled = true; };
  }, [testId, user?.uid]);

  const question = testQuestions[currentQ];
  const activeDimensions = [...new Set(testQuestions.map(q => q.dimension).filter(Boolean))];

  const computeScores = (allAnswers) => {
    const dimScores = {};
    activeDimensions.forEach(d => { dimScores[d] = { correct: 0, total: 0 }; });
    allAnswers.forEach(a => { if (a.dimension && dimScores[a.dimension]) { dimScores[a.dimension].total++; if (a.isCorrect) dimScores[a.dimension].correct++; } });
    const totalCorrect = allAnswers.filter(a => a.isCorrect).length;
    const overallPct = testQuestions.length > 0 ? Math.round((totalCorrect / testQuestions.length) * 100) : 0;
    const dimPcts = {};
    Object.entries(dimScores).forEach(([dim, { correct, total }]) => { dimPcts[dim] = total > 0 ? Math.round((correct / total) * 100) : 0; });
    return { overallPct, dimPcts, totalCorrect };
  };

  // The server scores the answers it recorded and, for a signed-in pass, saves
  // the result and awards the badge. Guests get the same score, unsaved.
  const saveResult = async () => {
    if (!attemptId) return;
    try {
      const result = await finishQuiz(attemptId);
      setResultSaved(Boolean(result.saved));
    } catch (e) { console.error("Save result failed:", e); }
  };

  const handleSubmit = async () => {
    if (selectedOption === null || !question || submitting) return;
    setSubmitting(true);
    try {
      // The verdict and explanation are only revealed once the answer is locked in.
      const verdict = await answerQuestion(attemptId, currentQ, selectedOption);
      setTestQuestions(qs => qs.map((q, i) => i === currentQ ? { ...q, correct_index: verdict.correct_index, explanation: verdict.explanation } : q));
      const ans = { selected: verdict.selected, correct: verdict.correct_index, isCorrect: verdict.isCorrect, dimension: question.dimension };
      setQuizError("");
      setLastAnswer(ans);
      setAnswers(prev => [...prev, ans]);
      setPhase("explanation");
    } catch (e) {
      console.error("Could not check answer:", e);
      setQuizError("Could not check your answer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setAiCoachingText("");
    if (currentQ + 1 >= testQuestions.length) { saveResult(); setPhase("results"); }
    else { setCurrentQ(q => q + 1); setSelectedOption(null); setLastAnswer(null); setPhase("question"); }
  };

  const glowBg = (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute -top-20 left-1/4 w-96 h-96 rounded-full bg-purple-400/10 dark:bg-purple-600/10 blur-[80px]" />
      <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full bg-indigo-400/10 dark:bg-indigo-600/10 blur-[70px]" />
    </div>
  );

  // LAUNCHER
  if (!testId) {
    return (
      <div className="min-h-[70vh] py-6">{glowBg}
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-indigo-200 dark:border-indigo-800 mb-4">Standardised Assessments</span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-3 leading-tight">
              Meme Literacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Tests</span>
            </h1>
            <p className="text-base text-gray-500 dark:text-zinc-400 max-w-xl mx-auto">Choose a test to evaluate your <strong className="text-gray-700 dark:text-zinc-200">critical meme literacy</strong> across different dimensions.</p>
            {!user && <p className="mt-3 text-xs text-gray-400">Sign in to save results and earn badges.</p>}
          </div>
          {launcherLoading ? (
            <div className="flex justify-center py-16"><div className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" /></div>
          ) : availableTests.length === 0 ? (
            <div className="text-center py-16"><span className="text-5xl">&#128221;</span><p className="mt-4 text-gray-500 font-semibold">No tests available yet.</p><p className="text-sm text-gray-400 mt-1">Check back soon!</p></div>
          ) : (
            <div id="literacy-test-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableTests.map(t => <TestCard key={t.id} test={t} onClick={() => navigate(`/meme-literacy-test/${t.id}`)} />)}
            </div>
          )}
        </div>

        {/* Interactive First-Time Tour & Page Help for Launcher */}
        <TourOverlay
          isOpen={isTourOpen}
          currentStep={currentStep}
          totalSteps={totalSteps}
          stepData={currentStepData}
          pageTitle={pageTitle}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />
        <PageHelpPanel
          pageKey="memeLiteracyTest"
          onRestartTour={resetTour}
          hasSkippedTour={hasSkippedTour}
        />
      </div>
    );
  }

  // LOADING
  if (loadingTest) {
    return <div className="min-h-[60vh] flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" /></div>;
  }

  // NO QUESTIONS
  if (!loadingTest && testQuestions.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <span className="text-5xl">&#128237;</span>
        <h2 className="text-xl font-extrabold">No Questions Yet</h2>
        <p className="text-sm text-gray-500 max-w-xs">{quizError || "This test doesn't have questions yet. Please check back later."}</p>
        <button onClick={() => navigate("/meme-literacy-test")} className="mt-2 bg-purple-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm">&#8592; Back to Tests</button>
      </div>
    );
  }

  const scores = phase === "results" ? computeScores(answers) : null;

  // QUIZ RUNNER
  return (
    <div className="min-h-[80vh] py-6">{glowBg}
      {/* Intro */}
      {phase === "intro" && (
        <div className="max-w-2xl mx-auto text-center py-8">
          <button onClick={() => navigate("/meme-literacy-test")} className="mb-6 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 mx-auto flex items-center gap-1">&#8592; All Tests</button>
          <div className="text-5xl mb-3">{testMeta?.badge_icon || "&#129514;"}</div>
          <div className="mb-4">
            <span className="inline-block bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
              {testMeta?.difficulty || "Assessment"}{testMeta?.category ? ` · ${testMeta.category}` : ""}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3">{testMeta?.title || "Meme Literacy Assessment"}</h1>
          {testMeta?.description && <p className="text-base text-gray-500 dark:text-zinc-400 max-w-xl mx-auto mb-6">{testMeta.description}</p>}
          {activeDimensions.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {activeDimensions.map(d => { const m = DIMENSION_META[d] || {}; return <span key={d} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${m.pill || "bg-purple-100 text-purple-700"}`}>{m.icon} {d}</span>; })}
            </div>
          )}
          <div className="flex justify-center gap-6 mb-10 text-sm text-gray-500">
            <span>&#128221; {testQuestions.length} Questions</span>
            <span>&#9200; No Time Limit</span>
            <span>&#127919; Pass at {testMeta?.pass_threshold ?? 60}%</span>
          </div>
          <button onClick={() => setPhase("question")} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-10 py-4 rounded-2xl text-base shadow-lg transition-all hover:-translate-y-0.5">
            Begin Assessment &#8594;
          </button>
          {testMeta?.badge_label && <p className="mt-4 text-xs text-gray-400">Earn the {testMeta.badge_icon} {testMeta.badge_label} badge on passing!</p>}
        </div>
      )}

      {/* Question */}
      {phase === "question" && question && (
        <div className="max-w-2xl mx-auto">
          <ProgressHeader current={currentQ + 1} total={testQuestions.length} dimension={question.dimension} onBack={() => navigate("/meme-literacy-test")} />
          <MemeImage url={question.meme_image_url} alt={question.question_text} />
          <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-zinc-100 mb-4 leading-snug">{question.question_text}</h2>
          <div className="flex flex-col gap-3 mb-6">
            {question.options.map((opt, i) => <OptionButton key={i} text={opt} index={i} mode="question" selected={selectedOption === i} isCorrect={false} isWrong={false} onClick={() => setSelectedOption(i)} />)}
          </div>
          {quizError && <p className="text-xs text-red-500 mb-3" role="alert">{quizError}</p>}
          <button onClick={handleSubmit} disabled={selectedOption === null || submitting} className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${selectedOption !== null && !submitting ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:-translate-y-0.5 cursor-pointer" : "bg-gray-100 dark:bg-zinc-800 text-gray-400 cursor-not-allowed"}`}>
            {submitting ? "Checking…" : "Submit Answer"}
          </button>
        </div>
      )}

      {/* Explanation */}
      {phase === "explanation" && lastAnswer && question && (
        <div className="max-w-2xl mx-auto">
          <ProgressHeader current={currentQ + 1} total={testQuestions.length} dimension={question.dimension} onBack={() => navigate("/meme-literacy-test")} />
          <MemeImage url={question.meme_image_url} alt={question.question_text} />
          {lastAnswer.isCorrect
            ? <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-2.5 rounded-xl text-sm font-bold mb-4"><span>&#9989;</span> Correct!</div>
            : <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-xl text-sm font-bold mb-4"><span>&#10060;</span> Not quite</div>
          }
          <div className="flex flex-col gap-2.5 mb-5">
            {question.options.map((opt, i) => <OptionButton key={i} text={opt} index={i} mode="explanation" selected={false} isCorrect={i === question.correct_index} isWrong={i === lastAnswer.selected && i !== question.correct_index} onClick={undefined} />)}
          </div>
          {question.explanation && (
            <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">&#128218; Explanation</p>
              <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{question.explanation}</p>
            </div>
          )}

          {/* AI Pedagogical Coach */}
          <div id="literacy-ai-feedback" className="p-3.5 bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-800/60 rounded-xl space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                ✨ AI Literacy Coach
              </span>
              {!aiCoachingText && (
                <button
                  type="button"
                  disabled={aiCoachingLoading}
                  onClick={() => handleGetAiCoaching(question, lastAnswer)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition shadow-sm active:scale-95"
                >
                  {aiCoachingLoading ? "Thinking…" : "Explain Nuance"}
                </button>
              )}
            </div>

            {aiCoachingText ? (
              <div className="text-xs text-purple-950 dark:text-purple-200 bg-white/80 dark:bg-zinc-900/80 p-3 rounded-lg border border-purple-100 dark:border-purple-900/40 leading-relaxed">
                {aiCoachingText}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Want deeper guidance? Get instant AI coaching on the visual rhetoric of this question.
              </p>
            )}
          </div>
          <button onClick={handleNext} className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md transition-all hover:-translate-y-0.5">
            {currentQ + 1 >= testQuestions.length ? "See My Results" : "Next Question"}
          </button>
        </div>
      )}

      {/* Results */}
      {phase === "results" && scores && (
        <ResultsPhase overallPct={scores.overallPct} dimPcts={scores.dimPcts} totalCorrect={scores.totalCorrect} totalQuestions={testQuestions.length} activeDimensions={activeDimensions} testMeta={testMeta} onRestart={() => navigate("/meme-literacy-test")} resultSaved={resultSaved} />
      )}

      {/* AI Quota & Ad-Gate Modal */}
      <AiQuotaModal
        isOpen={showAiQuotaModal}
        onClose={() => setShowAiQuotaModal(false)}
      />

      {/* Interactive First-Time Tour */}
      <TourOverlay
        isOpen={isTourOpen}
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepData={currentStepData}
        pageTitle={pageTitle}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTour}
      />

      {/* Floating Page Help Panel */}
      <PageHelpPanel
        pageKey="memeLiteracyTest"
        onRestartTour={resetTour}
        hasSkippedTour={hasSkippedTour}
      />

    </div>
  );
};

export default MemeLiteracyTest;
