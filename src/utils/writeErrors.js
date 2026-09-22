/**
 * writeErrors.js — turn a Firebase write failure into something a teacher or
 * student can act on.
 *
 * The common case worth naming is the daily rate limit: once a user is over
 * their cap, firestore.rules and storage.rules refuse the write and Firebase
 * reports a bare "permission-denied" / "storage/unauthorized". Without this the
 * user sees "Upload failed. Try again." and tries again forever.
 */

const RATE_LIMITED =
  "You've reached today's limit for this. It resets 24 hours after your first " +
  "post today — please try again later, or get in touch if you need a higher limit.";

const NOT_SIGNED_IN = "Please sign in to do that.";

/**
 * @param {unknown} error    the caught error
 * @param {string}  fallback message to use when the cause isn't recognised
 * @returns {string} a message suitable for showing directly to a user
 */
export function describeWriteError(error, fallback = "Something went wrong. Please try again.") {
  const code = error?.code || "";
  const message = String(error?.message || "");

  const denied =
    code === "permission-denied" ||
    code === "storage/unauthorized" ||
    message.includes("Missing or insufficient permissions") ||
    message.includes("User does not have permission");

  if (denied) {
    // A signed-out user hitting a login-only action is the other way to get a
    // permission error, and needs different advice.
    if (code === "unauthenticated" || code === "storage/unauthenticated") return NOT_SIGNED_IN;
    return RATE_LIMITED;
  }

  if (code === "unauthenticated" || code === "storage/unauthenticated") return NOT_SIGNED_IN;
  if (code === "storage/quota-exceeded") return RATE_LIMITED;
  if (code === "storage/retry-limit-exceeded" || code === "unavailable") {
    return "The connection dropped while saving. Please check your internet and try again.";
  }

  return fallback;
}

export const RATE_LIMIT_MESSAGE = RATE_LIMITED;
