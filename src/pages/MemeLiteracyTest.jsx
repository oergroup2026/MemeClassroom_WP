import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  questions,
  DIMENSIONS,
  DIMENSION_META,
  getLevel,
} from "../data/memeTestQuestions";

// ─── Option Button ──────────────────────────────────────────────────────────
const OptionButton = ({ text, index, mode, selected, isCorrect, isWrong, onClick }) => {
  const letter = ["A", "B", "C", "D"][index];

  let containerCls =
    "w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-150 text-sm flex items-start gap-3 font-medium";
  let letterCls =
    "w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5";
  let trailingIcon = null;

  if (mode === "question") {
    if (selected) {
      containerCls +=
        " border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 cursor-pointer shadow-sm";
      letterCls += " bg-purple-500 text-white";
    } else {
      containerCls +=
        " border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-zinc-700/50 cursor-pointer";
      letterCls += " bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400";
    }
  } else {
    // explanation mode
    if (isCorrect) {
      containerCls +=
        " border-green-500 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200 cursor-default";
      letterCls += " bg-green-500 text-white";
      trailingIcon = <span className="ml-auto flex-shrink-0 text-green-600 dark:text-green-400 font-bold text-base">✓</span>;
    } else if (isWrong) {
      containerCls +=
        " border-red-400 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 cursor-default";
      letterCls += " bg-red-400 text-white";
      trailingIcon = <span className="ml-auto flex-shrink-0 text-red-500 font-bold text-base">✗</span>;
    } else {
      containerCls +=
        " border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/40 text-gray-400 dark:text-zinc-500 cursor-default";
      letterCls += " bg-gray-100 dark:bg-zinc-700 text-gray-400 dark:text-zinc-500";
    }
  }

  return (
    <button className={containerCls} onClick={onClick} disabled={mode === "explanation"}>
      <span className={letterCls}>{letter}</span>
      <span className="leading-relaxed pt-0.5 flex-1">{text}</span>
      {trailingIcon}
    </button>
  );
};

// ─── Meme Image ─────────────────────────────────────────────────────────────
const MemeImage = ({ url, alt, caption }) => {
  const [error, setError] = useState(false);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-black/5 dark:bg-zinc-900 mb-2">
      {!error ? (
        <img
          src={url}
          alt={alt}
          onError={() => setError(true)}
          className="w-full max-h-72 object-contain block mx-auto"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-center px-6 py-4">
          <span className="text-5xl mb-3">🖼️</span>
          <p className="text-sm font-semibold text-gray-600 dark:text-zinc-300">{alt}</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">{caption}</p>
        </div>
      )}
    </div>
  );
};

// ─── Progress Bar ───────────────────────────────────────────────────────────
const ProgressHeader = ({ current, total, dimension, onBack }) => {
  const pct = Math.round((current / total) * 100);
  const meta = DIMENSION_META[dimension] || {};

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 flex items-center gap-1 transition-colors"
        >
          ← Exit Test
        </button>
        <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 tabular-nums">
          {current} / {total}
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${meta.pill}`}>
          {meta.icon} {dimension}
        </span>
      </div>
    </div>
  );
};

// ─── Intro Phase ─────────────────────────────────────────────────────────────
const IntroPhase = ({ onStart }) => (
  <div className="max-w-2xl mx-auto text-center py-8">
    {/* Header */}
    <div className="mb-4">
      <span className="inline-block bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
        Standardised Assessment
      </span>
    </div>
    <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-3 leading-tight tracking-tight">
      Meme Literacy{" "}
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">
        Assessment
      </span>
    </h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-zinc-400 max-w-xl mx-auto mb-8 leading-relaxed">
      How deeply do you read the memes you encounter every day? This 18-question assessment evaluates your{" "}
      <strong className="text-gray-700 dark:text-zinc-200">critical meme literacy</strong> across six dimensions — from symbolic decoding to ethical judgment.
    </p>

    {/* Dimension Pills */}
    <div className="flex flex-wrap justify-center gap-2 mb-8">
      {DIMENSIONS.map((d) => {
        const meta = DIMENSION_META[d];
        return (
          <span key={d} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${meta.pill}`}>
            {meta.icon} {d}
          </span>
        );
      })}
    </div>

    {/* Literacy Level Ladder */}
    <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border border-gray-200/60 dark:border-zinc-700/50 rounded-2xl p-5 mb-8 text-left shadow-sm">
      <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
        Literacy Levels — from lowest to highest
      </p>
      <div className="flex flex-wrap gap-2">
        {["🌱 Meme Spectator", "🔍 Meme Decoder", "🧐 Meme Analyst", "🎓 Meme Critic", "🏛️ Meme Scholar"].map((l) => (
          <span key={l} className="text-xs font-semibold text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
            {l}
          </span>
        ))}
      </div>
    </div>

    {/* Meta info */}
    <div className="flex justify-center gap-6 mb-10 text-sm text-gray-500 dark:text-zinc-400">
      <span className="flex items-center gap-1.5">
        <span className="text-purple-500">📝</span> 18 Questions
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-purple-500">⏱️</span> No Time Limit
      </span>
      <span className="flex items-center gap-1.5">
        <span className="text-purple-500">💬</span> Instant Reflection
      </span>
    </div>

    <button
      onClick={onStart}
      className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-10 py-4 rounded-2xl text-base shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      Begin Assessment →
    </button>
    <p className="mt-4 text-xs text-gray-400 dark:text-zinc-500">
      Grounded in academic media literacy research · No account required
    </p>
  </div>
);

