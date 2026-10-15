import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * Server-graded quizzes (functions/quizzes.js). The browser never holds the
 * answer key: it gets questions without answers, learns each answer only after
 * locking in a choice, and the server scores the attempt and saves results.
 */

/** @returns {Promise<{attemptId: string|null, meta: object|null, questions: object[]}>} */
export async function startQuiz(kind, testId) {
  const { data } = await httpsCallable(functions, "startQuiz")({ kind, testId });
  return data;
}

/** @returns {Promise<{selected: number, isCorrect: boolean, correct_index: number, explanation: string}>} */
export async function answerQuestion(attemptId, index, choice) {
  const { data } = await httpsCallable(functions, "answerQuestion")({ attemptId, index, choice });
  return data;
}

/** @returns {Promise<{score_pct: number, correct_count: number, total_questions: number, passed: boolean, saved: boolean, badge_awarded: string|null, dim_pcts: object, slang_counted: boolean, slang_quizzes_completed: number|null, slang_new_level: string|null}>} */
export async function finishQuiz(attemptId) {
  const { data } = await httpsCallable(functions, "finishQuiz")({ attemptId });
  return data;
}
