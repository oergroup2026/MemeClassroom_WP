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
];

module.exports = { TRUSTED_NEWS_DOMAINS, DEFAULT_NEWSPAPER_SOURCES };
