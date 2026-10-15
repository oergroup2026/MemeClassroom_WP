/**
 * Badges are no longer created from the browser. Level and Contributor badges
 * are awarded by a Cloud Function from real stats (functions/derivedData.js
 * syncBadges), and literacy badges by finishQuiz (functions/quizzes.js) on a
 * server-graded pass; firestore.rules rejects any client-created /badges doc.
 *
 * Kept so existing callers (AuthContext's awardLoginBadge /
 * awardAuthorisedUserBadge) keep working. Always resolves to false
 * ("nothing newly awarded").
 */
export async function awardBadgeIfMissing() {
  return false;
}
