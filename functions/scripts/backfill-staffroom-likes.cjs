"use strict";
/**
 * One-off migration for Staffroom upvotes moving to /staffroom_likes.
 *
 * Before, the browser wrote `likes` and `liked_by` on the post directly, so a
 * post's `likes` could be any number. This script, for every post:
 *   • creates /staffroom_likes/{uid}_{postId} for each uid in liked_by (marked
 *     backfilled, so the Cloud Function does not count it a second time), so
 *     those people can still remove their upvote;
 *   • resets `likes` to the number of distinct uids in liked_by.
 *
 * Run once, after deploying functions and before (or right after) the rules:
 *   cd functions && GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/backfill-staffroom-likes.cjs [--dry-run]
 */
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const posts = await db.collection("staffroom_posts").get();
  let fixed = 0;
  let likeDocs = 0;
  for (const post of posts.docs) {
    const data = post.data();
    const uids = [...new Set((data.liked_by || []).filter((u) => typeof u === "string" && u))];
    if (data.likes !== uids.length || (data.liked_by || []).length !== uids.length) {
      console.log(`${post.id}: likes ${data.likes} -> ${uids.length}`);
      fixed++;
    }
    if (dryRun) continue;
    const batch = db.batch();
    for (const uid of uids) {
      batch.set(db.collection("staffroom_likes").doc(`${uid}_${post.id}`), {
        user_id: uid,
        post_id: post.id,
        backfilled: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      likeDocs++;
    }
    batch.update(post.ref, { likes: uids.length, liked_by: uids });
    await batch.commit();
  }
  console.log(`${posts.size} posts checked, ${fixed} counters corrected, ${likeDocs} like docs written${dryRun ? " (dry run)" : ""}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
