// taxonomyUtils.js — Shared utility for tracking custom taxonomy submissions
// Used by Lab.jsx and Library.jsx. Tracks how many times a custom subject or
// language is submitted. If count reaches 10, it auto-promotes to Firestore taxonomy.

import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Tracks a custom subject or language name submitted by users.
 * After 10 submissions, the name is automatically promoted into the
 * shared `configs/taxonomy` document so it appears for all users.
 *
 * @param {"subject" | "language"} type
 * @param {string} name - The custom value typed by the user
 */
export const trackCustomSubmission = async (type, name) => {
  if (!name || !name.trim()) return;
  const cleanName = name.trim();
  const docId = `${type}_${cleanName.toLowerCase()}`;
  const counterRef = doc(db, "custom_counts", docId);
  const taxRef = doc(db, "configs", "taxonomy");

  try {
    await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let count = 1;
      if (counterSnap.exists()) {
        count = (counterSnap.data().count || 0) + 1;
      }
      transaction.set(counterRef, { name: cleanName, count, type }, { merge: true });

      if (count >= 10) {
        const taxSnap = await transaction.get(taxRef);
        if (taxSnap.exists()) {
          const taxData = taxSnap.data();
          if (type === "subject") {
            const subjects = taxData.subjects || [];
            const exists = subjects.some(s => s.toLowerCase() === cleanName.toLowerCase());
            if (!exists) {
              const otherIdx = subjects.indexOf("Other");
              if (otherIdx !== -1) {
                subjects.splice(otherIdx, 0, cleanName);
              } else {
                subjects.push(cleanName);
              }
              transaction.update(taxRef, { subjects });
            }
          } else if (type === "language") {
            const languages = taxData.languages || [];
            const exists = languages.some(l => l.toLowerCase() === cleanName.toLowerCase());
            if (!exists) {
              const otherIdx = languages.indexOf("Other");
              if (otherIdx !== -1) {
                languages.splice(otherIdx, 0, cleanName);
              } else {
                languages.push(cleanName);
              }
              transaction.update(taxRef, { languages });
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Error tracking custom submission", err);
  }
};
