/**
 * src/services/geminiClient.js
 *
 * Client for the Meme Lab's AI features. The actual Gemini API key and the
 * daily quota enforcement live server-side in Cloud Functions
 * (functions/index.js: generateAiContent / getAiQuota / addAiBonusCredits) —
 * this file never talks to Google directly, and never sees the key. The
 * localStorage cache here is a display-only mirror of the server's quota so
 * the UI can render instantly; the server is always the source of truth.
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const CACHE_KEY = "memeclassroom_ai_quota_cache";
export const DAILY_FREE_CREDITS = 5;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultQuota() {
  return { date: todayKey(), creditsUsed: 0, bonusCredits: 0, totalLimit: DAILY_FREE_CREDITS };
}

/**
 * Returns the last known quota (from cache), for instant UI render. Not
 * authoritative — call refreshAiQuota() to sync with the server.
 */
export function getAiQuota() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === todayKey()) return parsed;
    }
  } catch (e) {
    console.warn("Failed to parse cached AI quota", e);
  }
  return defaultQuota();
}

function cacheAiQuota(quota) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(quota));
  } catch (e) {
    console.warn("Failed to cache AI quota", e);
  }
}

export function hasAvailableAiCredits() {
  const q = getAiQuota();
  return (q.totalLimit + (q.bonusCredits || 0)) - q.creditsUsed > 0;
}

/** Syncs the cached quota with the server's authoritative count. */
export async function refreshAiQuota() {
  try {
    const fn = httpsCallable(functions, "getAiQuota");
    const res = await fn();
    cacheAiQuota(res.data);
    return res.data;
  } catch (e) {
    console.warn("Failed to refresh AI quota from server", e);
    return getAiQuota();
  }
}

/** Grants the "watch a sponsor clip" bonus credits (server caps claims/day). */
export async function addBonusAiCredits(amount = 3) {
  const fn = httpsCallable(functions, "addAiBonusCredits");
  const res = await fn({ amount });
  cacheAiQuota(res.data);
  return (res.data.totalLimit + (res.data.bonusCredits || 0)) - res.data.creditsUsed;
}

/**
 * Calls the generateAiContent Cloud Function. Throws Error("QUOTA_EXCEEDED")
 * when the server's daily quota is used up, matching the error contract
 * callers (Lab.jsx, Library.jsx, MemeLiteracyTest.jsx) already check for.
 */
export async function generateGeminiContent({ prompt, systemInstruction = "", imageBase64 = null }) {
  const fn = httpsCallable(functions, "generateAiContent");
  try {
    const res = await fn({ prompt, systemInstruction, imageBase64 });
    if (res.data?.quota) cacheAiQuota(res.data.quota);
    return res.data?.text || "";
  } catch (err) {
    if (err.code === "functions/resource-exhausted" || err.message === "QUOTA_EXCEEDED") {
      throw new Error("QUOTA_EXCEEDED", { cause: err });
    }
    throw new Error(err.message || "The AI service is temporarily unavailable. Please try again.", { cause: err });
  }
}

/**
 * Helper: Generate 3 classroom meme captions
 */
export async function generateMemeCaptions({ subject = "General", topic = "", tone = "witty & educational" }) {
  const prompt = `Generate 3 distinct, funny, and educational meme punchlines/captions for a school classroom context.
Subject: ${subject}
Topic/Concept: ${topic || "General subject knowledge"}
Tone: ${tone}

Format each on a new line starting with:
1.
2.
3. `;

  const systemInstruction = "You are an award-winning high school teacher and meme creator who makes learning viral, fun, and memorable for students without offensive content.";
  return generateGeminiContent({ prompt, systemInstruction });
}

/**
 * Helper: Generate accessible Alt-Text & visual educational explanation
 */
export async function explainMemeWithVision({ imageBase64, title = "" }) {
  const prompt = `Analyze this educational meme image titled "${title}".
Provide:
1. Short Accessibility Alt-Text (1 sentence describing the visual composition).
2. The Academic Punchline (what concept it illustrates).
3. Classroom Discussion Question (a question a teacher can ask students).`;

  const systemInstruction = "You are an expert in visual media literacy and educational pedagogy.";
  return generateGeminiContent({ prompt, systemInstruction, imageBase64 });
}

/**
 * Helper: Generate literacy test feedback explanation
 */
export async function explainQuizMistake({ questionTitle, selectedOption, correctOption, explanation }) {
  const prompt = `A student answered a meme literacy quiz question incorrectly.
Question: "${questionTitle}"
Student chose: "${selectedOption}"
Correct Answer: "${correctOption}"
Context: "${explanation || ""}"

Provide a friendly 2-3 sentence encouraging explanation clarifying why "${correctOption}" is correct and how to spot this nuance next time.`;

  const systemInstruction = "You are an encouraging digital media literacy educator.";
  return generateGeminiContent({ prompt, systemInstruction });
}
