/**
 * ContributeResourceModal.jsx
 *
 * Universal contribution modal for all resource types.
 * - Receives `defaultType` (string | null) from the parent.
 * - When defaultType is null (All Resources tab): shows a type-picker card grid first.
 * - When defaultType is "activity": delegates to ActivityContributeModal.
 * - All other types render type-specific sectioned forms matching ActivityContributeModal's design.
 * - Handles both CREATE and EDIT modes (editingResource prop).
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  collection, doc, addDoc, updateDoc, setDoc,
  runTransaction, increment, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { X, FileText, Image as ImageIcon, Link, BookOpen, User } from "lucide-react";
import ActivityContributeModal from "./ActivityContributeModal";
import RichTextArea from "./RichTextArea";
import ReadabilityIndicator from "./ReadabilityIndicator";

// ─── Shared helpers ────────────────────────────────────────────────────────────
const trackCustomSubmission = async (type, name) => {
  if (!name?.trim()) return;
  const cleanName = name.trim();
  const docId = `${type}_${cleanName.toLowerCase()}`;
  const counterRef = doc(db, "custom_counts", docId);
  const taxRef = doc(db, "configs", "taxonomy");
  try {
    await runTransaction(db, async (t) => {
      const counterSnap = await t.get(counterRef);
      const taxSnap = await t.get(taxRef);
      const count = (counterSnap.data()?.count || 0) + 1;
      t.set(counterRef, { name: cleanName, count, type }, { merge: true });
      if (count >= 10 && taxSnap.exists() && type === "subject") {
        const subs = taxSnap.data().subjects || [];
        if (!subs.some(s => s.toLowerCase() === cleanName.toLowerCase())) {
          const idx = subs.indexOf("Other");
          idx !== -1 ? subs.splice(idx, 0, cleanName) : subs.push(cleanName);
          t.update(taxRef, { subjects: subs });
        }
      }
    });
  } catch (_) {}
};

// ─── Type definitions ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  article: {
    label: "Article",
    icon: "📄",
    color: "indigo",
    description: "Blog posts, opinion pieces, or education articles",
    placeholder: "e.g. Cognitive Recalls on Meme-based Biology",
  },
  research_paper: {
    label: "Research Paper",
    icon: "🔬",
    color: "blue",
    description: "Academic papers, studies, or journal publications",
    placeholder: "e.g. Analysis of Meme Pedagogy in Classrooms",
  },
  activity: {
    label: "Classroom Activity",
    icon: "🎯",
    color: "purple",
    description: "Lesson plans, worksheets, or interactive classroom activities",
    placeholder: "e.g. Mitosis Meme Matching Game",
  },
  course: {
    label: "Course / Lesson",
    icon: "🎓",
    color: "emerald",
    description: "Structured courses, lesson modules, or curricula",
    placeholder: "e.g. Introduction to Memetics 101",
  },
  stories: {
    label: "Meme Story",
    icon: "📖",
    color: "amber",
    description: "The origin story and classroom use of a meme template",
    placeholder: "e.g. Winnie the Pooh Reading a Paper",
  },
  other: {
    label: "Other Tool / Resource",
    icon: "🛠️",
    color: "gray",
    description: "Any other educational resource or tool",
    placeholder: "e.g. Interactive Meme Timeline Tool",
  },
};

const COLOR_RING = {
  indigo: "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30",
  blue:   "border-blue-400 bg-blue-50 dark:bg-blue-950/30",
  purple: "border-purple-400 bg-purple-50 dark:bg-purple-950/30",
  emerald:"border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
  amber:  "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  gray:   "border-gray-400 bg-gray-50 dark:bg-gray-800/30",
};

const COLOR_BADGE = {
  indigo: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300",
  blue:   "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  purple: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
  emerald:"bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
  amber:  "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  gray:   "bg-gray-100 dark:bg-gray-800/40 text-gray-700 dark:text-gray-300",
};

// ─── Type Picker (Step 1 when no default type) ────────────────────────────────
const TypePicker = ({ onSelect }) => (
  <div className="flex flex-col h-full">
    <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800">
      <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
        ➕ What would you like to contribute?
      </h2>
      <p className="text-xs text-gray-500 mt-0.5">Choose the type of resource you want to share.</p>
    </div>
    <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
      {Object.entries(TYPE_CONFIG).map(([value, cfg]) => {
        const color = cfg.color;
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition hover:scale-[1.02] hover:shadow-md active:scale-95 ${COLOR_RING[color]}`}
          >
            <span className="text-3xl">{cfg.icon}</span>
            <div>
              <p className={`text-xs font-extrabold ${COLOR_BADGE[color].split(" ").slice(2).join(" ")}`}>
                {cfg.label}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                {cfg.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ─── Section wrapper matching ActivityContributeModal design ──────────────────
const Section = ({ title, children }) => (
  <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/60 rounded-xl p-4 space-y-3">
    <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-purple-600 dark:text-purple-400">
      {title}
    </h3>
    {children}
  </div>
);

const labelClass = "block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1";
const inputBase = "w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-800 dark:text-gray-200";

const ClassroomFriendlySection = ({ form, setForm }) => (
  <Section title="🏫 Guidelines & Suitability">
    <div className="flex items-start gap-2.5 p-3 bg-purple-50/50 dark:bg-zinc-800/60 border border-purple-100 dark:border-zinc-700/60 rounded-xl">
      <input
        type="checkbox"
        id="isClassroomFriendlyCheck"
        checked={form.isClassroomFriendly || false}
        onChange={e => setForm(f => ({ ...f, isClassroomFriendly: e.target.checked }))}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
      />
      <label htmlFor="isClassroomFriendlyCheck" className="text-xs text-gray-800 dark:text-gray-200 font-bold cursor-pointer select-none">
        Classroom & Student Friendly
        <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-normal leading-snug mt-0.5">
          Check if this tool or resource is designed for classroom learning and follows required student & child-friendly guidelines.
        </span>
      </label>
    </div>
  </Section>
);

// ─── Individual field-set forms per type ──────────────────────────────────────

/** ARTICLE / RESEARCH PAPER form */
const ArticleForm = ({ form, setForm, subjects, gradeGroups }) => (
  <>
    <Section title="📋 Basic Info">
      <div>
        <label className={labelClass}>{form.type === "research_paper" ? "Paper Title *" : "Article Title *"}</label>
        <input type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder={TYPE_CONFIG[form.type].placeholder}
          className={inputBase} required />
      </div>
      <div>
        <label className={labelClass}>Description / Abstract *</label>
        <RichTextArea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          rows={3} placeholder="Provide a detailed description..." />
        <ReadabilityIndicator text={form.body} className="mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Subject *</label>
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inputBase}>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {form.subject === "Other" && (
            <input type="text" value={form.customSubject}
              onChange={e => setForm(f => ({ ...f, customSubject: e.target.value }))}
              placeholder="Specify subject..." className={inputBase + " mt-2"} />
          )}
        </div>
        <div>
          <label className={labelClass}>Grade Group *</label>
          <select value={form.gradeGroup} onChange={e => setForm(f => ({ ...f, gradeGroup: e.target.value }))} className={inputBase}>
            {gradeGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
    </Section>

    {form.type === "research_paper" && (
      <Section title="📰 Publication Details">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Year of Publication</label>
            <input type="text" value={form.publicationYear}
              onChange={e => setForm(f => ({ ...f, publicationYear: e.target.value }))}
              placeholder="e.g. 2024" className={inputBase} />
          </div>
          <div>
            <label className={labelClass}>Journal / Publisher</label>
            <input type="text" value={form.publisherName}
              onChange={e => setForm(f => ({ ...f, publisherName: e.target.value }))}
              placeholder="e.g. Nature Science" className={inputBase} />
          </div>
        </div>
      </Section>
    )}

    <Section title="🔗 Link & File">
      <div>
        <label className={labelClass}>External URL</label>
        <input type="url" value={form.externalUrl}
          onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))}
          placeholder="https://doi.org/..." className={inputBase} />
      </div>
      <div>
        <label className={labelClass}>Upload PDF / File</label>
        <label className="cursor-pointer flex items-center gap-3 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 transition">
          <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="text-xs text-gray-500">{form.file?.name || "Click to upload PDF or file (max 20 MB)"}</span>
          <input type="file" className="hidden" onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))} />
        </label>
      </div>
      <div>
        <label className={labelClass}>Thumbnail Image (optional)</label>
        <div className="flex items-center gap-3">
          {form.thumbnailPreview && (
            <img src={form.thumbnailPreview} alt="Thumbnail" className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
          )}
          <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
            📁 Choose Image
            <input type="file" accept="image/*" className="hidden"
              onChange={e => {
                const file = e.target.files?.[0] || null;
                setForm(f => ({
                  ...f, thumbnailFile: file,
                  thumbnailPreview: file ? URL.createObjectURL(file) : ""
                }));
              }} />
          </label>
        </div>
      </div>
    </Section>

    <Section title="🏷️ Keywords">
      <input type="text" value={form.keywords}
        onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
        placeholder="e.g. biology, cell division, mitosis (comma-separated)"
        className={inputBase} />
    </Section>
    <ClassroomFriendlySection form={form} setForm={setForm} />
  </>
);

