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

const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Parser = require("rss-parser");
const Sentry = require("@sentry/node");
const { TRUSTED_NEWS_DOMAINS, DEFAULT_NEWSPAPER_SOURCES } = require("./newspaperConfig");

// No-op until SENTRY_DSN is set (functions/.env, see functions/.env.example) —
// captureException() below is safe to call either way.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

admin.initializeApp();
const db = admin.firestore();
// A descriptive User-Agent avoids Reddit's default rate-limiting/blocking of
// unauthenticated requests that use a generic client User-Agent.
const rssParser = new Parser({
  headers: { "User-Agent": "MemeClassroomNewspaperBot/1.0 (+https://memeclassroom-98d2b.web.app)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

/**
 * Best-effort thumbnail extraction from an RSS/Atom item. Tries, in order:
 * a plain <enclosure> image, <media:content>/<media:thumbnail>, then the
 * first <img> found in the item's HTML content/description.
 */
function extractThumbnail(entry) {
  if (entry.enclosure?.url && (!entry.enclosure.type || entry.enclosure.type.startsWith("image/"))) {
    return entry.enclosure.url;
  }
  const mediaUrl = entry.mediaContent?.[0]?.$?.url || entry.mediaThumbnail?.[0]?.$?.url;
  if (mediaUrl) return mediaUrl;

  const html = entry["content:encoded"] || entry.content || entry.summary || entry.contentSnippet || "";
  const match = /<img[^>]+src=["']([^"'>]+)["']/i.exec(html);
  return match ? match[1] : "";
}

/**
 * Best-effort Open Graph / Twitter Card thumbnail scrape for an article
 * URL, used when the RSS entry itself didn't carry an image. Fetches the
 * page HTML directly (bounded by a short timeout) and regex-extracts
 * <meta property="og:image" content="..."> first, then
 * <meta name="twitter:image" content="...">. Returns "" on any failure —
 * never throws, so callers can treat it like extractThumbnail().
 */
async function fetchOgImage(url) {
  if (!url) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "MemeClassroomNewspaperBot/1.0 (+https://memeclassroom-98d2b.web.app)" },
    });
    if (!res.ok) return "";
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return "";

    // Only read the first chunk of the response — og/twitter meta tags live
    // in <head>, so there's no need to download the entire page body.
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (html.length < 100000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
    } else {
      html = await res.text();
    }

    const metaTag = (property) => {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
        "i"
      );
      const m = re.exec(html);
      return m ? (m[1] || m[2] || "") : "";
    };

    return metaTag("og:image") || metaTag("twitter:image") || "";
  } catch (e) {
    console.error(`fetchOgImage failed for ${url}`, e.message);
    Sentry.captureException(e);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

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
  { schedule: "every 168 hours", timeoutSeconds: 300 },
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
      Sentry.captureException(e);
    }

    // Cap: at most one new auto-fetched item per category per 7-day window.
    // Filtering by auto_fetched happens in JS (not the query) so this needs
    // no composite Firestore index.
    const categoriesFilledThisWeek = new Set();
    try {
      const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentSnap = await db.collection("newspaper_items")
        .where("created_at", ">=", sevenDaysAgo)
        .get();
      recentSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.auto_fetched && d.category) categoriesFilledThisWeek.add(d.category);
      });
    } catch (e) {
      console.error("Failed to check this week's categories, proceeding without the cap", e.message);
      Sentry.captureException(e);
    }

    for (const source of sources) {
      const category = source.default_category || "general";
      if (categoriesFilledThisWeek.has(category)) continue; // already have one for this category this week

      let feed;
      try {
        feed = await rssParser.parseURL(source.url);
      } catch (e) {
        console.error(`Failed to fetch/parse Newspaper source ${source.id || source.url}`, e.message);
        Sentry.captureException(e);
        continue;
      }

      for (const entry of (feed.items || []).slice(0, 15)) {
        if (categoriesFilledThisWeek.has(category)) break; // filled by an earlier entry from this same source

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

          let imageUrl = extractThumbnail(entry);
          if (!imageUrl) {
            imageUrl = await fetchOgImage(link);
          }

          await db.collection("newspaper_items").add({
            title: (entry.title || "Untitled").slice(0, 200),
            source_url: link,
            source_domain: domain,
            summary_text: rawSummary.replace(/\s+/g, " ").trim().slice(0, 400),
            classroom_talking_point: "",
            category,
            image_url: imageUrl,
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

          categoriesFilledThisWeek.add(category);
        } catch (e) {
          console.error(`Failed to store Newspaper item from ${source.id || source.url}`, e.message);
          Sentry.captureException(e);
        }
      }
    }
  }
);

