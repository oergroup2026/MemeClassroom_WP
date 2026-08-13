import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  collection, query, where, getDocs, orderBy, limit,
  addDoc, updateDoc, serverTimestamp, runTransaction, doc, increment
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";
import { X, Search, Plus, Trash2, Link, BookOpen, FileText } from "lucide-react";
import RichTextArea from "./RichTextArea";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatSlidesEmbedUrl = (url) => {
  if (!url) return "";
  let trimmed = url.trim();

  // If user pasted an <iframe> HTML snippet, extract the src URL
  if (trimmed.includes("<iframe")) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      trimmed = srcMatch[1].trim();
    }
  }

  // Google Slides format
  const googleMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/(e\/[^\/]+|[^\/]+)/);
  if (googleMatch && googleMatch[1]) {
    return `https://docs.google.com/presentation/d/${googleMatch[1]}/embed`;
  }

  // Canva format
  if (trimmed.includes("canva.com/design/")) {
    const [baseUrl] = trimmed.split("?");
    const cleanPath = baseUrl.replace(/\/(edit|watch|present|view)$/, "/view");
    const finalUrl = cleanPath.endsWith("/view") ? cleanPath : `${cleanPath}/view`;
    return `${finalUrl}?embed`;
  }

  return trimmed;
};

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
export default function ActivityContributeModal({ onClose, onSuccess, subjects: subjectsProp, gradeGroups: gradeGroupsProp, availableTags, activityToEdit }) {
  const { user } = useAuth();
  const subjects = subjectsProp || SUBJECTS;
  const gradeGroups = gradeGroupsProp || GRADE_GROUPS;
  const isEditing = Boolean(activityToEdit);

  // Form state
  const [title, setTitle] = useState(activityToEdit?.title || "");
  const [body, setBody] = useState(activityToEdit?.body || "");
  const [subject, setSubject] = useState(() => {
    if (!activityToEdit?.subject) return "Biology";
    return subjects.includes(activityToEdit.subject) ? activityToEdit.subject : "Other";
  });
  const [customSubject, setCustomSubject] = useState(() => {
    if (!activityToEdit?.subject) return "";
    return subjects.includes(activityToEdit.subject) ? "" : activityToEdit.subject;
  });
  const [gradeGroup, setGradeGroup] = useState(activityToEdit?.grade_group || "High School (9–10)");
  const [remarks, setRemarks] = useState(activityToEdit?.educator_notes || "");
  const [isClassroomFriendly, setIsClassroomFriendly] = useState(activityToEdit?.is_classroom_friendly ?? true);

  // Cover image
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(activityToEdit?.cover_image_url || "");

  // PDF
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState(activityToEdit?.pdf_url ? "Attached PDF document" : "");
  const [slidesEmbedUrl, setSlidesEmbedUrl] = useState(activityToEdit?.slides_embed_url || "");

  // Videos
  const [videos, setVideos] = useState(
    activityToEdit?.videos?.length ? activityToEdit.videos : [{ url: "", label: "" }]
  );

  // References
  const [references, setReferences] = useState(
    activityToEdit?.references?.length ? activityToEdit.references : []
  );
  const [searchPickerType, setSearchPickerType] = useState(null); // "internal_meme" | "internal_resource"
  const [searchPickerRefIdx, setSearchPickerRefIdx] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Cover preview
  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL ? URL.createObjectURL(coverFile) : "";
    setCoverPreview(url);
    return () => { if (url) URL.revokeObjectURL(url); };
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
    if (!pdfFile && !slidesEmbedUrl.trim() && !activityToEdit?.pdf_url && !activityToEdit?.slides_embed_url) {
      setError("Please upload a PDF or provide a Google Slides / Canva embed link.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let pdfUrl = activityToEdit?.pdf_url || "";
      let coverUrl = activityToEdit?.cover_image_url || "";

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

      if (isEditing) {
        const updateData = {
          title: title.trim(),
          body: body.trim(),
          cover_image_url: coverUrl,
          pdf_url: pdfUrl,
          slides_embed_url: formatSlidesEmbedUrl(slidesEmbedUrl),
          subject: finalSubject,
          grade_group: gradeGroup,
          educator_notes: remarks.trim(),
          is_classroom_friendly: Boolean(isClassroomFriendly),
          videos: cleanVideos,
          references: cleanRefs,
          updated_at: serverTimestamp()
        };
        await updateDoc(doc(db, "resources", activityToEdit.id), updateData);
        if (onSuccess) onSuccess({ id: activityToEdit.id, ...activityToEdit, ...updateData });
        onClose();
        return;
      }

      const statsDocRef = doc(db, "user_stats", user.uid);
      const resColRef = collection(db, "resources");

      let createdDocId = null;
      await runTransaction(db, async (transaction) => {
        const statsSnap = await transaction.get(statsDocRef);
        const newDocRef = doc(resColRef);
        createdDocId = newDocRef.id;

        const activityData = {
          type: "activity",
          status: "live",
          admin_approved: false,
          title: title.trim(),
          body: body.trim(),
          cover_image_url: coverUrl,
          pdf_url: pdfUrl,
          slides_embed_url: formatSlidesEmbedUrl(slidesEmbedUrl),
          subject: finalSubject,
          grade_group: gradeGroup,
          educator_notes: remarks.trim(),
          is_classroom_friendly: Boolean(isClassroomFriendly),
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

      if (onSuccess) onSuccess({ id: createdDocId });
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
              {isEditing ? "✏️ Edit Use Case / Activity" : "🎯 Contribute a Use Case / Activity"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEditing
                ? "Update details, presentation PDF, videos, and notes."
                : "Your activity goes live immediately with a 'Pending Approval' badge until reviewed by admin."}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📋 Basic Info</h3>
            <div>
              <label className={labelClass}>Activity Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Short Description</label>
              <RichTextArea value={body} onChange={e => setBody(e.target.value)} rows={3} />
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

          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">🖼️ Cover Thumbnail</h3>
            <div className="flex items-center gap-4">
              {coverPreview ? (
                <div className="relative flex-shrink-0">
                  <img src={coverPreview} alt="Cover preview"
                    className="w-24 h-16 object-cover rounded-xl border border-gray-200 dark:border-zinc-700" />
                  <button type="button" onClick={() => { setCoverFile(null); setCoverPreview(""); }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs">
                    ×
                  </button>
                </div>
              ) : null}
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  if (e.target.files[0]) setCoverFile(e.target.files[0]);
                }}
                className={inputClass}
              />
            </div>
          </div>

          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📄 Presentation (PDF, Google Slides, or Canva)</h3>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Upload PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={e => {
                    const f = e.target.files[0];
                    if (f) {
                      setPdfFile(f);
                      setPdfName(f.name);
                    }
                  }}
                  className={inputClass}
                />
                {pdfName && <p className="text-[11px] text-purple-600 font-semibold mt-1">📄 {pdfName}</p>}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-zinc-700"></div>
                <span className="flex-shrink mx-3 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold uppercase tracking-wider">OR</span>
                <div className="flex-grow border-t border-gray-200 dark:border-zinc-700"></div>
              </div>

              <div>
                <label className={labelClass}>Google Slides / Canva Embed Link</label>
                <input
                  type="url"
                  value={slidesEmbedUrl}
                  onChange={e => setSlidesEmbedUrl(e.target.value)}
                  placeholder="https://docs.google.com/presentation/d/.../embed or https://www.canva.com/design/.../view"
                  className={inputClass}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Paste a Google Slides embed link or Canva presentation link/embed code.
                </p>
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">🎬 Embedded Videos</h3>
              <button type="button" onClick={addVideo}
                className="text-[11px] font-extrabold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Video
              </button>
            </div>
            <div className="space-y-3">
              {videos.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={v.url}
                    onChange={e => updateVideo(i, "url", e.target.value)}
                    placeholder="YouTube or Vimeo URL..."
                    className={inputClass + " flex-1"}
                  />
                  <input
                    type="text"
                    value={v.label}
                    onChange={e => updateVideo(i, "label", e.target.value)}
                    placeholder="Label (optional)"
                    className={inputClass + " w-36"}
                  />
                  {videos.length > 1 && (
                    <button type="button" onClick={() => removeVideo(i)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={sectionClass}>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">📚 References & Attachments</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={addExternalRef}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline">
                  + External URL
                </button>
                <button type="button" onClick={() => addInternalRef("internal_meme")}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  + Meme
                </button>
                <button type="button" onClick={() => addInternalRef("internal_resource")}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  + Resource
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {references.map((r, i) => (
                <div key={i} className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={r.label}
                      onChange={e => updateRef(i, "label", e.target.value)}
                      placeholder="Reference label..."
                      className={inputClass}
                    />
                    {r.type === "external" ? (
                      <input
                        type="url"
                        value={r.url}
                        onChange={e => updateRef(i, "url", e.target.value)}
                        placeholder="https://..."
                        className={inputClass}
                      />
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
          </div>

          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">🏫 Guidelines & Suitability</h3>
            <div className="flex items-start gap-2.5 p-3 bg-purple-50/50 dark:bg-zinc-800/60 border border-purple-100 dark:border-zinc-700/60 rounded-xl">
              <input
                type="checkbox"
                id="actClassroomFriendlyCheck"
                checked={isClassroomFriendly}
                onChange={e => setIsClassroomFriendly(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
              />
              <label htmlFor="actClassroomFriendlyCheck" className="text-xs text-gray-800 dark:text-gray-200 font-bold cursor-pointer select-none">
                Classroom & Student Friendly
              </label>
            </div>
          </div>

          <div className={sectionClass}>
            <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1.5">📝 Remarks if any</h3>
            <RichTextArea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-[10px] text-gray-400">
            {isEditing ? "✏️ Updating activity" : "⏳ Will be posted live with a \"Pending Approval\" badge"}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-zinc-700 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition text-gray-600 dark:text-gray-300">
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (isEditing ? "Saving..." : "Publishing...") : (isEditing ? "Save Changes" : "🎯 Publish Activity")}
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