/** COURSE form */
const CourseForm = ({ form, setForm, subjects, gradeGroups }) => (
  <>
    <Section title="📋 Basic Info">
      <div>
        <label className={labelClass}>Course Title *</label>
        <input type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Introduction to Memetics 101" className={inputBase} required />
      </div>
      <div>
        <label className={labelClass}>Description *</label>
        <RichTextArea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          rows={3} placeholder="What will learners gain from this course?" />
        <ReadabilityIndicator text={form.body} className="mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Subject *</label>
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inputBase}>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {form.subject === "Other" && (
            <input type="text" value={form.customSubject}
              onChange={e => setForm(f => ({ ...f, customSubject: e.target.value }))}
              placeholder="Specify subject..." className={inputBase + " mt-2"} />
          )}
        </div>
        <div>
          <label className={labelClass}>Grade Group *</label>
          <select value={form.gradeGroup} onChange={e => setForm(f => ({ ...f, gradeGroup: e.target.value }))} className={inputBase}>
            {gradeGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
    </Section>

    <Section title="🔗 Course Link / Embed">
      <div>
        <label className={labelClass}>Course URL or Embed Link</label>
        <input type="url" value={form.externalUrl}
          onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))}
          placeholder="https://youtube.com/embed/... or external course URL"
          className={inputBase} />
      </div>
    </Section>

    <Section title="🖼️ Thumbnail">
      <div className="flex items-center gap-3">
        {form.thumbnailPreview && (
          <img src={form.thumbnailPreview} alt="Thumbnail" className="w-16 h-12 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
        )}
        <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
          📁 Choose Thumbnail
          <input type="file" accept="image/*" className="hidden"
            onChange={e => {
              const file = e.target.files?.[0] || null;
              setForm(f => ({
                ...f, thumbnailFile: file,
                thumbnailPreview: file ? URL.createObjectURL(file) : ""
              }));
            }} />
        </label>
      </div>
    </Section>

    <Section title="🏷️ Keywords">
      <input type="text" value={form.keywords}
        onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
        placeholder="e.g. memes, pedagogy (comma-separated)" className={inputBase} />
    </Section>
    <ClassroomFriendlySection form={form} setForm={setForm} />
  </>
);

