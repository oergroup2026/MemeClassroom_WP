/**
 * newspaperConfig.js — Config for the Newspaper auto-fetch scheduled function.
 *
 * Cloud Functions can't import from src/, so TRUSTED_NEWS_DOMAINS here is a
 * separate copy of src/constants/newspaperCategories.js's list — keep both in
 * sync by hand when trusted domains are added.
 */

"use strict";

// Domains whose auto-fetched items publish immediately (admin_approved: true).
// Empty by default: every auto-fetched item queues for admin review until an
// admin adds domains here (and to the matching frontend list) they trust.
const TRUSTED_NEWS_DOMAINS = [];

// Default RSS sources used when the configs/newspaper_sources Firestore doc
// doesn't exist yet. An admin can add/edit sources there later (collection:
// configs, doc: newspaper_sources, field: sources — an array of these same
// {id, url, default_category} objects) without redeploying this function.
const DEFAULT_NEWSPAPER_SOURCES = [
  {
    id: "gnews_misinformation",
    url: "https://news.google.com/rss/search?q=meme+misinformation&hl=en-US&gl=US&ceid=US:en",
    default_category: "misinformation",
  },
  {
    id: "gnews_politics",
    url: "https://news.google.com/rss/search?q=meme+politics&hl=en-US&gl=US&ceid=US:en",
    default_category: "politics",
  },
  {
    id: "gnews_health",
    url: "https://news.google.com/rss/search?q=meme+public+health&hl=en-US&gl=US&ceid=US:en",
    default_category: "health",
  },
  {
    id: "gnews_environment",
    url: "https://news.google.com/rss/search?q=meme+climate+environment&hl=en-US&gl=US&ceid=US:en",
    default_category: "environment",
  },
  {
    id: "gnews_research",
    url: "https://news.google.com/rss/search?q=meme+study+research&hl=en-US&gl=US&ceid=US:en",
    default_category: "study_research",
  },
  {
    id: "gnews_slang",
    url: "https://news.google.com/rss/search?q=internet+slang+new+word&hl=en-US&gl=US&ceid=US:en",
    default_category: "new_slang_meme",
  },
  // Classroom/education-specific searches, added per user request — mirrors
  // vocabulary already used across the app (see homepage_content.md:
  // "meme pedagogy", "memes in the classroom", "meme literacy").
  {
    id: "gnews_classroom",
    url: "https://news.google.com/rss/search?q=%22classroom+memes%22+OR+%22memes+for+classroom%22+OR+%22educational+memes%22+OR+%22meme+pedagogy%22&hl=en-US&gl=US&ceid=US:en",
    default_category: "classroom_use",
  },
  {
    id: "gnews_academia",
    url: "https://news.google.com/rss/search?q=%22academic+memes%22+OR+%22college+memes%22+OR+%22study+memes%22&hl=en-US&gl=US&ceid=US:en",
    default_category: "classroom_use",
  },
  {
    id: "gnews_meme_literacy",
    url: "https://news.google.com/rss/search?q=%22meme+literacy%22+OR+%22digital+literacy+memes%22&hl=en-US&gl=US&ceid=US:en",
    default_category: "study_research",
  },
  // Meme community sources, added per user request (example: cheezburger.com's
  // "Academia Memes for Struggling Students and Scholars"). These aren't news
  // outlets, so items from them are NOT in TRUSTED_NEWS_DOMAINS — every item
  // still queues for admin review before it's visible, same as any other
  // auto-fetched item from an unlisted domain.
  {
    id: "reddit_academic_memes",
    url: "https://www.reddit.com/r/AcademicMemes/.rss",
    default_category: "classroom_use",
  },
  {
    id: "reddit_college_memes",
    url: "https://www.reddit.com/r/CollegeMemes/.rss",
    default_category: "classroom_use",
  },
];

module.exports = { TRUSTED_NEWS_DOMAINS, DEFAULT_NEWSPAPER_SOURCES };
