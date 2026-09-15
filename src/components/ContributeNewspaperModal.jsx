/**
 * ContributeNewspaperModal.jsx
 *
 * Simple single-step submission form for the Newspaper feed.
 * Always creates a pending item (admin_approved: false) — trusted-source
 * auto-publish only applies to Stage 2's automated fetching, not to a
 * human-submitted link, so every submission here needs admin review.
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, runTransaction, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { X } from "lucide-react";
import { NEWSPAPER_CATEGORIES } from "../constants/newspaperCategories";

const labelClass = "block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1";
const inputBase = "w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-gray-800 dark:text-gray-200";

const SUMMARY_MAX = 400;

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default function ContributeNewspaperModal({ onClose, onSuccess }) {
  const { user, profile } = useAuth();

  const [form, setForm] = useState({
    title: "",
    sourceUrl: "",
    summaryText: "",
    category: NEWSPAPER_CATEGORIES[0].value,
    classroomTalkingPoint: "",
    imageUrl: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { setError("Please sign in to contribute."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.sourceUrl.trim()) { setError("A source link is required."); return; }
    if (!form.summaryText.trim()) { setError("A short summary is required."); return; }

    let parsedUrl;
    try {
      parsedUrl = new URL(form.sourceUrl.trim());
    } catch {
      setError("Please enter a valid link, including https://");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const itemsColRef = collection(db, "newspaper_items");
      const statsDocRef = doc(db, "user_stats", user.uid);

      await runTransaction(db, async (transaction) => {
        const statsSnap = await transaction.get(statsDocRef);
        const newDocRef = doc(itemsColRef);
        transaction.set(newDocRef, {
          title: form.title.trim(),
          source_url: parsedUrl.toString(),
          source_domain: extractDomain(parsedUrl.toString()),
          summary_text: form.summaryText.trim().slice(0, SUMMARY_MAX),
          classroom_talking_point: form.classroomTalkingPoint.trim(),
          category: form.category,
          image_url: form.imageUrl.trim(),
          keywords: [],
          source_trust: "user_submitted",
          admin_approved: false,
          status: "live",
          author_id: user.uid,
          author_name: profile?.name || "Contributor",
          view_count: 0,
          likes_count: 0,
          flag_count: 0,
          auto_fetched: false,
          fetch_source_id: null,
          external_id: null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        if (statsSnap.exists()) {
          transaction.update(statsDocRef, { newspaper_items_contributed_count: increment(1) });
        } else {
          transaction.set(statsDocRef, { newspaper_items_contributed_count: 1 }, { merge: true });
        }
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("ContributeNewspaperModal submit failed", err);
      setError("Submission failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">📰 Contribute Newspaper Item</h2>
            <p className="text-xs text-gray-500 mt-0.5">Your item will go live immediately with a "Pending Admin Approval" badge.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className={labelClass}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. How a Meme Sparked a Public Health Conversation"
              className={inputBase}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Source Link *</label>
            <input
              type="url"
              value={form.sourceUrl}
              onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
              placeholder="https://..."
              className={inputBase}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Short Summary * ({form.summaryText.length}/{SUMMARY_MAX})</label>
            <textarea
              value={form.summaryText}
              onChange={(e) => setForm((f) => ({ ...f, summaryText: e.target.value.slice(0, SUMMARY_MAX) }))}
              placeholder="A couple of sentences — what's the story, and why does it involve memes?"
              rows={3}
              className={inputBase}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputBase}
            >
              {NEWSPAPER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Why This Matters For Class (optional)</label>
            <textarea
              value={form.classroomTalkingPoint}
              onChange={(e) => setForm((f) => ({ ...f, classroomTalkingPoint: e.target.value }))}
              placeholder="A quick note on how a teacher could use this in a lesson or discussion"
              rows={2}
              className={inputBase}
            />
          </div>

          <div>
            <label className={labelClass}>Thumbnail Image URL (optional)</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://... (leave blank for a default card look)"
              className={inputBase}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-[10px] text-gray-400 flex-1">⏳ Will be posted live with a "Pending Approval" badge</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-zinc-700 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition text-gray-600 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {loading ? "Publishing..." : "Publish Item"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
