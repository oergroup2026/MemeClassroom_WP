// ─── Local Test Catalogue ──────────────────────────────────────────────────
// These tests are always available without Firebase — they use local question data.
// They appear first in the launcher, before any Firebase-sourced tests.
// Only beginner tests live here. Advanced/academic tests are managed via Firebase.

export const LOCAL_TESTS = [
  {
    id: "local-basic",
    title: "Meme Literacy Starter",
    description:
      "New to meme literacy? Start here. 15 simple questions that cover the basics — what memes mean, why people share them, and how to spot when they might be misleading.",
    difficulty: "beginner",
    badge_icon: "🌱",
    badge_label: "Meme Starter",
    pass_threshold: 60,
    question_count: 15,
    category: "Foundations",
    isLocal: true,
    questionsKey: "basic",
  },
];
