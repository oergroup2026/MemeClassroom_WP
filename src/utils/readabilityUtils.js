/**
 * Text Readability Utilities (Flesch-Kincaid Reading Ease & Grade Level)
 * Zero API, completely client-side.
 */

function countSyllables(word) {
  word = word.toLowerCase().trim().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Remove common trailing silent letters
  word = word.replace(/(?:[^laeiouy]|ed|es|e)$/, "");
  word = word.replace(/^y/, "");

  const syllableMatches = word.match(/[aeiouy]{1,2}/g);
  return syllableMatches ? Math.max(1, syllableMatches.length) : 1;
}

export function computeReadabilityScore(text) {
  if (!text || typeof text !== "string") {
    return {
      score: 100,
      gradeLevel: 1,
      gradeLabel: "Introductory",
      wordsCount: 0,
      sentencesCount: 0,
      readingTimeMinutes: 0
    };
  }

  // Strip HTML / Markdown formatting if present
  const cleanText = text.replace(/<[^>]*>?/gm, "").replace(/[#*_`~[\]]/g, "");
  const words = cleanText.match(/\b[a-zA-Z0-9'-]+\b/g) || [];
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);

  const wordCount = Math.max(1, words.length);
  const sentenceCount = Math.max(1, sentences.length);

  let totalSyllables = 0;
  words.forEach(w => {
    totalSyllables += countSyllables(w);
  });

  // Flesch Reading Ease
  const rawEase = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (totalSyllables / wordCount);
  const readingEase = Math.max(0, Math.min(100, Math.round(rawEase)));

  // Flesch-Kincaid Grade Level
  const rawGrade = 0.39 * (wordCount / sentenceCount) + 11.8 * (totalSyllables / wordCount) - 15.59;
  const gradeLevel = Math.max(1, Math.round(rawGrade));

  let gradeLabel = "Elementary (Grade 1–5)";
  let badgeColor = "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300";

  if (gradeLevel >= 13) {
    gradeLabel = "College / Academic (Grade 13+)";
    badgeColor = "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
  } else if (gradeLevel >= 10) {
    gradeLabel = "High School (Grade 10–12)";
    badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  } else if (gradeLevel >= 6) {
    gradeLabel = "Middle School (Grade 6–9)";
    badgeColor = "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }

  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    score: readingEase,
    gradeLevel,
    gradeLabel,
    badgeColor,
    wordsCount: words.length,
    sentencesCount: sentences.length,
    readingTimeMinutes
  };
}