// Callable from the Contribute/Admin newspaper forms so a user pasting a
// source link can auto-suggest a thumbnail instead of always uploading one
// manually. Reuses the same og:image scrape the auto-fetch function falls
// back to.
exports.fetchArticleThumbnail = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to fetch a thumbnail.");
  }
  const url = (request.data?.url || "").trim();
  if (!url) throw new HttpsError("invalid-argument", "A url is required.");
  try {
    new URL(url);
  } catch {
    throw new HttpsError("invalid-argument", "That doesn't look like a valid URL.");
  }

  const imageUrl = await fetchOgImage(url);
  return { imageUrl };
});


// ─── Public profile cards ───────────────────────────────────────────────────
//
// /users/{uid} holds a user's school, town, state and country. It used to be
// readable by any signed-in user so that pages could show an author's name
// next to their meme or post — which meant anyone who registered could read
// the name, school and location of every student on the platform.
//
// The display fields are now mirrored into /user_cards/{uid}, which is all a
// page needs to render an author. /users/{uid} is restricted to its owner and
// admins. This mirror is the only writer of /user_cards; clients cannot write
// it (see firestore.rules), so a user cannot spoof another user's card.

const CARD_FIELDS = ["name", "role", "is_verified", "avatar_url", "tagline"];

/** The public-card projection of a user document. */
function toCard(data) {
  return {
    name: data.name || "Unknown User",
    role: data.role || "student",
    is_verified: data.is_verified === true,
    avatar_url: data.avatar_url || "",
    tagline: data.tagline || "",
  };
}

/** True when none of the mirrored fields differ. */
function cardMatches(card, data) {
  if (!card) return false;
  const next = toCard(data);
  return CARD_FIELDS.every((f) => card[f] === next[f]);
}

// Keep /user_cards/{uid} in step with /users/{uid}.
exports.mirrorUserCard = onDocumentWritten("users/{uid}", async (event) => {
  const uid = event.params.uid;
  const after = event.data?.after;
  const cardRef = db.collection("user_cards").doc(uid);

  try {
    if (!after?.exists) {
      await cardRef.delete().catch(() => {});
      return;
    }
    const data = after.data() || {};
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    // Skip the write when no mirrored field changed — most /users writes are
    // unrelated (setup flags, verification status) and would otherwise cost a
    // needless write on every one.
    if (before && cardMatches(toCard(before), data)) return;

    await cardRef.set(toCard(data), { merge: true });
  } catch (e) {
    console.error(`Failed to mirror user card for ${uid}`, e);
    Sentry.captureException(e);
  }
});

// Backfill for users who existed before the mirror, and a safety net for any
// mirror write that failed. Idempotent: it only writes cards that are missing
// or stale, so a run with nothing to do costs reads and no writes.
exports.backfillUserCards = onSchedule(
  { schedule: "30 3 * * *", timeZone: "Etc/UTC" },
  async () => {
    let written = 0;
    let scanned = 0;
    try {
      const [users, cards] = await Promise.all([
        db.collection("users").get(),
        db.collection("user_cards").get(),
      ]);
      const existing = new Map(cards.docs.map((d) => [d.id, d.data()]));

      let batch = db.batch();
      let pending = 0;
      for (const doc of users.docs) {
        scanned += 1;
        const data = doc.data() || {};
        if (cardMatches(existing.get(doc.id), data)) continue;

        batch.set(db.collection("user_cards").doc(doc.id), toCard(data), { merge: true });
        written += 1;
        pending += 1;
        // Firestore caps a batch at 500 writes.
        if (pending === 450) {
          await batch.commit();
          batch = db.batch();
          pending = 0;
        }
      }
      if (pending > 0) await batch.commit();

      // Remove cards whose user is gone.
      const userIds = new Set(users.docs.map((d) => d.id));
      const orphans = cards.docs.filter((d) => !userIds.has(d.id));
      for (const orphan of orphans) {
        await orphan.ref.delete().catch(() => {});
      }

      console.log(`backfillUserCards: scanned ${scanned}, wrote ${written}, removed ${orphans.length}`);
    } catch (e) {
      console.error("backfillUserCards failed", e);
      Sentry.captureException(e);
    }
  }
);
