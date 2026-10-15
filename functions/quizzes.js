"use strict";
/**
 * quizzes.js — server-graded Meme Literacy tests and Slang Decoder quiz.
 *
 *  startQuiz      picks the questions, stores the answer key in a private
 *                 /quiz_attempts doc, returns the questions WITHOUT answers
 *  answerQuestion locks in one answer (the first is final) and only then
 *                 returns whether it was right, plus the explanation
 *  finishQuiz     scores the recorded answers and writes results / badges /
 *                 the Slang Master counter
 *
 * Clients can no longer write quiz results, literacy badges, any /badges doc,
 * or read the question collections (see firestore.rules). Guests may play: their
 * attempts are graded the same way but nothing is saved.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const logic = require("./quizLogic");
const { levelForCount, LEVEL_NAMES } = require("./derivedLogic");
const { basicQuestions } = require("./quizBanks/literacyBasic");
const { questions: advancedQuestions } = require("./quizBanks/literacyAdvanced");
const { SLANG_QUIZ_QUESTIONS } = require("./quizBanks/slang");

const db = admin.firestore();

const BANKS = {
  basic: basicQuestions.map((q, i) => logic.normalizeQuestion(q, `basic-${i}`)),
  advanced: advancedQuestions.map((q, i) => logic.normalizeQuestion(q, `adv-${i}`)),
  slang: SLANG_QUIZ_QUESTIONS.map((q, i) => logic.normalizeQuestion(q, `sq-${i}`)),
};

async function isAdminUid(uid) {
  if (!uid) return false;
  const snap = await db.collection("users").doc(uid).get();
  const role = snap.exists ? snap.data().role : null;
  return role === "admin" || role === "manager";
}

/** { meta, questions } for a literacy test id, falling back like the old client did. */
async function loadLiteracyTest(testId) {
  const local = logic.LOCAL_LITERACY_TESTS[testId];
  if (local) {
    const { bank, ...meta } = local;
    return { meta, questions: BANKS[bank] };
  }
  const metaSnap = await db.collection("literacy_tests").doc(testId).get();
  const qSnap = await db.collection("literacy_test_questions").where("test_id", "==", testId).get();
  const questions = qSnap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((q) => logic.normalizeQuestion(q, q.id));
  const data = metaSnap.exists ? metaSnap.data() : null;
  const meta = data ? {
    title: data.title || "",
    badge_label: data.badge_label || null,
    badge_icon: data.badge_icon || null,
    pass_threshold: data.pass_threshold ?? logic.DEFAULT_PASS_THRESHOLD,
  } : null;
  // An unknown test, or one without questions yet, used to fall back to the
  // advanced bank. Keep that, but never let the fallback award the test's badge.
  if (questions.length === 0) return { meta: meta && { ...meta, badge_label: null }, questions: BANKS.advanced };
  return { meta, questions };
}

async function loadSlangQuestions() {
  const snap = await db.collection("slang_quiz_questions").where("is_active", "==", true).get();
  const fromFirestore = snap.docs.map((d) => logic.normalizeQuestion({ ...d.data(), id: d.id }, d.id));
  const pool = logic.mergeSlangPool(fromFirestore, BANKS.slang);
  return logic.shuffle(pool).slice(0, logic.SLANG_QUESTIONS_PER_ATTEMPT);
}

