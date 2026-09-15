// newspaperCategories.js — Category taxonomy for the Newspaper feed
// Fixed list for Stage 1 (not wired to live Firestore `configs/taxonomy` yet).

export const NEWSPAPER_CATEGORIES = [
  { value: "politics", label: "Politics & Society", color: "rose" },
  { value: "health", label: "Health", color: "emerald" },
  { value: "environment", label: "Environment", color: "teal" },
  { value: "science", label: "Science & Tech", color: "indigo" },
  { value: "misinformation", label: "Misinformation Watch", color: "amber" },
  { value: "new_slang_meme", label: "New Formats & Slang", color: "fuchsia" },
  { value: "study_research", label: "Studies & Research", color: "sky" },
  { value: "classroom_use", label: "Classroom Use Ideas", color: "violet" },
  { value: "general", label: "General", color: "gray" },
];

// Domains that auto-publish without admin approval once Stage 2 (auto-fetch)
// is built. Unused in Stage 1 — every human submission requires approval
// regardless of destination domain.
export const TRUSTED_NEWS_DOMAINS = [];