/** MEME STORY form */
const StoryForm = ({ form, setForm }) => (
  <>
    <Section title="🎭 Meme Template Info">
      <div>
        <label className={labelClass}>Template / Meme Name *</label>
        <input type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Winnie the Pooh Reading a Paper" className={inputBase} required />
      </div>
      <div>
        <label className={labelClass}>Attach Template Image *</label>
        <label className="cursor-pointer flex items-center gap-3 bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 transition">
          <ImageIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-gray-500">{form.file?.name || "Click to upload template image"}</span>
          <input type="file" accept="image/*,video/*" className="hidden"
            onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))} />
        </label>
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
          💡 This image will be customizable by users in the Meme Lab.
        </p>
      </div>
    </Section>

    <Section title="📖 Background Story">
      <div>
        <label className={labelClass}>How it became a meme *</label>
        <RichTextArea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          rows={3}
          placeholder="How this template originated (movie, TV show, game, viral event) and how it gained popularity..." />
        <ReadabilityIndicator text={form.body} className="mt-2" />
      </div>
    </Section>

    <Section title="🎓 Classroom Use">
      <div>
        <label className={labelClass}>Typical Meaning & Usage</label>
        <RichTextArea value={form.usageContext} onChange={e => setForm(f => ({ ...f, usageContext: e.target.value }))}
          rows={2}
          placeholder="Used to express confusion while reading something complicated..." />
      </div>
      <div>
        <label className={labelClass}>Educational Use</label>
        <RichTextArea value={form.educationalUse} onChange={e => setForm(f => ({ ...f, educationalUse: e.target.value }))}
          rows={2}
          placeholder="Suggest classroom situations where this template can be used..." />
      </div>
    </Section>

    <Section title="🖼️ Example Images (optional)">
      <p className="text-[10px] text-gray-400">Upload real example images of this meme being used.</p>
      <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
        📁 Add Example Images
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={e => {
            const files = Array.from(e.target.files || []);
            setForm(f => ({ ...f, exampleFiles: [...(f.exampleFiles || []), ...files] }));
          }} />
      </label>
      {(form.exampleFiles || []).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {form.exampleFiles.map((file, i) => (
            <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-amber-300 dark:border-amber-700">
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <button type="button"
                onClick={() => setForm(f => ({ ...f, exampleFiles: f.exampleFiles.filter((_, idx) => idx !== i) }))}
                className="absolute top-0 right-0 bg-red-600 text-white rounded-bl p-0.5 text-[10px] font-bold">✕</button>
            </div>
          ))}
        </div>
      )}
    </Section>
    <ClassroomFriendlySection form={form} setForm={setForm} />
  </>
);