exports.startQuiz = onCall(async (request) => {
  const { kind, testId } = request.data || {};
  const uid = request.auth?.uid || null;

  let meta;
  let questions;
  if (kind === "literacy") {
    if (typeof testId !== "string" || !testId || testId.length > 200) {
      throw new HttpsError("invalid-argument", "A testId is required.");
    }
    ({ meta, questions } = await loadLiteracyTest(testId));
  } else if (kind === "slang") {
    meta = { pass_threshold: logic.SLANG_PASS_THRESHOLD };
    questions = await loadSlangQuestions();
  } else {
    throw new HttpsError("invalid-argument", "Unknown quiz kind.");
  }
  if (questions.length === 0) return { attemptId: null, meta, questions: [] };

  const ref = db.collection("quiz_attempts").doc();
  await ref.set({
    user_id: uid,
    kind,
    test_id: kind === "literacy" ? testId : null,
    meta: meta || null,
    questions,
    answers: questions.map(() => null),
    started_at: FieldValue.serverTimestamp(),
    finished: false,
    // Configure a Firestore TTL policy on this field to clean up old attempts.
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { attemptId: ref.id, meta, questions: questions.map(logic.publicQuestion) };
});

/** Load an attempt the caller owns (guests own the guest attempts they hold the id of). */
function ownedAttempt(snap, uid) {
  if (!snap.exists) throw new HttpsError("not-found", "Quiz attempt not found.");
  const a = snap.data();
  if ((a.user_id || null) !== (uid || null)) throw new HttpsError("permission-denied", "Not your quiz attempt.");
  return a;
}

exports.answerQuestion = onCall(async (request) => {
  const { attemptId, index, choice } = request.data || {};
  const uid = request.auth?.uid || null;
  if (typeof attemptId !== "string" || !attemptId) throw new HttpsError("invalid-argument", "attemptId is required.");
  if (!Number.isInteger(index) || !Number.isInteger(choice)) throw new HttpsError("invalid-argument", "index and choice must be integers.");

  const ref = db.collection("quiz_attempts").doc(attemptId);
  return db.runTransaction(async (tx) => {
    const a = ownedAttempt(await tx.get(ref), uid);
    if (a.finished) throw new HttpsError("failed-precondition", "This quiz is already finished.");
    const q = a.questions[index];
    if (!q) throw new HttpsError("invalid-argument", "No such question.");
    if (choice < 0 || choice >= q.options.length) throw new HttpsError("invalid-argument", "No such option.");

    // The first answer is final: answering again just repeats the verdict.
    const locked = Number.isInteger(a.answers[index]) ? a.answers[index] : choice;
    if (!Number.isInteger(a.answers[index])) {
      const answers = [...a.answers];
      answers[index] = choice;
      tx.update(ref, { answers });
    }
    return {
      selected: locked,
      isCorrect: locked === q.correct_index,
      correct_index: q.correct_index,
      explanation: q.explanation,
    };
  });
});

exports.finishQuiz = onCall(async (request) => {
  const { attemptId } = request.data || {};
  const uid = request.auth?.uid || null;
  if (typeof attemptId !== "string" || !attemptId) throw new HttpsError("invalid-argument", "attemptId is required.");

  const ref = db.collection("quiz_attempts").doc(attemptId);
  const now = new Date();

  const outcome = await db.runTransaction(async (tx) => {
    const a = ownedAttempt(await tx.get(ref), uid);
    if (a.finished) throw new HttpsError("failed-precondition", "This quiz is already finished.");
    if (!logic.allAnswered(a.answers, a.questions.length)) {
      throw new HttpsError("failed-precondition", "Answer every question first.");
    }

    const passThreshold = a.meta?.pass_threshold ?? logic.DEFAULT_PASS_THRESHOLD;
    const score = logic.scoreAttempt(a.questions, a.answers, passThreshold);
    const startedMs = a.started_at?.toDate?.().getTime?.() ?? now.getTime();
    const rushed = logic.tooFast(startedMs, now.getTime(), a.questions.length);
    const save = Boolean(uid) && !rushed;

    const result = {
      score_pct: score.pct,
      correct_count: score.correct,
      total_questions: score.total,
      passed: score.passed,
      dim_pcts: score.dimPcts,
      saved: save,
      badge_awarded: null,
      slang_counted: false,
      slang_quizzes_completed: null,
      slang_new_level: null,
    };

    // Reads first (Firestore transactions require all reads before writes).
    const statsRef = uid ? db.collection("user_stats").doc(uid) : null;
    const stats = save && a.kind === "slang" ? (await tx.get(statsRef)).data() || {} : null;
    const badgeLabel = a.kind === "literacy" && score.passed ? a.meta?.badge_label : null;
    const badgeRef = save && badgeLabel ? db.collection("badges").doc(`${uid}__literacy__${a.test_id}`) : null;
    const literacyBadgeRef = badgeRef ? db.collection("literacy_badges").doc(`${uid}__${a.test_id}`) : null;
    const hadBadge = badgeRef ? (await tx.get(badgeRef)).exists : false;

    tx.update(ref, { finished: true, finished_at: FieldValue.serverTimestamp(), rushed });
    if (!save) return result;

    if (a.kind === "literacy") {
      tx.set(db.collection("literacy_test_results").doc(attemptId), {
        user_id: uid,
        test_id: a.test_id,
        attempt_id: attemptId,
        score_pct: score.pct,
        correct_count: score.correct,
        total_questions: score.total,
        passed: score.passed,
        badge_earned: badgeLabel || null,
        badge_icon: badgeLabel ? a.meta?.badge_icon || null : null,
        completed_at: FieldValue.serverTimestamp(),
      });
      if (badgeLabel && !hadBadge) {
        tx.set(literacyBadgeRef, {
          user_id: uid,
          test_id: a.test_id,
          attempt_id: attemptId,
          test_title: a.meta?.title || "",
          badge_label: badgeLabel,
          badge_icon: a.meta?.badge_icon || "🏅",
          score_pct: score.pct,
          pass_threshold: passThreshold,
          awarded_at: FieldValue.serverTimestamp(),
        });
        // Mirrored into /badges so Staffroom & UserModalContext display it.
        tx.set(badgeRef, {
          user_id: uid,
          category: "literacy",
          level: 1,
          badge_name: badgeLabel,
          badge_icon: "award",
          description: `Passed literacy assessment with ${score.pct}% score`,
          awarded_at: FieldValue.serverTimestamp(),
        });
        result.badge_awarded = badgeLabel;
      }
    } else {
      const { counted, today, usedToday } = logic.slangCount(stats, score.passed, now);
      tx.set(db.collection("slang_quiz_results").doc(attemptId), {
        user_id: uid,
        attempt_id: attemptId,
        score_pct: score.pct,
        correct_count: score.correct,
        total_questions: score.total,
        passed: score.passed,
        counted,
        completed_at: FieldValue.serverTimestamp(),
      });
      const before = Number(stats.slang_quizzes_completed) || 0;
      const after = before + (counted ? 1 : 0);
      if (counted) {
        // syncBadges (derivedData.js) awards the Slang Master level from this.
        tx.set(statsRef, {
          slang_quizzes_completed: FieldValue.increment(1),
          slang_count_day: today,
          slang_count_today: usedToday,
        }, { merge: true });
      }
      result.slang_counted = counted;
      result.slang_quizzes_completed = after;
      if (levelForCount(after) > levelForCount(before)) result.slang_new_level = LEVEL_NAMES[levelForCount(after)];
    }
    return result;
  });

  return outcome;
});

/**
 * Admin > Literacy Tests "import starter test" button. The starter questions
 * used to be bundled into the browser for this; they now live only here.
 */
exports.seedStarterLiteracyTest = onCall(async (request) => {
  if (!(await isAdminUid(request.auth?.uid))) throw new HttpsError("permission-denied", "Admins only.");
  const meta = logic.LOCAL_LITERACY_TESTS["local-basic"];
  const testRef = db.collection("literacy_tests").doc();
  const batch = db.batch();
  batch.set(testRef, {
    title: meta.title,
    description: "New to meme literacy? Start here. 15 simple questions that cover the basics — what memes mean, why people share them, and how to spot when they might be misleading.",
    difficulty: "beginner",
    category: "Foundations",
    badge_icon: meta.badge_icon,
    badge_label: meta.badge_label,
    pass_threshold: meta.pass_threshold,
    is_active: true,
    is_starter_test: true,
    question_count: BANKS.basic.length,
    created_at: FieldValue.serverTimestamp(),
    created_by: request.auth.uid,
  });
  BANKS.basic.forEach((q, i) => {
    batch.set(db.collection("literacy_test_questions").doc(), {
      test_id: testRef.id,
      question_text: q.question_text,
      dimension: q.dimension || "General",
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation,
      meme_image_url: q.meme_image_url,
      order: i,
      created_at: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return { testId: testRef.id };
});