// ─── Question Phase ───────────────────────────────────────────────────────────
const QuestionPhase = ({ question, qIndex, total, selected, onSelect, onSubmit, onExit }) => (
  <div className="max-w-2xl mx-auto">
    <ProgressHeader current={qIndex + 1} total={total} dimension={question.dimension} onBack={onExit} />

    {/* Meme */}
    <MemeImage url={question.memeUrl} alt={question.memeAlt} caption={question.memeCaption} />
    <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-center italic mb-5">
      {question.memeCaption}
    </p>

    {/* Question */}
    <h2 className="text-base md:text-lg font-bold text-gray-800 dark:text-zinc-100 mb-4 leading-snug">
      {question.question}
    </h2>

    {/* Options */}
    <div className="flex flex-col gap-3 mb-6">
      {question.options.map((opt, idx) => (
        <OptionButton
          key={idx}
          text={opt}
          index={idx}
          mode="question"
          selected={selected === idx}
          isCorrect={false}
          isWrong={false}
          onClick={() => onSelect(idx)}
        />
      ))}
    </div>

    {/* Submit */}
    <button
      onClick={onSubmit}
      disabled={selected === null}
      className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 
        ${selected !== null
          ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/15 hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
          : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 cursor-not-allowed"
        }`}
    >
      Submit Answer
    </button>
  </div>
);

// ─── Explanation Phase ────────────────────────────────────────────────────────
const ExplanationPhase = ({ question, qIndex, total, lastAnswer, onNext, onExit, isLast }) => (
  <div className="max-w-2xl mx-auto">
    <ProgressHeader current={qIndex + 1} total={total} dimension={question.dimension} onBack={onExit} />

    {/* Meme */}
    <MemeImage url={question.memeUrl} alt={question.memeAlt} caption={question.memeCaption} />
    <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-center italic mb-4">
      {question.memeCaption}
    </p>

    {/* Correct / Incorrect Banner */}
    {lastAnswer.isCorrect ? (
      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-2.5 rounded-xl text-sm font-bold mb-4">
        <span className="text-lg">✅</span> Correct — well reasoned
      </div>
    ) : (
      <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-2.5 rounded-xl text-sm font-bold mb-4">
        <span className="text-lg">❌</span> Not quite — see the explanation below
      </div>
    )}

    {/* Options (colour-coded) */}
    <div className="flex flex-col gap-2.5 mb-5">
      {question.options.map((opt, idx) => (
        <OptionButton
          key={idx}
          text={opt}
          index={idx}
          mode="explanation"
          selected={false}
          isCorrect={idx === question.correctIndex}
          isWrong={idx === lastAnswer.selected && idx !== question.correctIndex}
          onClick={undefined}
        />
      ))}
    </div>

    {/* Explanation */}
    <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 mb-4">
      <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
        📖 Explanation
      </p>
      <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
        {question.explanation}
      </p>
    </div>

    {/* Deeper Thought */}
    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 mb-6">
      <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-2">
        💭 Reflect Deeper
      </p>
      <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed italic">
        {question.deeperThought}
      </p>
    </div>

    {/* Next Button */}
    <button
      onClick={onNext}
      className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/15 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
    >
      {isLast ? "See My Results →" : `Next Question →`}
    </button>
  </div>
);

// ─── Results Phase ────────────────────────────────────────────────────────────
const ResultsPhase = ({ overallPct, dimPcts, totalCorrect, onRestart }) => {
  const [barsVisible, setBarsVisible] = useState(false);
  const level = getLevel(overallPct);

  useEffect(() => {
    const t = setTimeout(() => setBarsVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  const getMostNeeded = () => {
    let lowest = null;
    let lowestPct = Infinity;
    DIMENSIONS.forEach((d) => {
      if (dimPcts[d] < lowestPct) { lowestPct = dimPcts[d]; lowest = d; }
    });
    return lowest;
  };

  const mostNeeded = getMostNeeded();

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Level Badge */}
      <div className={`border rounded-2xl p-6 mb-6 text-center ${level.bgClass}`}>
        <div className="text-5xl mb-2">{level.icon}</div>
        <h2 className={`text-2xl md:text-3xl font-extrabold mb-1 ${level.colorClass}`}>
          {level.title}
        </h2>
        <p className="text-4xl font-extrabold text-gray-900 dark:text-white mb-1">
          {overallPct}%
        </p>
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          {totalCorrect} / {questions.length} correct
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-zinc-300 leading-relaxed max-w-md mx-auto">
          {level.description}
        </p>
      </div>

      {/* Dimension Bars */}
      <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border border-gray-200/60 dark:border-zinc-700/50 rounded-2xl p-5 mb-5 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
          Your Literacy Profile
        </h3>
        <div className="space-y-4">
          {DIMENSIONS.map((dim) => {
            const pct = dimPcts[dim];
            const meta = DIMENSION_META[dim];
            return (
              <div key={dim}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-700 dark:text-zinc-200 flex items-center gap-1.5">
                    {meta.icon} {dim}
                    {dim === mostNeeded && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold ml-1">
                        Focus area
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-extrabold text-gray-700 dark:text-zinc-200 tabular-nums">
                    {pct}%
                  </span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${meta.bar}`}
                    style={{ width: barsVisible ? `${pct}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reflection */}
      <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-5 mb-5">
        <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-2">
          💬 Your Literacy Reflection
        </p>
        <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
          {level.reflection}
        </p>
      </div>

      {/* Next Steps */}
      <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm border border-gray-200/60 dark:border-zinc-700/50 rounded-2xl p-5 mb-6 shadow-sm">
        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
          📌 Recommended Next Steps
        </p>
        <ol className="space-y-3">
          {level.nextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
              <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs font-extrabold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRestart}
          className="flex-1 py-3.5 rounded-xl font-bold text-sm border-2 border-gray-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/60 text-gray-700 dark:text-zinc-200 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-zinc-800 transition-all duration-200"
        >
          🔁 Retake Assessment
        </button>
        <Link
          to="/library"
          className="flex-1 py-3.5 rounded-xl font-bold text-sm text-center bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/15 transition-all duration-200 hover:-translate-y-0.5"
        >
          Browse Library with Fresh Eyes →
        </Link>
      </div>
    </div>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────────
const MemeLiteracyTest = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("intro"); // intro | question | explanation | results
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);

  const question = questions[currentQ];

  const computeScores = (allAnswers) => {
    const dimScores = {};
    DIMENSIONS.forEach((d) => { dimScores[d] = { correct: 0, total: 0 }; });
    allAnswers.forEach((a) => {
      dimScores[a.dimension].total++;
      if (a.isCorrect) dimScores[a.dimension].correct++;
    });
    const totalCorrect = allAnswers.filter((a) => a.isCorrect).length;
    const overallPct = Math.round((totalCorrect / questions.length) * 100);
    const dimPcts = {};
    Object.entries(dimScores).forEach(([dim, { correct, total }]) => {
      dimPcts[dim] = total > 0 ? Math.round((correct / total) * 100) : 0;
    });
    return { overallPct, dimPcts, totalCorrect };
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null) return;
    const isCorrect = selectedOption === question.correctIndex;
    const answer = {
      selected: selectedOption,
      correct: question.correctIndex,
      isCorrect,
      dimension: question.dimension,
    };
    setLastAnswer(answer);
    setAnswers((prev) => [...prev, answer]);
    setPhase("explanation");
  };

  const handleNext = () => {
    if (currentQ + 1 >= questions.length) {
      setPhase("results");
    } else {
      setCurrentQ((q) => q + 1);
      setSelectedOption(null);
      setLastAnswer(null);
      setPhase("question");
    }
  };

  const handleRestart = () => {
    setPhase("intro");
    setCurrentQ(0);
    setSelectedOption(null);
    setLastAnswer(null);
    setAnswers([]);
  };

  const handleExit = () => navigate("/");

  // Compute scores for results (all answers collected)
  const scores = phase === "results" ? computeScores(answers) : null;

  return (
    <div className="min-h-[80vh] py-6">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-20 left-1/4 w-96 h-96 rounded-full bg-purple-400/10 dark:bg-purple-600/10 blur-[80px]" />
        <div className="absolute bottom-20 right-1/4 w-80 h-80 rounded-full bg-indigo-400/10 dark:bg-indigo-600/10 blur-[70px]" />
      </div>

      {phase === "intro" && <IntroPhase onStart={() => setPhase("question")} />}

      {phase === "question" && (
        <QuestionPhase
          question={question}
          qIndex={currentQ}
          total={questions.length}
          selected={selectedOption}
          onSelect={setSelectedOption}
          onSubmit={handleSubmitAnswer}
          onExit={handleExit}
        />
      )}

      {phase === "explanation" && lastAnswer && (
        <ExplanationPhase
          question={question}
          qIndex={currentQ}
          total={questions.length}
          lastAnswer={lastAnswer}
          onNext={handleNext}
          onExit={handleExit}
          isLast={currentQ + 1 >= questions.length}
        />
      )}

      {phase === "results" && scores && (
        <ResultsPhase
          overallPct={scores.overallPct}
          dimPcts={scores.dimPcts}
          totalCorrect={scores.totalCorrect}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
};

export default MemeLiteracyTest;
