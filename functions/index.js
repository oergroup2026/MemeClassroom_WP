/**
 * MemeClassroom – Firebase Cloud Functions: Notifications System (Phase 3)
 *
 * Triggers:
 * 
 *  1. onCommentCreated       – notify meme/post author when someone comments
 *  2. onCommentLiked         – notify comment author when their comment is liked
 *  3. onMemeReply            – notify parent comment author on reply
 *  4. onStaffroomReply       – notify Staffroom post author on reply
 *  5. onLiteracyBadgeAwarded – notify user when they earn a literacy badge
 *  6. onActivityMilestone    – notify admin/user on new milestone badge
 *  7. onResourceBookmarked   – notify resource author when someone bookmarks
 *  8. onUserFollowed         – notify user when someone follows them (future-ready)
 *
 * Each function writes a notification document to:
 *   /notifications/{notifId}
 *   {
 *     user_id:    string   – recipient
 *     type:       string   – one of the trigger names above
 *     title:      string   – short notification heading
 *     body:       string   – longer description
 *     link:       string   – relative URL to navigate to on click
 *     actor_id:   string   – uid of who triggered the notification
 *     actor_name: string   – display name of actor
 *     entity_id:  string   – id of the relevant entity (meme, comment, etc.)
 *     read:       boolean  – false on creation; client updates to true
 *     created_at: Timestamp
 *   }
 */

"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const Parser = require("rss-parser");
const { TRUSTED_NEWS_DOMAINS, DEFAULT_NEWSPAPER_SOURCES } = require("./newspaperConfig");

admin.initializeApp();
const db = admin.firestore();
const rssParser = new Parser();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a user's display name from the /users collection.
 * Falls back to "Someone" if not found.
 */
async function getUserName(uid) {
  if (!uid) return "Someone";
  try {
    const snap = await db.collection("users").doc(uid).get();
    return (snap.exists && snap.data().name) || "Someone";
  } catch {
    return "Someone";
  }
}

/**
 * Write a notification document. Skips if recipient === actor (no self-notifs).
 */
