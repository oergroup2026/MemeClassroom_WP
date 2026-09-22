/**
 * rateLimits.js — per-user daily caps.
 *
 * Upload SIZE is capped by storage.rules and src/utils/uploadLimits.js. This
 * caps upload and posting FREQUENCY, which is the other half: without it one
 * account can upload a 50MB video fifty times over and the bill is the only
 * thing that notices.
 *
 * Firestore rules cannot count a user's past writes, and they cannot force a
 * client to increment a counter alongside its own write — so the counters live
 * in /user_quotas/{uid}, which ONLY these Cloud Functions write (clients are
 * denied in firestore.rules). Because that document is trustworthy, the rules
 * can read it and refuse further writes once a user is over. Enforcement
 * therefore lags by one write: an abuser gets a handful past the cap, then
 * nothing until the window rolls over. That is enough to bound the cost.
 *
 * Limits are deliberately generous. A teacher preparing a lesson should never
 * meet one; they exist to stop a script, not to ration normal use.
 */

const WINDOW_HOURS = 24;

const LIMITS = {
  // Storage
  uploads: 60,                     // files per day
  bytes: 500 * 1024 * 1024,        // 500MB per day
  // Firestore content
  memes: 50,
  staffroom_posts: 30,
  comments: 150,
  resources: 25,
};

const FRIENDLY = {
  uploads: "daily upload limit",
  bytes: "daily upload size limit",
  memes: "daily meme limit",
  staffroom_posts: "daily Staffroom post limit",
  comments: "daily comment limit",
  resources: "daily resource limit",
};

/**
 * Best-effort uploader uid for a Storage object.
 *
 * Non-admin uploads are required by storage.rules to carry the uploader's uid
 * in the object name (ownsIncomingObject), so this is reliable for exactly the
 * uploads worth counting. Admin-seeded objects (named seed_... or admin_...)
 * yield null, which callers treat as "not attributable, skip".
 */
function uidFromObjectName(name) {
  if (!name) return null;
  const parts = name.split("/");

  // id_cards/{uid}/... and users/{uid}/avatar/...
  if ((parts[0] === "id_cards" || parts[0] === "users") && parts[1]) {
    return parts[1];
  }

  // Everything else embeds the uid in the file name, e.g.
  // memes/{uid}_meme_{ts}.png, resources/thumb_{uid}_{ts}.
  const fileName = parts[parts.length - 1] || "";
  const match = fileName.match(/[A-Za-z0-9]{20,40}/);
  return match ? match[0] : null;
}

/** A fresh, empty window starting now. */
function newWindow(now) {
  return {
    window_start: now,
    uploads: 0,
    bytes: 0,
    memes: 0,
    staffroom_posts: 0,
    comments: 0,
    resources: 0,
  };
}

function windowExpired(data, now) {
  const start = data?.window_start?.toDate?.();
  if (!start) return true;
  return now.getTime() - start.getTime() >= WINDOW_HOURS * 60 * 60 * 1000;
}

module.exports = { WINDOW_HOURS, LIMITS, FRIENDLY, uidFromObjectName, newWindow, windowExpired };
