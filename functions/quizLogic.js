"use strict";
/**
 * quizLogic.js — pure rules for server-graded quizzes (no Firebase imports, so
 * they can be unit tested from the root test suite, like derivedLogic.js).
 *
 * The literacy test and the slang quiz used to be graded in the browser, which
 * also meant the browser held every correct answer. quizzes.js now keeps the
 * answer key on the server, hands the browser only the question text and
 * options, and scores the answers it recorded itself.
 */

const SLANG_QUESTIONS_PER_ATTEMPT = 10;
const SLANG_PASS_THRESHOLD = 70;
const DEFAULT_PASS_THRESHOLD = 60;

// Only passed slang quizzes count toward Slang Master, and at most this many a
// day, so the badge cannot be farmed by clicking through quizzes at random.
const SLANG_COUNTED_PER_DAY = 3;

// A finished attempt faster than this (per question) was not read by a person;
// it is scored and shown, but not saved and earns nothing.
const MIN_MS_PER_QUESTION = 1500;

// The built-in literacy tests. Must match src/data/localTestCatalogue.js, which
// is what the launcher shows; this copy is the one that decides badges.
const LOCAL_LITERACY_TESTS = {
  "local-basic": {
    title: "Meme Literacy Starter",
    badge_icon: "🌱",
    badge_label: "Meme Starter",
    pass_threshold: 60,
    bank: "basic",
  },
  "local-advanced": {
    title: "Meme Literacy Assessment",
    badge_icon: null,
    badge_label: null,
    pass_threshold: 60,
    bank: "advanced",
  },
};

/** Bundled bank entry (camelCase, literacy) or Firestore doc → one internal shape. */
function normalizeQuestion(q, fallbackId) {
  const correct = q.correct_index ?? q.correctIndex;
  return {
    id: String(q.id ?? fallbackId),
    question_text: q.question_text ?? q.question ?? "",
    options: Array.isArray(q.options) ? q.options.map(String) : [],
    correct_index: Number.isInteger(correct) ? correct : -1,
    explanation: q.explanation || "",
    meme_image_url: q.meme_image_url ?? q.memeUrl ?? "",
    dimension: q.dimension || null,
    category: q.category || null,
  };
}

/** What the browser may see before answering: everything except the answer. */
function publicQuestion(q) {
  return {
    id: q.id,
    question_text: q.question_text,
    options: q.options,
    meme_image_url: q.meme_image_url,
    dimension: q.dimension,
    category: q.category,
  };
}

/** Admin-curated questions first, then the bundled bank, deduped by question text. */
function mergeSlangPool(firestoreQuestions, bankQuestions) {
  const byText = new Map();
  for (const q of [...firestoreQuestions, ...bankQuestions]) {
    const key = (q.question_text || "").trim().toLowerCase();
    if (key && !byText.has(key) && q.options.length > 1 && q.correct_index >= 0) byText.set(key, q);
  }
  return Array.from(byText.values());
}

function shuffle(arr, random = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Score recorded answers against the stored key. `answers[i]` is the chosen index or null. */
function scoreAttempt(questions, answers, passThreshold) {
  let correct = 0;
  const dims = {};
  questions.forEach((q, i) => {
    const ok = answers[i] === q.correct_index;
    if (ok) correct++;
    if (q.dimension) {
      dims[q.dimension] = dims[q.dimension] || { correct: 0, total: 0 };
      dims[q.dimension].total++;
      if (ok) dims[q.dimension].correct++;
    }
  });
  const total = questions.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const dimPcts = {};
  for (const [d, v] of Object.entries(dims)) dimPcts[d] = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
  return { correct, total, pct, passed: total > 0 && pct >= passThreshold, dimPcts };
}

function allAnswered(answers, count) {
  return Array.isArray(answers) && answers.length === count && answers.every((a) => Number.isInteger(a));
}

function tooFast(startedAtMs, finishedAtMs, questionCount) {
  return finishedAtMs - startedAtMs < questionCount * MIN_MS_PER_QUESTION;
}

/** UTC calendar day, used for the slang daily cap. */
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Whether a finished slang quiz counts toward Slang Master, and the new daily
 * tally to store. `stats` is the user's /user_stats doc data (or {}).
 */
function slangCount(stats, passed, now) {
  const today = dayKey(now);
  const usedToday = stats?.slang_count_day === today ? Number(stats.slang_count_today) || 0 : 0;
  const counted = Boolean(passed) && usedToday < SLANG_COUNTED_PER_DAY;
  return { counted, today, usedToday: usedToday + (counted ? 1 : 0) };
}

module.exports = {
  SLANG_QUESTIONS_PER_ATTEMPT,
  SLANG_PASS_THRESHOLD,
  DEFAULT_PASS_THRESHOLD,
  SLANG_COUNTED_PER_DAY,
  MIN_MS_PER_QUESTION,
  LOCAL_LITERACY_TESTS,
  normalizeQuestion,
  publicQuestion,
  mergeSlangPool,
  shuffle,
  scoreAttempt,
  allAnswered,
  tooFast,
  dayKey,
  slangCount,
};
