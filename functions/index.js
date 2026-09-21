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
 * page HTML directly (bounded by a timeout) and regex-extracts
 * <meta property="og:image"> first, then og:image:secure_url, then
 * twitter:image / twitter:image:src.
 *
 * Many of our RSS sources (Google News search results) link through a
 * news.google.com redirect rather than straight to the publisher, and
 * `fetch()` follows that redirect — so `res.url` after the fetch is the
 * *real* article URL, which is also more useful to store as source_url /
 * source_domain than the redirect link. Returns { imageUrl, resolvedUrl }
 * — both "" / the original url on failure — never throws.
 */
async function fetchOgImage(url) {
  if (!url) return { imageUrl: "", resolvedUrl: url };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "MemeClassroomNewspaperBot/1.0 (+https://memeclassroom-98d2b.web.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const resolvedUrl = res.url || url;
    if (!res.ok) return { imageUrl: "", resolvedUrl };
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { imageUrl: "", resolvedUrl };

    // Only read the first chunk of the response — og/twitter meta tags live
    // in <head>, so there's no need to download the entire page body.
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      while (html.length < 200000) {
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

    let imageUrl = metaTag("og:image") || metaTag("og:image:secure_url") || metaTag("twitter:image") || metaTag("twitter:image:src") || "";
    // Meta image URLs are occasionally site-relative ("/img/hero.jpg") —
    // resolve against the final (post-redirect) article URL.
    if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
      try {
        imageUrl = new URL(imageUrl, resolvedUrl).href;
      } catch {
        imageUrl = "";
      }
    }

    return { imageUrl, resolvedUrl };
  } catch (e) {
    console.error(`fetchOgImage failed for ${url}`, e.message);
    Sentry.captureException(e);
    return { imageUrl: "", resolvedUrl: url };
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

/**
 * Shared RSS-fetch-and-store loop used by both the weekly scheduled fetch and
 * the admin "force fetch" action below. `respectWeeklyCap` reproduces the
 * scheduled job's "at most one new auto-fetched item per category per 7
 * days" limit; force-fetch turns that off so it can immediately backfill up
 * to `maxPerCategory` items per category regardless of what's already been
 * fetched this week. Returns how many items were added, per category.
 */
async function runNewspaperFetch({ maxPerCategory, respectWeeklyCap }) {
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
  if (respectWeeklyCap) {
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
  }

  const addedPerCategory = {};
  let totalAdded = 0;
  const isCategoryFull = (category) =>
    (respectWeeklyCap && categoriesFilledThisWeek.has(category)) ||
    (addedPerCategory[category] || 0) >= maxPerCategory;

  for (const source of sources) {
    const category = source.default_category || "general";
    if (isCategoryFull(category)) continue;

    let feed;
    try {
      feed = await rssParser.parseURL(source.url);
    } catch (e) {
      console.error(`Failed to fetch/parse Newspaper source ${source.id || source.url}`, e.message);
      Sentry.captureException(e);
      continue;
    }

    for (const entry of (feed.items || []).slice(0, 15)) {
      if (isCategoryFull(category)) break; // filled by an earlier entry from this same source

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

        const rawSummary = entry.contentSnippet || entry.content || "";

        let imageUrl = extractThumbnail(entry);
        // source_url/source_domain default to the RSS entry's own link, but
        // several of our sources (Google News searches) link through a
        // redirect page rather than the publisher — when we have to scrape
        // the page anyway for a thumbnail, use the resolved final URL
        // (fetch() follows the redirect) so "Read at <source>" and the
        // domain shown actually point at the real article.
        let finalLink = link;
        if (!imageUrl) {
          const scraped = await fetchOgImage(link);
          imageUrl = scraped.imageUrl;
          if (scraped.resolvedUrl) finalLink = scraped.resolvedUrl;
        }
        const domain = extractDomain(finalLink) || extractDomain(link);
        const isTrusted = TRUSTED_NEWS_DOMAINS.includes(domain);

        await db.collection("newspaper_items").add({
          title: (entry.title || "Untitled").slice(0, 200),
          source_url: finalLink,
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

        addedPerCategory[category] = (addedPerCategory[category] || 0) + 1;
        totalAdded += 1;
        if (respectWeeklyCap) categoriesFilledThisWeek.add(category);
      } catch (e) {
        console.error(`Failed to store Newspaper item from ${source.id || source.url}`, e.message);
        Sentry.captureException(e);
      }
    }
  }

  return { totalAdded, addedPerCategory };
}

exports.fetchNewspaperItems = onSchedule(
  { schedule: "every 168 hours", timeoutSeconds: 300 },
  async () => {
    await runNewspaperFetch({ maxPerCategory: 1, respectWeeklyCap: true });
  }
);

// Admin-triggered immediate fetch that backfills up to 5 items per category
// right away, instead of waiting on the weekly schedule's one-per-category
// cadence. Wired to the Admin > Newspaper "Force Fetch" button so the feed
// doesn't sit empty while the scheduled job slowly fills in over several
// weeks. Uses the exact same sources, dedupe, and approval rules as the
// scheduled fetch — it just lifts the one-per-category-per-week cap.
exports.forceFetchNewspaperItems = onCall({ timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to do this.");
  }
  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  const role = userSnap.exists ? userSnap.data().role : null;
  if (role !== "admin" && role !== "manager") {
    throw new HttpsError("permission-denied", "Admins only.");
  }

  return runNewspaperFetch({ maxPerCategory: 5, respectWeeklyCap: false });
});

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

  const { imageUrl } = await fetchOgImage(url);
  return { imageUrl };
});