async function createNotification({ recipientId, actorId, actorName, type, title, body, link, entityId }) {
  // Don't notify yourself
  if (!recipientId || recipientId === actorId) return;

  await db.collection("notifications").add({
    user_id: recipientId,
    actor_id: actorId || null,
    actor_name: actorName || "Someone",
    type,
    title,
    body,
    link: link || "/",
    entity_id: entityId || null,
    read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─── Trigger 1: Comment Created ───────────────────────────────────────────────
// Fires when a comment is added to /comments/{commentId}
// Notifies the meme/post author.
exports.onCommentCreated = onDocumentCreated("comments/{commentId}", async (event) => {
  const comment = event.data.data();
  const { meme_id, author_id: actorId, text } = comment;
  if (!meme_id || !actorId) return;

  // Resolve meme author
  const memeSnap = await db.collection("memes").doc(meme_id).get();
  if (!memeSnap.exists) return;
  const recipientId = memeSnap.data().creator_id;
  const actorName = await getUserName(actorId);

  await createNotification({
    recipientId,
    actorId,
    actorName,
    type: "comment",
    title: `${actorName} commented on your meme`,
    body: text ? text.substring(0, 120) : "New comment on your meme.",
    link: `/library?meme=${meme_id}`,
    entityId: meme_id,
  });
});

// ─── Trigger 2: Comment Liked ─────────────────────────────────────────────────
// Fires when a /comment_likes/{likeId} doc is created.
// Notifies the comment author.
exports.onCommentLiked = onDocumentCreated("comment_likes/{likeId}", async (event) => {
  const like = event.data.data();
  const { comment_id, user_id: actorId } = like;
  if (!comment_id || !actorId) return;

  const commentSnap = await db.collection("comments").doc(comment_id).get();
  if (!commentSnap.exists) return;
  const comment = commentSnap.data();
  const recipientId = comment.author_id;
  const actorName = await getUserName(actorId);

  await createNotification({
    recipientId,
    actorId,
    actorName,
    type: "comment_like",
    title: `${actorName} liked your comment`,
    body: comment.text ? `"${comment.text.substring(0, 80)}"` : "Someone liked your comment.",
    link: `/library?meme=${comment.meme_id || ""}`,
    entityId: comment_id,
  });
});

// ─── Trigger 3: Meme Reply ────────────────────────────────────────────────────
// Fires when a /comments/{commentId} doc is created and has a parent_id.
// Notifies the parent comment author.
exports.onMemeReply = onDocumentCreated("comments/{commentId}", async (event) => {
  const reply = event.data.data();
  const { parent_id, author_id: actorId, text, meme_id } = reply;
  if (!parent_id || !actorId) return; // Not a reply if no parent_id

  const parentSnap = await db.collection("comments").doc(parent_id).get();
  if (!parentSnap.exists) return;
  const recipientId = parentSnap.data().author_id;
  const actorName = await getUserName(actorId);

  await createNotification({
    recipientId,
    actorId,
    actorName,
    type: "reply",
    title: `${actorName} replied to your comment`,
    body: text ? text.substring(0, 120) : "Someone replied to your comment.",
    link: `/library?meme=${meme_id || ""}`,
    entityId: parent_id,
  });
});

// ─── Trigger 4: Staffroom Reply ───────────────────────────────────────────────
// Fires when a /staffroom_replies/{replyId} doc is created.
// Notifies the original post author.
exports.onStaffroomReply = onDocumentCreated("staffroom_replies/{replyId}", async (event) => {
  const reply = event.data.data();
  const { post_id, author_id: actorId, content } = reply;
  if (!post_id || !actorId) return;

  const postSnap = await db.collection("staffroom_posts").doc(post_id).get();
  if (!postSnap.exists) return;
  const recipientId = postSnap.data().author_id;
  const actorName = await getUserName(actorId);

  await createNotification({
    recipientId,
    actorId,
    actorName,
    type: "staffroom_reply",
    title: `${actorName} replied to your Staffroom post`,
    body: content ? content.substring(0, 120) : "Someone replied in the Staffroom.",
    link: `/staffroom?post=${post_id}`,
    entityId: post_id,
  });
});

// ─── Trigger 5: Literacy Badge Awarded ───────────────────────────────────────
// Fires when a /literacy_badges/{badgeId} doc is created.
// Notifies the user themselves (celebratory notification).
exports.onLiteracyBadgeAwarded = onDocumentCreated("literacy_badges/{badgeId}", async (event) => {
  const badge = event.data.data();
  const { user_id, badge_label, badge_icon, test_title, score_pct } = badge;
  if (!user_id) return;

  await db.collection("notifications").add({
    user_id,
    actor_id: null,
    actor_name: "MemeClassroom",
    type: "literacy_badge",
    title: `🏅 Badge Earned: ${badge_label || "Literacy Badge"}!`,
    body: `You scored ${score_pct}% on "${test_title || "the assessment"}" and earned the ${badge_icon || "🏅"} ${badge_label} badge!`,
    link: "/profile",
    entity_id: event.params.badgeId,
    read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// ─── Trigger 6: Activity Milestone Badge ──────────────────────────────────────
// Fires when a /badges/{badgeId} doc is created (contribution milestones).
// Notifies the user themselves.
exports.onActivityMilestoneAwarded = onDocumentCreated("badges/{badgeId}", async (event) => {
  const badge = event.data.data();
  const { user_id, badge_name } = badge;
  if (!user_id || !badge_name) return;

  await db.collection("notifications").add({
    user_id,
    actor_id: null,
    actor_name: "MemeClassroom",
    type: "milestone_badge",
    title: `🎖️ Milestone Reached: ${badge_name}!`,
    body: `Congratulations! You've unlocked the "${badge_name}" achievement badge.`,
    link: "/profile",
    entity_id: event.params.badgeId,
    read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// ─── Trigger 7: Resource Bookmarked ──────────────────────────────────────────
// Fires when a /saves/{saveId} doc with content_type === "resource" is created.
// Notifies the resource author.
exports.onResourceBookmarked = onDocumentCreated("saves/{saveId}", async (event) => {
  const save = event.data.data();
  const { resource_id, user_id: actorId, content_type } = save;
  if (!resource_id || !actorId || content_type !== "resource") return;

  const resSnap = await db.collection("resources").doc(resource_id).get();
  if (!resSnap.exists) return;
  const recipientId = resSnap.data().author_id;
  const actorName = await getUserName(actorId);

  await createNotification({
    recipientId,
    actorId,
    actorName,
    type: "resource_bookmark",
    title: `${actorName} bookmarked your resource`,
    body: `"${(resSnap.data().title || "Your resource")}" was saved by ${actorName}.`,
    link: `/resources`,
    entityId: resource_id,
  });
});

// ─── Trigger 8: User Followed (future-ready) ──────────────────────────────────
// Fires when a /follows/{followId} doc is created.
// Notifies the followed user.
exports.onUserFollowed = onDocumentCreated("follows/{followId}", async (event) => {
  const follow = event.data.data();
  const { followed_id: recipientId, follower_id: actorId } = follow;
  if (!recipientId || !actorId) return;

  const actorName = await getUserName(actorId);

  await createNotification({
    recipientId,
    actorId,
    actorName,
    type: "follow",
    title: `${actorName} started following you`,
    body: `${actorName} is now following your profile on MemeClassroom.`,
    link: `/profile`,
    entityId: actorId,
  });
});

// ─── Newspaper Auto-Fetch (Stage 2) ───────────────────────────────────────────
// Runs on a schedule, pulls items from configs/newspaper_sources (falling back
// to DEFAULT_NEWSPAPER_SOURCES if that doc doesn't exist), and writes new items
// into /newspaper_items — the same collection manual/admin/user submissions use.
// Items from a domain in TRUSTED_NEWS_DOMAINS publish immediately; everything
// else queues for admin review, exactly like a human submission does.

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

exports.fetchNewspaperItems = onSchedule(
  { schedule: "every 48 hours", timeoutSeconds: 300 },
  async () => {
    let sources = DEFAULT_NEWSPAPER_SOURCES;
    try {
      const sourcesSnap = await db.collection("configs").doc("newspaper_sources").get();
      const configured = sourcesSnap.exists ? sourcesSnap.data().sources : null;
      if (Array.isArray(configured) && configured.length > 0) {
        sources = configured;
      }
    } catch (e) {
      console.error("Failed to load configs/newspaper_sources, using defaults", e);
    }

    for (const source of sources) {
      let feed;
      try {
        feed = await rssParser.parseURL(source.url);
      } catch (e) {
        console.error(`Failed to fetch/parse Newspaper source ${source.id || source.url}`, e.message);
        continue;
      }

      for (const entry of (feed.items || []).slice(0, 15)) {
        const link = entry.link || "";
        if (!link) continue;
        const externalId = entry.guid || link;

        try {
          // Dedupe: skip if this item was already stored on a previous run
          const existing = await db.collection("newspaper_items")
            .where("external_id", "==", externalId)
            .limit(1)
            .get();
          if (!existing.empty) continue;

          const domain = extractDomain(link);
          const isTrusted = TRUSTED_NEWS_DOMAINS.includes(domain);
          const rawSummary = entry.contentSnippet || entry.content || "";

          await db.collection("newspaper_items").add({
            title: (entry.title || "Untitled").slice(0, 200),
            source_url: link,
            source_domain: domain,
            summary_text: rawSummary.replace(/\s+/g, " ").trim().slice(0, 400),
            classroom_talking_point: "",
            category: source.default_category || "general",
            image_url: "",
            keywords: [],
            source_trust: isTrusted ? "trusted" : "unverified",
            admin_approved: isTrusted,
            status: "live",
            author_id: "system",
            author_name: "Auto-Fetched",
            view_count: 0,
            likes_count: 0,
            flag_count: 0,
            auto_fetched: true,
            fetch_source_id: source.id || null,
            external_id: externalId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (e) {
          console.error(`Failed to store Newspaper item from ${source.id || source.url}`, e.message);
        }
      }
    }
  }
);
