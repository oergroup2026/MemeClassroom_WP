/**
 * Client-Side Fuzzy Search & Matching Utility with Multilingual Support
 * Provides typo-tolerant substring, acronym, multi-field scoring,
 * Indic script transliteration (Hindi, Malayalam, Tamil), and autocomplete suggestions.
 */

// Comprehensive Indic & Academic Multilingual Dictionary
const TRANSLITERATION_MAP = {
  // --- Common Educational Abbreviations ---
  "math": "mathematics",
  "maths": "mathematics",
  "bio": "biology",
  "chem": "chemistry",
  "phy": "physics",
  "phys": "physics",
  "geo": "geography",
  "hist": "history",
  "lit": "literature",
  "sci": "science",
  "cs": "computer science",
  "comp": "computer",

  // --- Hindi (Romanized) ---
  "ganit": "mathematics",
  "ganita": "mathematics",
  "vigyan": "science",
  "vigyaan": "science",
  "itihas": "history",
  "itihaas": "history",
  "bhugol": "geography",
  "sahitya": "literature",
  "rasayan": "chemistry",
  "rasayanik": "chemistry",
  "jeev": "biology",
  "jeevvigyan": "biology",
  "bhautik": "physics",
  "bhautiki": "physics",
  "shikshak": "teacher",
  "adhyapak": "teacher",
  "pariksha": "exam",
  "kaksha": "classroom",
  "vidyalaya": "school",

  // --- Hindi (Devanagari Script) ---
  "गणित": "mathematics",
  "विज्ञान": "science",
  "इतिहास": "history",
  "भूगोल": "geography",
  "साहित्य": "literature",
  "रसायन": "chemistry",
  "रसायनशास्त्र": "chemistry",
  "जीव": "biology",
  "जीवविज्ञान": "biology",
  "भौतिकी": "physics",
  "भौतिक": "physics",
  "शिक्षक": "teacher",
  "अध्यापक": "teacher",
  "परीक्षा": "exam",
  "कक्षा": "classroom",

  // --- Malayalam (Romanized) ---
  "ganitham": "mathematics",
  "ganitam": "mathematics",
  "shastra": "science",
  "shastram": "science",
  "jeevashastram": "biology",
  "jeevasasthram": "biology",
  "bhouthikam": "physics",
  "bhautikam": "physics",
  "bhouthikashastram": "physics",
  "rasathanthram": "chemistry",
  "rasathantram": "chemistry",
  "charithram": "history",
  "charitram": "history",
  "bhoogolam": "geography",
  "bhugolam": "geography",
  "adhyapakan": "teacher",
  "adhyapika": "teacher",
  "pariksha": "exam",
  "padanam": "study",
  "vidyabhyasam": "education",

  // --- Malayalam (Malayalam Script) ---
  "ഗണിതം": "mathematics",
  "ശാസ്ത്രം": "science",
  "ജീവശാസ്ത്രം": "biology",
  "ഭൗതികം": "physics",
  "ഭൗതികശാസ്ത്രം": "physics",
  "രസതന്ത്രം": "chemistry",
  "ചരിത്രം": "history",
  "ഭൂഗോളം": "geography",
  "സാഹിത്യം": "literature",
  "അധ്യാപകൻ": "teacher",
  "അധ്യാപിക": "teacher",
  "പരീക്ഷ": "exam",
  "വിദ്യാഭ്യാസം": "education",

  // --- Tamil (Romanized & Script) ---
  "kanitham": "mathematics",
  "ganidham": "mathematics",
  "kannitham": "mathematics",
  "ariviyal": "science",
  "araiviyal": "science",
  "uyiriyal": "biology",
  "iyarpiyal": "physics",
  "vedhiyiyal": "chemistry",
  "varalaaru": "history",
  "puviyiyal": "geography",
  "ilakkiyam": "literature",
  "aasiriyar": "teacher",
  "thervu": "exam",
  "கணிதம்": "mathematics",
  "அறிவியல்": "science",
  "உயிரியல்": "biology",
  "இயற்பியல்": "physics",
  "வேதியியல்": "chemistry",
  "வரலாறு": "history",
  "புவியியல்": "geography",
  "இலக்கியம்": "literature",
  "ஆசிரியர்": "teacher",
  "தேர்வு": "exam"
};

/**
 * Transliterates or maps Indic text/romanization to normalized English equivalent.
 * Returns the mapped string, or the normalized input if no translation is found.
 */