/** OTHER form */
const OtherForm = ({ form, setForm, subjects, gradeGroups }) => (
  <>
    <Section title="📋 Basic Info">
      <div>
        <label className={labelClass}>Resource Title *</label>
        <input type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Interactive Meme Timeline" className={inputBase} required />
      </div>
      <div>
        <label className={labelClass}>Description *</label>
        <RichTextArea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
          rows={3} placeholder="Describe this resource..." />
        <ReadabilityIndicator text={form.body} className="mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Subject</label>
          <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className={inputBase}>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Grade Group</label>
          <select value={form.gradeGroup} onChange={e => setForm(f => ({ ...f, gradeGroup: e.target.value }))} className={inputBase}>
            {gradeGroups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
    </Section>
    <Section title="🔗 Link & File">
      <div>
        <label className={labelClass}>External URL</label>
        <input type="url" value={form.externalUrl}
          onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))}
          placeholder="https://..." className={inputBase} />
      </div>
      <div>
        <label className={labelClass}>Attach File (optional)</label>
        <label className="cursor-pointer flex items-center gap-3 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 transition hover:bg-purple-50 dark:hover:bg-purple-950/20">
          <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <span className="text-xs text-gray-500">{form.file?.name || "Click to attach file"}</span>
          <input type="file" className="hidden" onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))} />
        </label>
      </div>
    </Section>
    <ClassroomFriendlySection form={form} setForm={setForm} />
  </>
);

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ContributeResourceModal({
  defaultType,
  onClose,
  onSuccess,
  subjects,
  gradeGroups,
  availableTags,
  editingResource,
}) {
  const { user, profile } = useAuth();

  // Step: "pick" | "form"
  const [step, setStep] = useState(defaultType ? "form" : "pick");
  const [selectedType, setSelectedType] = useState(defaultType || null);

  // If the selected type is "activity" we delegate entirely to ActivityContributeModal
  const delegateToActivity = selectedType === "activity";

  // ── Universal form state ────────────────────────────────────────────────────
  const defaultForm = {
    title: "", body: "", subject: subjects?.[0] || "Biology",
    customSubject: "", gradeGroup: gradeGroups?.[0] || "High School (9–10)",
    externalUrl: "", keywords: "", isClassroomFriendly: false,
    file: null, thumbnailFile: null, thumbnailPreview: "",
    // article / paper
    publicationYear: "", publisherName: "",
    // story
    usageContext: "", educationalUse: "", exampleFiles: [],
    type: defaultType || "article",
  };

  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill for edit mode
  useEffect(() => {
    if (!editingResource) return;
    setSelectedType(editingResource.type || "article");
    setStep("form");
    setForm(f => ({
      ...f,
      title: editingResource.title || editingResource.meme_name || "",
      body: editingResource.body || "",
      subject: editingResource.subject || subjects?.[0] || "Biology",
      customSubject: "",
      gradeGroup: editingResource.grade_group || gradeGroups?.[0] || "High School (9–10)",
      externalUrl: editingResource.file_url || "",
      keywords: Array.isArray(editingResource.keywords)
        ? editingResource.keywords.join(", ")
        : (editingResource.keywords || ""),
      publicationYear: editingResource.publication_year || "",
      publisherName: editingResource.publisher_name || "",
      usageContext: editingResource.usage_context || "",
      educationalUse: editingResource.educational_use || "",
      isClassroomFriendly: !!editingResource.is_classroom_friendly,
      type: editingResource.type || "article",
    }));
  }, [editingResource]);

  // Sync type into form
  useEffect(() => {
    if (selectedType) setForm(f => ({ ...f, type: selectedType }));
  }, [selectedType]);

  // ── Type select handler ─────────────────────────────────────────────────────
  const handleSelectType = (type) => {
    setSelectedType(type);
    setStep("form");
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { setError("Please sign in to contribute."); return; }
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.body.trim()) { setError("Description is required."); return; }

    setLoading(true);
    setError("");

    try {
      let fileUrl = editingResource?.file_url || form.externalUrl.trim();
      let thumbnailUrl = editingResource?.thumbnail_url || "";

      // Upload main file
      if (form.file) {
        const storageRef = ref(storage, `resources/${user.uid}_res_${Date.now()}`);
        const snap = await uploadBytes(storageRef, form.file);
        fileUrl = await getDownloadURL(snap.ref);
        // Auto-use as thumbnail if image and no separate thumb
        if (!thumbnailUrl && form.file.type?.startsWith("image/")) thumbnailUrl = fileUrl;
      }
      // Upload thumbnail
      if (form.thumbnailFile) {
        const thumbRef = ref(storage, `resources/thumb_${user.uid}_${Date.now()}`);
        const snap = await uploadBytes(thumbRef, form.thumbnailFile);
        thumbnailUrl = await getDownloadURL(snap.ref);
      }
      // Upload story example images
      let exampleUrls = [];
      if (selectedType === "stories" && (form.exampleFiles || []).length > 0) {
        for (let i = 0; i < form.exampleFiles.length; i++) {
          const exRef = ref(storage, `resources/examples_${user.uid}_${Date.now()}_${i}`);
          const snap = await uploadBytes(exRef, form.exampleFiles[i]);
          exampleUrls.push(await getDownloadURL(snap.ref));
        }
      }

      const finalSubject = form.subject === "Other" ? form.customSubject.trim() : form.subject;
      const parsedKeywords = form.keywords
        ? form.keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean)
        : [];

      const baseData = {
        title: form.title.trim(),
        body: form.body.trim(),
        type: selectedType,
        subject: selectedType === "stories" ? "" : finalSubject,
        grade_group: selectedType === "stories" ? "" : form.gradeGroup,
        file_url: fileUrl,
        thumbnail_url: thumbnailUrl,
        keywords: parsedKeywords,
        is_classroom_friendly: Boolean(form.isClassroomFriendly),
        status: "live",
        admin_approved: false,
      };

      if (selectedType === "article" || selectedType === "research_paper") {
        baseData.publication_year = form.publicationYear;
        baseData.publisher_name = form.publisherName;
      }
      if (selectedType === "stories") {
        baseData.meme_name = form.title.trim();
        baseData.usage_context = form.usageContext.trim();
        baseData.educational_use = form.educationalUse.trim();
        baseData.example_images = exampleUrls;
      }

      if (editingResource) {
        await updateDoc(doc(db, "resources", editingResource.id), {
          ...baseData,
          updated_at: serverTimestamp(),
        });
      } else {
        const resColRef = collection(db, "resources");
        const statsDocRef = doc(db, "user_stats", user.uid);
        await runTransaction(db, async (transaction) => {
          const statsSnap = await transaction.get(statsDocRef);
          const newDocRef = doc(resColRef);
          transaction.set(newDocRef, {
            ...baseData,
            likes_count: 0, flag_count: 0, view_count: 0,
            author_id: user.uid,
            created_at: serverTimestamp(),
          });
          if (statsSnap.exists()) {
            transaction.update(statsDocRef, { resources_contributed_count: increment(1) });
          } else {
            transaction.set(statsDocRef, { resources_contributed_count: 1 }, { merge: true });
          }
        });
      }

      if (form.subject === "Other" && form.customSubject.trim()) {
        trackCustomSubmission("subject", form.customSubject.trim());
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("ContributeResourceModal submit failed", err);
      setError("Submission failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── If delegating to Activity modal ────────────────────────────────────────
  if (delegateToActivity) {
    return (
      <ActivityContributeModal
        onClose={onClose}
        onSuccess={onSuccess}
        subjects={subjects}
        gradeGroups={gradeGroups}
        availableTags={availableTags}
        activityToEdit={editingResource}
      />
    );
  }

  const cfg = selectedType ? TYPE_CONFIG[selectedType] : null;
  const isEdit = !!editingResource;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {step === "form" && !defaultType && !isEdit && (
              <button
                type="button"
                onClick={() => { setStep("pick"); setSelectedType(null); }}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition text-lg font-bold flex-shrink-0"
                title="Back"
              >
                ←
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white truncate">
                {step === "pick"
                  ? "Contribute Resource"
                  : isEdit
                    ? `Edit ${cfg?.label || "Resource"}`
                    : `${cfg?.icon || "➕"} Contribute ${cfg?.label || "Resource"}`}
              </h2>
              {step === "form" && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {isEdit
                    ? "Your changes will re-enter the admin review queue."
                    : "Your resource will go live immediately with a 'Pending Approval' badge."}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {step === "pick" ? (
          <div className="flex-1 overflow-y-auto">
            <TypePicker onSelect={handleSelectType} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Type indicator badge */}
            {cfg && (
              <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full ${COLOR_BADGE[cfg.color]}`}>
                {cfg.icon} {cfg.label}
                {!defaultType && !isEdit && (
                  <button type="button" onClick={() => { setStep("pick"); setSelectedType(null); }}
                    className="ml-1 opacity-60 hover:opacity-100 font-extrabold">✕</button>
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Type-specific form fields */}
            {(selectedType === "article" || selectedType === "research_paper") && (
              <ArticleForm form={form} setForm={setForm} subjects={subjects || []} gradeGroups={gradeGroups || []} />
            )}
            {selectedType === "course" && (
              <CourseForm form={form} setForm={setForm} subjects={subjects || []} gradeGroups={gradeGroups || []} />
            )}
            {selectedType === "stories" && (
              <StoryForm form={form} setForm={setForm} />
            )}
            {selectedType === "other" && (
              <OtherForm form={form} setForm={setForm} subjects={subjects || []} gradeGroups={gradeGroups || []} />
            )}
          </form>
        )}

        {/* Footer */}
        {step === "form" && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-shrink-0">
            <p className="text-[10px] text-gray-400">⏳ Will be posted live with a "Pending Approval" badge</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-xs font-bold border border-gray-300 dark:border-zinc-700 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition text-gray-600 dark:text-gray-300">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
              >
                {loading ? "Publishing..." : isEdit ? "Save Changes" : `Publish ${cfg?.label || "Resource"}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
