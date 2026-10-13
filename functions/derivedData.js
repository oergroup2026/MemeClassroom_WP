"use strict";
/**
 * derivedData.js — Cloud Functions that own the numbers clients used to write.
 *
 *  • likes_count on memes / resources / newspaper items
 *  • total_likes_received and the other counters in /user_stats/{uid}
 *  • level badges in /badges
 *
 * Why: firestore.rules cannot make a browser tell the truth about a counter, so
 * any signed-in user could write themselves any score or badge. These triggers
 * derive the numbers from real documents (a like doc, a published meme, …) and
 * firestore.rules now refuses client writes to them. Admin-SDK writes here
 * bypass the rules.
 */

const { onDocumentCreated, onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const Sentry = require("@sentry/node");
const logic = require("./derivedLogic");

const db = admin.firestore();

const swallow = (label) => (e) => {
  console.error(label, e?.message || e);
  Sentry.captureException(e);
};

/** Add `delta` to one counter on a user's stats doc (creating the doc if needed). */
function bumpStat(uid, field, delta) {
  if (!logic.isRealUid(uid) || !delta) return Promise.resolve();
  return db.collection("user_stats").doc(uid)
    .set({ [field]: FieldValue.increment(delta) }, { merge: true })
    .catch(swallow(`bumpStat ${field} for ${uid} failed`));
}

/** Add `delta` to a counter on any doc, ignoring "no such document". */
function bumpDoc(collection, id, field, delta) {
  if (!id || !delta) return Promise.resolve();
  return db.collection(collection).doc(id)
    .update({ [field]: FieldValue.increment(delta) })
    .catch((e) => { if (e?.code !== 5) swallow(`bumpDoc ${collection}/${id} failed`)(e); });
}

// ─── Stats from content ─────────────────────────────────────────────────────

/** Keep one stat equal to "how many of this user's documents count". */
function countOwned(path, field, { ownerOf, isCounted }) {
  return onDocumentWritten(path, async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const deltas = logic.ownershipDeltas(before, after, { ownerOf, isCounted });
    await Promise.all(deltas.map((d) => bumpStat(d.uid, field, d.delta)));
  });
}

exports.statMemes = countOwned("memes/{id}", "memes_created_count",
  { ownerOf: (d) => d.creator_id, isCounted: logic.isPublishedMeme });
exports.statResources = countOwned("resources/{id}", "resources_contributed_count",
  { ownerOf: (d) => d.author_id, isCounted: logic.alwaysCounted });
exports.statStaffroomPosts = countOwned("staffroom_posts/{id}", "staffroom_posts_count",
  { ownerOf: (d) => d.author_id, isCounted: logic.alwaysCounted });
exports.statNewspaperItems = countOwned("newspaper_items/{id}", "newspaper_items_contributed_count",
  { ownerOf: (d) => d.author_id, isCounted: logic.alwaysCounted });

// Counted when created, never decremented (matches the old behaviour).
exports.statRatings = onDocumentCreated("ratings/{id}", (event) =>
  bumpStat(event.data?.data()?.user_id, "ratings_provided_count", 1));
exports.statSlangQuizzes = onDocumentCreated("slang_quiz_results/{id}", (event) =>
  bumpStat(event.data?.data()?.user_id, "slang_quizzes_completed", 1));

// Every account gets a zeroed stats doc. create() so an existing one is never reset.
exports.createUserStats = onDocumentCreated("users/{uid}", async (event) => {
  await db.collection("user_stats").doc(event.params.uid).create({
    memes_created_count: 0,
    resources_contributed_count: 0,
    staffroom_posts_count: 0,
    ratings_provided_count: 0,
    total_likes_received: 0,
  }).catch((e) => { if (e?.code !== 6) swallow("createUserStats failed")(e); }); // 6 = already exists
});

// ─── Likes ──────────────────────────────────────────────────────────────────
// A like is a document whose id is {uid}_{target} (enforced in firestore.rules),
// so one person can like one thing once. The counters follow the documents.

/** like collection → { parent collection, field naming the target, owner field | null } */
const LIKE_KINDS = {
  likes: { parent: "memes", targetField: "meme_id", ownerField: "creator_id" },
  resource_likes: { parent: "resources", targetField: "resource_id", ownerField: "author_id" },
  newspaper_likes: { parent: "newspaper_items", targetField: "item_id", ownerField: null },
};

async function applyLike(kind, like, delta) {
  const cfg = LIKE_KINDS[kind];
  const targetId = like?.[cfg.targetField];
  if (!targetId) return;
  await bumpDoc(cfg.parent, targetId, "likes_count", delta);
  if (cfg.ownerField) {
    const parent = await db.collection(cfg.parent).doc(targetId).get().catch(() => null);
    const owner = parent?.exists ? parent.data()[cfg.ownerField] : null;
    // Liking your own work does not count towards "Community Favorite".
    if (owner && owner !== like.user_id) await bumpStat(owner, "total_likes_received", delta);
  }
}

for (const kind of Object.keys(LIKE_KINDS)) {
  const name = kind.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  exports[`${name}Created`] = onDocumentCreated(`${kind}/{id}`, (e) => applyLike(kind, e.data?.data(), 1));
  exports[`${name}Deleted`] = onDocumentDeleted(`${kind}/{id}`, (e) => applyLike(kind, e.data?.data(), -1));
}

// ─── Badges ─────────────────────────────────────────────────────────────────
// Whenever a user's stats change, make sure they hold the badges those stats
// earn. Deterministic ids + create() mean two quick updates cannot double-award.
exports.syncBadges = onDocumentWritten("user_stats/{uid}", async (event) => {
  const uid = event.params.uid;
  const after = event.data?.after;
  if (!after?.exists || !logic.isRealUid(uid)) return;
  try {
    const existingSnap = await db.collection("badges").where("user_id", "==", uid).get();
    const existing = existingSnap.docs.map((d) => d.data());
    const missing = logic.missingBadges(logic.badgesFor(uid, after.data()), existing);
    await Promise.all(missing.map((b) =>
      db.collection("badges").doc(b.id).create({
        user_id: uid,
        category: b.category,
        level: b.level,
        badge_name: b.badge_name,
        badge_icon: b.badge_icon,
        description: b.description,
        awarded_at: FieldValue.serverTimestamp(),
      }).catch((e) => { if (e?.code !== 6) throw e; })
    ));
  } catch (e) {
    swallow(`syncBadges for ${uid} failed`)(e);
  }
});