// ─── Meme Lab AI (Gemini) ────────────────────────────────────────────────────
//
// The Gemini API key used to be called directly from the browser
// (src/services/geminiClient.js), which put the key in every page load and
// left the "5 free credits/day" quota enforced only in localStorage — either
// one cleared the browser's storage for unlimited free calls. Both the key
// and the quota now live here: the key never reaches the client, and the
// per-user daily count is the source of truth in /ai_quota/{uid}.

const GEMINI_DAILY_FREE_CREDITS = 5;
const GEMINI_BONUS_CREDITS_PER_CLAIM = 3;
const GEMINI_MAX_BONUS_CLAIMS_PER_DAY = 3; // caps the "watch a sponsor clip" bonus at +9/day

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Loads a user's AI quota doc, resetting it if the stored date isn't today. */
async function loadOrResetAiQuota(uid) {
  const ref = db.collection("ai_quota").doc(uid);
  const snap = await ref.get();
  const today = todayKey();
  if (!snap.exists || snap.data().date !== today) {
    const fresh = {
      date: today,
      creditsUsed: 0,
      bonusCredits: 0,
      bonusClaims: 0,
      totalLimit: GEMINI_DAILY_FREE_CREDITS,
    };
    await ref.set(fresh);
    return { ref, quota: fresh };
  }
  return { ref, quota: snap.data() };
}

/** Strips internal bookkeeping (bonusClaims) before returning quota to a client. */
function aiQuotaPublicView(quota) {
  return {
    date: quota.date,
    creditsUsed: quota.creditsUsed || 0,
    bonusCredits: quota.bonusCredits || 0,
    totalLimit: quota.totalLimit || GEMINI_DAILY_FREE_CREDITS,
  };
}

/** Same canned responses the old client-side fallback used when no API key was configured. */
function simulateGeminiFallback(prompt) {
  if (prompt.includes("punchlines") || prompt.includes("captions")) {
    return `1. "When the teacher says the test is open-book, but the answers aren't in the book either."\n2. "Mitochondria calculating how to be the powerhouse of the cell for the 10,000th time today."\n3. "Me explaining to my homework why we can't be together tonight."`;
  }
  if (prompt.includes("Analyze this educational meme")) {
    return `**Alt-Text:** A stylized educational template featuring contrasting character panels highlighting scientific concepts.\n\n**Academic Punchline:** Juxtaposes intuitive misconceptions with scientifically validated empirical facts to trigger memorable recall.\n\n**Classroom Discussion:** What assumption is this meme challenging, and how does visual exaggeration reinforce the key lesson?`;
  }
  return `Great effort! While your choice had elements of truth, the correct answer is the standard pedagogical principle here. Look closely at the visual rhetoric and context clues when evaluating similar media.`;
}

// Returns the caller's current AI quota (creating/resetting it for today if needed).
exports.getAiQuota = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const { quota } = await loadOrResetAiQuota(request.auth.uid);
  return aiQuotaPublicView(quota);
});

// Grants the "watch a sponsor clip" bonus credits, capped per day server-side
// so repeated calls can't hand out unlimited credits.
exports.addAiBonusCredits = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  const { ref, quota } = await loadOrResetAiQuota(request.auth.uid);
  const claims = quota.bonusClaims || 0;
  if (claims >= GEMINI_MAX_BONUS_CLAIMS_PER_DAY) {
    return aiQuotaPublicView(quota);
  }
  const updated = {
    ...quota,
    bonusCredits: (quota.bonusCredits || 0) + GEMINI_BONUS_CREDITS_PER_CLAIM,
    bonusClaims: claims + 1,
  };
  await ref.set(updated);
  return aiQuotaPublicView(updated);
});

// Generates AI text (meme captions, image explanations, quiz feedback) for the
// Meme Lab, Library, and Meme Literacy Test pages. Enforces the daily quota
// and holds the Gemini key server-side; falls back to canned responses when
// GEMINI_API_KEY isn't configured (functions/.env), matching the old
// zero-config dev experience without exposing a key.
exports.generateAiContent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to use AI features.");
  }
  const { prompt, systemInstruction = "", imageBase64 = null } = request.data || {};
  if (!prompt || typeof prompt !== "string") {
    throw new HttpsError("invalid-argument", "A prompt is required.");
  }

  const { ref, quota } = await loadOrResetAiQuota(request.auth.uid);
  const available = (quota.totalLimit + (quota.bonusCredits || 0)) - (quota.creditsUsed || 0);
  if (available <= 0) {
    throw new HttpsError("resource-exhausted", "QUOTA_EXCEEDED");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  let text;
  if (!apiKey) {
    text = simulateGeminiFallback(prompt);
  } else {
    const parts = [];
    if (imageBase64) {
      const cleanBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      parts.push({ inline_data: { mime_type: "image/jpeg", data: cleanBase64 } });
    }
    parts.push({ text: prompt });

    const payload = {
      contents: [{ parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
    };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Gemini API request failed", e.message);
      Sentry.captureException(e);
      throw new HttpsError("unavailable", "The AI service is temporarily unavailable. Please try again.");
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API call failed", response.status, errorData);
      Sentry.captureException(new Error(errorData.error?.message || `Gemini API call failed (${response.status})`));
      throw new HttpsError("internal", "The AI service is temporarily unavailable. Please try again.");
    }
    const data = await response.json();
    text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  const updatedQuota = { ...quota, creditsUsed: (quota.creditsUsed || 0) + 1 };
  await ref.set(updatedQuota);

  return { text, quota: aiQuotaPublicView(updatedQuota) };
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