export function transliterate(str) {
  if (!str) return "";
  const raw = str.toString().trim().toLowerCase();
  
  if (TRANSLITERATION_MAP[raw]) {
    return TRANSLITERATION_MAP[raw];
  }

  // Normalize diacritics
  const normalized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (TRANSLITERATION_MAP[normalized]) {
    return TRANSLITERATION_MAP[normalized];
  }

  return normalized;
}

export function normalize(str) {
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
export function matchScore(target, query) {
  const t = normalize(target);
  const q = normalize(query);

  if (!t || !q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;

  // Word prefix match
  const words = t.split(/[\s-_/]+/);
  if (words.some((w) => w.startsWith(q))) return 50;

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
 * Filter and sort items array using fuzzy multi-field search with multilingual expansion.
 * @param {Array} items - Array of objects
 * @param {string} queryStr - User query
 * @param {Array<{field: string, weight: number}>} fieldWeights - Weighted fields to inspect
 */
export function fuzzySearch(
  items,
  queryStr,
  fieldWeights = [
    { field: "title", weight: 3 },
    { field: "body", weight: 1 }
  ]
) {
  if (!items || !Array.isArray(items)) return [];
  if (!queryStr || !queryStr.trim()) return items;

  const rawTerms = queryStr.trim().split(/\s+/).filter(Boolean);

  // Expand each term with transliterated equivalent if available
  const queryTerms = rawTerms.map((term) => {
    const transliterated = transliterate(term);
    return {
      original: term,
      translated: transliterated !== term ? transliterated : null
    };
  });

  const scoredItems = items.map((item) => {
    let totalScore = 0;

    for (const termObj of queryTerms) {
      let termBestScore = 0;

      for (const { field, weight = 1 } of fieldWeights) {
        const val = field.split(".").reduce((obj, key) => obj?.[key], item);

        const checkVal = (v) => {
          if (!v) return;
          // Match with original query term
          let s = matchScore(v, termObj.original) * weight;
          // Also match with translated/transliterated term
          if (termObj.translated) {
            const transScore = matchScore(v, termObj.translated) * weight * 0.95;
            if (transScore > s) s = transScore;
          }
          if (s > termBestScore) termBestScore = s;
        };

        if (Array.isArray(val)) {
          for (const elem of val) checkVal(elem);
        } else if (val) {
          checkVal(val);
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

/**
 * Returns top-N ranked suggestions for autocomplete / typeahead search dropdowns.
 * @param {Array} items - Array of data objects
 * @param {string} partialQuery - What the user typed so far
 * @param {Array<{field: string, weight: number}>} fieldWeights - Field weights
 * @param {number} limit - Max suggestions to return (default 5)
 */
export function getSuggestions(
  items,
  partialQuery,
  fieldWeights = [
    { field: "title", weight: 3 },
    { field: "subject", weight: 2 },
    { field: "keywords", weight: 2 }
  ],
  limit = 5
) {
  if (!partialQuery || !partialQuery.trim() || partialQuery.trim().length < 2) {
    return [];
  }

  const queryClean = partialQuery.trim();
  const transliterated = transliterate(queryClean);
  const isTranslated = transliterated.toLowerCase() !== queryClean.toLowerCase();

  const matchedItems = fuzzySearch(items, queryClean, fieldWeights);
  const suggestions = [];
  const seenLabels = new Set();

  for (const item of matchedItems) {
    const title = item.title || item.name || "";
    if (title && !seenLabels.has(title.toLowerCase())) {
      seenLabels.add(title.toLowerCase());
      
      suggestions.push({
        label: title,
        item,
        type: item._type || item.type || item.format || "item",
        subject: item.subject || "",
        isTranslated,
        translatedQuery: isTranslated ? transliterated : null
      });
    }

    // Also check keywords for extra useful suggestions if room available
    if (Array.isArray(item.keywords)) {
      for (const kw of item.keywords) {
        if (
          kw &&
          !seenLabels.has(kw.toLowerCase()) &&
          (matchScore(kw, queryClean) > 0 || (isTranslated && matchScore(kw, transliterated) > 0))
        ) {
          seenLabels.add(kw.toLowerCase());
          suggestions.push({
            label: kw,
            item,
            type: "keyword",
            subject: item.subject || "",
            isKeyword: true,
            isTranslated,
            translatedQuery: isTranslated ? transliterated : null
          });
        }
        if (suggestions.length >= limit) break;
      }
    }

    if (suggestions.length >= limit) break;
  }

  return suggestions.slice(0, limit);
}
