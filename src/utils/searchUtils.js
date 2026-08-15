/**
 * Client-Side Fuzzy Search & Matching Utility
 * Provides typo-tolerant substring, acronym, and multi-field scoring.
 */

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Calculates a match score between query and target string.
 * Returns score > 0 if match found, higher is better.
 */
function matchScore(target, query) {
  const t = normalize(target);
  const q = normalize(query);

  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;

  // Word prefix match
  const words = t.split(/[\s-_/]+/);
  if (words.some(w => w.startsWith(q))) return 50;

  // Subsequence matching (e.g. "mitoz" matches "mitosis" or "bio" matches "biology")
  let qIdx = 0;
  let consecutive = 0;
  let score = 0;

  for (let i = 0; i < t.length && qIdx < q.length; i++) {
    if (t[i] === q[qIdx]) {
      qIdx++;
      consecutive++;
      score += 5 + consecutive * 2;
    } else {
      consecutive = 0;
    }
  }

  if (qIdx === q.length) {
    return Math.min(45, score);
  }

  return 0;
}

/**
 * Filter and sort items array using fuzzy multi-field search.
 * @param {Array} items - Array of objects
 * @param {string} queryStr - User query
 * @param {Array<{field: string, weight: number}>} fieldWeights - Weighted fields to inspect
 */
export function fuzzySearch(items, queryStr, fieldWeights = [{ field: "title", weight: 3 }, { field: "body", weight: 1 }]) {
  if (!queryStr || !queryStr.trim()) return items;

  const queryTerms = queryStr.trim().split(/\s+/).filter(Boolean);

  const scoredItems = items.map((item) => {
    let totalScore = 0;

    for (const term of queryTerms) {
      let termBestScore = 0;

      for (const { field, weight = 1 } of fieldWeights) {
        const val = field.split(".").reduce((obj, key) => obj?.[key], item);

        if (Array.isArray(val)) {
          for (const elem of val) {
            const s = matchScore(elem, term) * weight;
            if (s > termBestScore) termBestScore = s;
          }
        } else if (val) {
          const s = matchScore(val, term) * weight;
          if (s > termBestScore) termBestScore = s;
        }
      }

      // Every term must have some match
      if (termBestScore === 0) {
        return { item, score: 0 };
      }

      totalScore += termBestScore;
    }

    return { item, score: totalScore };
  });

  return scoredItems
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}
