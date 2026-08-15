/**
 * src/services/geminiClient.js
 * 
 * Client-side Gemini AI integration service with strict rate-limiting,
 * local quota tracking, and fallback simulation when API keys are not yet configured.
 */

const STORAGE_KEY = "memeclassroom_ai_quota";
export const DAILY_FREE_CREDITS = 5;

/**
 * Retrieves the current quota state for today
 */
export function getAiQuota() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to parse AI quota from storage", e);
  }

  // Reset for a new day
  const freshQuota = {
    date: today,
    creditsUsed: 0,
    bonusCredits: 0,
    totalLimit: DAILY_FREE_CREDITS,
  };
  saveAiQuota(freshQuota);
  return freshQuota;
}

/**
 * Saves quota back to localStorage
 */
function saveAiQuota(quota) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quota));
  } catch (e) {
    console.warn("Failed to save AI quota", e);
  }
}

/**
 * Checks if user has available AI credits
 */
export function hasAvailableAiCredits() {
  const q = getAiQuota();
  const available = (q.totalLimit + (q.bonusCredits || 0)) - q.creditsUsed;
  return available > 0;
}

/**
 * Deducts 1 AI credit upon successful API call
 */
export function consumeAiCredit() {
  const q = getAiQuota();
  q.creditsUsed = (q.creditsUsed || 0) + 1;
  saveAiQuota(q);
  return (q.totalLimit + (q.bonusCredits || 0)) - q.creditsUsed;
}

/**
 * Grants bonus credits (e.g. from simulated ad view)
 */
export function addBonusAiCredits(amount = 3) {
  const q = getAiQuota();
  q.bonusCredits = (q.bonusCredits || 0) + amount;
  saveAiQuota(q);
  return (q.totalLimit + q.bonusCredits) - q.creditsUsed;
}

/**
 * Fetches configured Gemini API Key from environment or localStorage
 */
function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem("memeclassroom_gemini_key") || "";
}

/**
 * Call Gemini 1.5 Flash (free tier compatible)
 */
export async function generateGeminiContent({ prompt, systemInstruction = "", imageBase64 = null }) {
  if (!hasAvailableAiCredits()) {
    throw new Error("QUOTA_EXCEEDED");
  }

  const apiKey = getApiKey();

  // If no Gemini API key is provided, provide smart educational fallback responses so the UI works seamlessly
  if (!apiKey) {
    consumeAiCredit();
    return simulateFallbackResponse(prompt, systemInstruction);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const contents = [];
  const parts = [];

  if (imageBase64) {
    // Strip header prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: cleanBase64
      }
    });
  }

  parts.push({ text: prompt });
  contents.push({ parts });

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 600,
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API call failed (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  consumeAiCredit();
  return text;
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

/**
 * Smart educational simulation for zero-config / offline testing
 */
function simulateFallbackResponse(prompt, systemInstruction) {
  if (prompt.includes("punchlines") || prompt.includes("captions")) {
    return `1. "When the teacher says the test is open-book, but the answers aren't in the book either."\n2. "Mitochondria calculating how to be the powerhouse of the cell for the 10,000th time today."\n3. "Me explaining to my homework why we can't be together tonight."`;
  }
  if (prompt.includes("Analyze this educational meme")) {
    return `**Alt-Text:** A stylized educational template featuring contrasting character panels highlighting scientific concepts.\n\n**Academic Punchline:** Juxtaposes intuitive misconceptions with scientifically validated empirical facts to trigger memorable recall.\n\n**Classroom Discussion:** What assumption is this meme challenging, and how does visual exaggeration reinforce the key lesson?`;
  }
  return `Great effort! While your choice had elements of truth, the correct answer is the standard pedagogical principle here. Look closely at the visual rhetoric and context clues when evaluating similar media.`;
}
