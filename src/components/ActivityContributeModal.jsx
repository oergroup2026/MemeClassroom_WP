import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  collection, query, where, getDocs, orderBy, limit,
  addDoc, serverTimestamp, runTransaction, doc, increment
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";
import { X, Search, Plus, Trash2, Link, BookOpen, FileText } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const detectVideoPlatform = (url) => {
  if (!url) return null;
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  return null;
};

const buildEmbedUrl = (url) => {
  try {
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("youtube.com/watch")) {
      const id = new URL(url).searchParams.get("v");
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes("youtube.com/embed")) return url;
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${id}`;
    }
    if (url.includes("player.vimeo.com")) return url;
  } catch (_) {}
  return url;
};

// ─── Internal Search (shared for memes + resources) ──────────────────────────
const InternalSearchPicker = ({ type, onSelect, onClose }) => {
  const [query_, setQuery_] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      if (type === "internal_meme") {
        // Search memes collection
        const snap = await getDocs(
          query(collection(db, "memes"),
            where("status", "==", "approved"),
            limit(15))
        );
        const all = [];
        snap.forEach(d => all.push({ id: d.id, ...d.data() }));
        setResults(all.filter(m =>
          m.title?.toLowerCase().includes(q.toLowerCase()) ||
          m.name?.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 8));
      } else {
        // Search resources collection
        const snap = await getDocs(collection(db, "resources"));
        const all = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.type !== "activity" && data.status !== "admin_hidden") {
            all.push({ id: d.id, ...data });
          }
        });
        setResults(all.filter(r =>
          r.title?.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 8));
      }
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setSearching(false);
    }
  }, [type]);

  useEffect(() => {
    const t = setTimeout(() => search(query_), 350);
    return () => clearTimeout(t);
  }, [query_, search]);

  const icon = type === "internal_meme" ? "😂" : "📄";

  return (
    <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-md p-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            {type === "internal_meme" ? "🔍 Search Library Memes" : "🔍 Search Resources"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            autoFocus
            type="text"
            value={query_}
            onChange={e => setQuery_(e.target.value)}
            placeholder={type === "internal_meme" ? "Search by meme name..." : "Search by resource title..."}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {searching && (
            <p className="text-xs text-gray-400 text-center py-4">Searching...</p>
          )}
          {!searching && results.length === 0 && query_.length > 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No results found.</p>
          )}
          {!searching && results.length === 0 && query_.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Start typing to search...</p>
          )}
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-purple-50 dark:hover:bg-purple-950/20 transition"
            >
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  {item.title || item.name || item.meme_name || "Untitled"}
                </p>
                {item.type && (
                  <p className="text-[10px] text-gray-400 capitalize">{item.type.replace(/_/g, " ")}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Tag input with autocomplete ─────────────────────────────────────────────
const TagInput = ({ selectedTags, availableTags, onChange }) => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = availableTags.filter(t =>
    t.toLowerCase().includes(input.toLowerCase()) && !selectedTags.includes(t)
  );

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (!trimmed || selectedTags.includes(trimmed)) return;
    onChange([...selectedTags, trimmed]);
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag) => onChange(selectedTags.filter(t => t !== tag));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-purple-900 dark:hover:text-purple-100 leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); addTag(input); }
            if (e.key === "," || e.key === ";") { e.preventDefault(); addTag(input); }
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Type a strategy tag and press Enter..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
            {suggestions.slice(0, 6).map(s => (
              <button
                key={s}
                onMouseDown={() => addTag(s)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/20 text-gray-700 dark:text-gray-300 transition"
              >
                {s}
              </button>
            ))}
            {input.trim() && !availableTags.includes(input.trim()) && (
              <button
                onMouseDown={() => addTag(input)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-950/20 text-purple-600 dark:text-purple-400 font-bold border-t border-gray-100 dark:border-zinc-800 transition"
              >
                + Add "{input.trim()}" as new tag
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ActivityContributeModal({ onClose, onSuccess, subjects: subjectsProp, gradeGroups: gradeGroupsProp, availableTags }) {
  const { user } = useAuth();
  const subjects = subjectsProp || SUBJECTS;
  const gradeGroups = gradeGroupsProp || GRADE_GROUPS;

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("Biology");
  const [customSubject, setCustomSubject] = useState("");
  const [gradeGroup, setGradeGroup] = useState("High School (9–10)");
  const [remarks, setRemarks] = useState("");

  // Cover image
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");

  // PDF
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [slidesEmbedUrl, setSlidesEmbedUrl] = useState("");

  // Videos
  const [videos, setVideos] = useState([{ url: "", label: "" }]);

  // References
  const [references, setReferences] = useState([]);
  const [searchPickerType, setSearchPickerType] = useState(null); // "internal_meme" | "internal_resource"
  const [searchPickerRefIdx, setSearchPickerRefIdx] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Cover preview
  useEffect(() => {
    if (!coverFile) { setCoverPreview(""); return; }
    const url = URL.parse ? URL.createObjectURL(coverFile) : URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  // ── Video helpers
  const addVideo = () => setVideos(v => [...v, { url: "", label: "" }]);
  const removeVideo = (i) => setVideos(v => v.filter((_, idx) => idx !== i));
  const updateVideo = (i, field, val) => setVideos(v => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  // ── Reference helpers
  const addExternalRef = () => setReferences(r => [...r, { type: "external", label: "", url: "" }]);
  const addInternalRef = (type) => setReferences(r => [...r, { type, label: "", resource_id: "" }]);
  const removeRef = (i) => setReferences(r => r.filter((_, idx) => idx !== i));
  const updateRef = (i, field, val) => setReferences(r => r.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const openSearchPicker = (refIdx, type) => {
    setSearchPickerRefIdx(refIdx);
    setSearchPickerType(type);
  };
  const onSearchSelect = (item) => {
    if (searchPickerRefIdx === null) return;
    const label = item.title || item.name || item.meme_name || "Untitled";
    updateRef(searchPickerRefIdx, "resource_id", item.id);
    updateRef(searchPickerRefIdx, "label", label);
    setSearchPickerType(null);
    setSearchPickerRefIdx(null);
  };

  // ── Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { setError("Please sign in to contribute."); return; }
    if (!title.trim()) { setError("Title is required."); return; }
    if (!pdfFile && !slidesEmbedUrl.trim()) { setError("Please upload a PDF or provide a Google Slides embed URL."); return; }

    setLoading(true);
    setError("");

    try {
      let pdfUrl = "";
      let coverUrl = "";

      if (pdfFile) {
        const pdfRef = ref(storage, `activities/pdf_${user.uid}_${Date.now()}`);
        const snap = await uploadBytes(pdfRef, pdfFile);
        pdfUrl = await getDownloadURL(snap.ref);
      }
      if (coverFile) {
        const covRef = ref(storage, `activities/cover_${user.uid}_${Date.now()}`);
        const snap = await uploadBytes(covRef, coverFile);
        coverUrl = await getDownloadURL(snap.ref);
      }

      const cleanVideos = videos
        .filter(v => v.url.trim() && detectVideoPlatform(v.url))
        .map(v => ({
          url: buildEmbedUrl(v.url.trim()),
          label: v.label.trim() || "",
          platform: detectVideoPlatform(v.url.trim())
        }));

      const cleanRefs = references.filter(r =>
        (r.type === "external" && r.url.trim()) ||
        (r.type !== "external" && r.resource_id)
      );

      const finalSubject = subject === "Other" ? customSubject.trim() : subject;

      const statsDocRef = doc(db, "user_stats", user.uid);
      const resColRef = collection(db, "resources");

      await runTransaction(db, async (transaction) => {
        const statsSnap = await transaction.get(statsDocRef);
        const newDocRef = doc(resColRef);

        const activityData = {
          type: "activity",
          status: "live",
          admin_approved: false,
          title: title.trim(),
          body: body.trim(),
          cover_image_url: coverUrl,
          pdf_url: pdfUrl,
          slides_embed_url: slidesEmbedUrl.trim(),
          subject: finalSubject,
          grade_group: gradeGroup,
          educator_notes: remarks.trim(),
          videos: cleanVideos,
          references: cleanRefs,
          author_id: user.uid,
          author_name: user.displayName || "",
          likes_count: 0,
          view_count: 0,
          flag_count: 0,
          comments_count: 0,
          created_at: serverTimestamp()
        };

        transaction.set(newDocRef, activityData);

        if (statsSnap.exists()) {
          transaction.update(statsDocRef, { resources_contributed_count: increment(1) });
        } else {
          transaction.set(statsDocRef, { resources_contributed_count: 1 }, { merge: true });
        }
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Activity submit failed", err);
      setError("Submission failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-200";
  const labelClass = "block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1";
  const sectionClass = "bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/60 rounded-xl p-4 space-y-3";

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">🎯 Contribute an Activity</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your activity goes live immediately with a "Pending Approval" badge until reviewed by admin.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ── Section 1: Basic Info */}
          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📋 Basic Info</h3>
            <div>
              <label className={labelClass}>Activity Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                placeholder="e.g. Caption This: Cell Division Edition"
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Short Description (optional)</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={2}
                placeholder="Brief description of the activity..."
                className={inputClass + " resize-none"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Subject *</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className={inputClass}>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {subject === "Other" && (
                  <input type="text" value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                    placeholder="Specify subject..." className={inputClass + " mt-2"} />
                )}
              </div>
              <div>
                <label className={labelClass}>Grade Group *</label>
                <select value={gradeGroup} onChange={e => setGradeGroup(e.target.value)} className={inputClass}>
                  {gradeGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Section 2: Cover Image */}
          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">🖼️ Cover Thumbnail</h3>
            <div className="flex items-center gap-4">
              {coverPreview ? (
                <div className="relative flex-shrink-0">
                  <img src={coverPreview} alt="Cover preview"
                    className="w-24 h-16 object-cover rounded-xl border border-gray-200 dark:border-zinc-700" />
                  <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(""); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-600 flex items-center justify-center text-gray-300 flex-shrink-0">
                  🖼️
                </div>
              )}
              <div>
                <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
                  📁 Choose Image
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => setCoverFile(e.target.files?.[0] || null)} />
                </label>
                <p className="text-[10px] text-gray-400 mt-1">Optional. JPG, PNG, WebP. Max 5 MB.</p>
              </div>
            </div>
          </div>

          {/* ── Section 3: Presentation */}
          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📄 Presentation *</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Upload a PDF (from PowerPoint / Google Slides) or paste a Google Slides embed URL. At least one is required.</p>

            {/* PDF Upload */}
            <div>
              <label className={labelClass}>Upload PDF (recommended)</label>
              <label className="cursor-pointer flex items-center gap-3 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 transition">
                <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="min-w-0">
                  {pdfName ? (
                    <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{pdfName}</p>
                  ) : (
                    <p className="text-xs text-gray-500">Click to select PDF file (max 20 MB)</p>
                  )}
                </div>
                <input type="file" accept=".pdf" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) { setPdfFile(f); setPdfName(f.name); }
                  }} />
              </label>
              {pdfFile && (
                <button type="button" onClick={() => { setPdfFile(null); setPdfName(""); }}
                  className="mt-1 text-[10px] text-red-500 hover:underline">Remove</button>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
              OR
              <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
            </div>

            {/* Google Slides embed URL */}
            <div>
              <label className={labelClass}>Google Slides Embed URL</label>
              <input type="url" value={slidesEmbedUrl} onChange={e => setSlidesEmbedUrl(e.target.value)}
                placeholder="https://docs.google.com/presentation/d/…/embed"
                className={inputClass} />
              <p className="text-[10px] text-gray-400 mt-1">
                In Google Slides: File → Share → Publish to web → Embed → Copy link
              </p>
            </div>
          </div>

          {/* ── Section 4: Videos */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">🎬 Embedded Videos</h3>
              {videos.length < 5 && (
                <button type="button" onClick={addVideo}
                  className="flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  <Plus className="w-3 h-3" /> Add video
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400">Paste YouTube or Vimeo URLs (up to 5).</p>
            {videos.map((v, i) => {
              const platform = detectVideoPlatform(v.url);
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="relative">
                      <input type="url" value={v.url}
                        onChange={e => updateVideo(i, "url", e.target.value)}
                        placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                        className={inputClass} />
                      {platform && (
                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold ${platform === "youtube" ? "text-red-500" : "text-blue-500"}`}>
                          {platform === "youtube" ? "▶ YouTube" : "✦ Vimeo"}
                        </span>
                      )}
                    </div>
                    <input type="text" value={v.label}
                      onChange={e => updateVideo(i, "label", e.target.value)}
                      placeholder="Video label (optional)"
                      className={inputClass} />
                  </div>
                  <button type="button" onClick={() => removeVideo(i)}
                    className="mt-1 text-gray-400 hover:text-red-500 transition flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Section 5: References */}
          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📚 References</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={addExternalRef}
                  className="flex items-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  <Link className="w-3 h-3" /> External
                </button>
                <button type="button" onClick={() => addInternalRef("internal_meme")}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                  <span>😂</span> Library Meme
                </button>
                <button type="button" onClick={() => addInternalRef("internal_resource")}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  <BookOpen className="w-3 h-3" /> Resource
                </button>
              </div>
            </div>
            {references.length === 0 && (
              <p className="text-[10px] text-gray-400">No references added yet. Use the buttons above to add links.</p>
            )}
            {references.map((r, i) => (
              <div key={i} className="flex items-start gap-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3">
                <div className="flex-shrink-0 mt-0.5 text-sm">
                  {r.type === "external" ? "🔗" : r.type === "internal_meme" ? "😂" : "📄"}
                </div>
                <div className="flex-1 space-y-1.5">
                  <input type="text" value={r.label}
                    onChange={e => updateRef(i, "label", e.target.value)}
                    placeholder={r.type === "external" ? "Reference label *" : "Auto-filled from search"}
                    className={inputClass}
                    readOnly={r.type !== "external" && !!r.resource_id}
                  />
                  {r.type === "external" ? (
                    <input type="url" value={r.url}
                      onChange={e => updateRef(i, "url", e.target.value)}
                      placeholder="https://..."
                      className={inputClass} />
                  ) : (
                    <button type="button"
                      onClick={() => openSearchPicker(i, r.type)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl text-xs text-gray-500 hover:border-purple-400 transition">
                      <Search className="w-3 h-3" />
                      {r.resource_id ? (
                        <span className="text-purple-600 dark:text-purple-400 font-bold">
                          {r.type === "internal_meme" ? "Meme" : "Resource"} selected — click to change
                        </span>
                      ) : (
                        <span>Click to search and select a {r.type === "internal_meme" ? "Library meme" : "resource"}...</span>
                      )}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => removeRef(i)}
                  className="text-gray-400 hover:text-red-500 transition flex-shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* ── Section 6: Remarks if any */}
          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📝 Remarks if any</h3>
            <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
              placeholder="Any additional remarks, notes, or tips for educators..."
              className={inputClass + " resize-none"} />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-[10px] text-gray-400">⏳ Will be posted live with a "Pending Approval" badge</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-zinc-700 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition text-gray-600 dark:text-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              form=""
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "Publishing..." : "🎯 Publish Activity"}
            </button>
          </div>
        </div>
      </div>

      {/* Internal search picker */}
      {searchPickerType && (
        <InternalSearchPicker
          type={searchPickerType}
          onSelect={onSearchSelect}
          onClose={() => { setSearchPickerType(null); setSearchPickerRefIdx(null); }}
        />
      )}
    </div>,
    document.body
  );
}
