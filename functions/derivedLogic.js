"use strict";
/**
 * derivedLogic.js — pure rules for server-owned numbers (no Firebase imports,
 * so they can be unit tested from the root test suite).
 *
 * Likes, view/like counters, user_stats and level badges are DERIVED data:
 * they must follow from real actions, not from whatever number a browser
 * chooses to write. derivedData.js applies these rules inside Cloud Functions;
 * firestore.rules stops clients writing the results.
 */

const LEVEL_NAMES = ["None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"];

// Mirrors CATEGORY_NAMES in src/pages/Profile.jsx (which only displays them now).
const BADGE_CATEGORIES = {
  content_creator: { label: "Meme Creator", statKey: "memes_created_count" },
  knowledge_contributor: { label: "Resource Sharer", statKey: "resources_contributed_count" },
  community_voice: { label: "Discussion Starter", statKey: "staffroom_posts_count" },
  peer_evaluator: { label: "Peer Reviewer", statKey: "ratings_provided_count" },
  star_educator: { label: "Community Favorite", statKey: "total_likes_received" },
  slang_master: { label: "Slang Master", statKey: "slang_quizzes_completed" },
};

/** Badge level for a counter value: 1 → Bronze … 50 → Diamond. */
function levelForCount(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n >= 50) return 5;
  if (n >= 25) return 4;
  if (n >= 10) return 3;
  if (n >= 5) return 2;
  if (n >= 1) return 1;
  return 0;
}

/** Ids that are not real user accounts (seed data, auto-fetched items). */
function isRealUid(id) {
  return typeof id === "string" && id.length > 0 && id !== "admin" && id !== "system";
}

/**
 * Stat changes caused by a document being created / edited / deleted.
 * `before`/`after` are the document data (or null). `isCounted(data)` says
 * whether a document currently counts toward its owner's stat, and `ownerOf`
 * returns the owner uid. Returns [{uid, delta}], empty when nothing changes.
 */
function ownershipDeltas(before, after, { isCounted, ownerOf }) {
  const out = [];
  const was = before && isCounted(before) && isRealUid(ownerOf(before)) ? ownerOf(before) : null;
  const now = after && isCounted(after) && isRealUid(ownerOf(after)) ? ownerOf(after) : null;
  if (was && now && was === now) return out;
  if (was) out.push({ uid: was, delta: -1 });
  if (now) out.push({ uid: now, delta: 1 });
  return out;
}

// Drafts are saved in /memes with visibility "draft"; they only count once published.
const isPublishedMeme = (d) => d.visibility !== "draft";
const alwaysCounted = () => true;

// Collections whose view_count is maintained from /views receipts.
const VIEW_KINDS = ["memes", "resources", "newspaper_items"];

/**
 * Badges a user should hold given their stats, as
 * [{ id, category, level, badge_name, ... }]. Mirrors the old client logic:
 * one badge per category, at the CURRENT level, plus the Contributor badge.
 */
function badgesFor(uid, stats) {
  const wanted = [
    {
      id: `${uid}__Contributor`,
      category: "account_setup",
      level: 1,
      badge_name: "Contributor",
      badge_icon: "award",
      description: "Earned for completing registration & account setup!",
    },
  ];
  for (const [category, cfg] of Object.entries(BADGE_CATEGORIES)) {
    const level = levelForCount(stats?.[cfg.statKey]);
    if (level > 0) {
      wanted.push({
        id: `${uid}__${category}__${level}`,
        category,
        level,
        badge_name: `${LEVEL_NAMES[level]} ${cfg.label}`,
        badge_icon: "award",
        description: "",
      });
    }
  }
  return wanted;
}

/** The subset of `wanted` the user does not already hold (match by name, or category+level). */
function missingBadges(wanted, existing) {
  const names = new Set(existing.map((b) => b.badge_name));
  const catLevels = new Set(existing.map((b) => `${b.category}|${b.level}`));
  return wanted.filter((b) => !names.has(b.badge_name) && !catLevels.has(`${b.category}|${b.level}`));
}

module.exports = {
  LEVEL_NAMES,
  BADGE_CATEGORIES,
  levelForCount,
  isRealUid,
  ownershipDeltas,
  isPublishedMeme,
  alwaysCounted,
  VIEW_KINDS,
  badgesFor,
  missingBadges,
};
