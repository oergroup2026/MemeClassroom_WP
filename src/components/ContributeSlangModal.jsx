import { useState } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { X, Plus, Trash2, ImagePlus } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "genz", label: "Gen Z" },
  { value: "genalpha", label: "Gen Alpha" },
  { value: "internet", label: "Internet Slang" },
  { value: "abbreviation", label: "Abbreviation / Shortform" },
  { value: "other", label: "Other" },
];

const labelClass = "block text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1";
const inputBase = "w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-800 dark:text-gray-200";

const Section = ({ title, children }) => (
  <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700/60 rounded-xl p-4 space-y-3">
    <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-teal-600 dark:text-teal-400">
      {title}
    </h3>
    {children}
  </div>
);

const EMPTY_LINK = { title: "", url: "" };

// ─── Contribute a slang word / meme example to the Slang Decoder ────────────
// Modeled directly on ContributeResourceModal.jsx's form + upload conventions.
// Submissions land as "pending" and only appear publicly once an admin
// approves them (Admin.jsx moderation queue).
const ContributeSlangModal = ({ onClose, onSuccess }) => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState("form"); // "form" | "success"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("genz");
  const [definition, setDefinition] = useState("");
  const [exampleUsage, setExampleUsage] = useState("");
  const [links, setLinks] = useState([{ ...EMPTY_LINK }]);
  const [memeFiles, setMemeFiles] = useState([]);
  const [memePreviews, setMemePreviews] = useState([]);

  const updateLink = (idx, field, value) => {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const addLinkRow = () => setLinks((prev) => [...prev, { ...EMPTY_LINK }]);
  const removeLinkRow = (idx) => setLinks((prev) => prev.filter((_, i) => i !== idx));

  const handleMemeFiles = (fileList) => {
    const files = Array.from(fileList || []).slice(0, 4);
    setMemeFiles(files);
    setMemePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) { setError("Please sign in to contribute a word."); return; }
    if (!term.trim()) { setError("Please enter the slang term."); return; }
    if (!definition.trim()) { setError("Please add a plain-language definition."); return; }

    setLoading(true);
    setError("");

    try {
      const memeImageUrls = [];
      for (let i = 0; i < memeFiles.length; i++) {
        const memeRef = ref(storage, `slang_memes/${user.uid}_${Date.now()}_${i}`);
        const snap = await uploadBytes(memeRef, memeFiles[i]);
        memeImageUrls.push(await getDownloadURL(snap.ref));
      }

      const relatedLinks = links
        .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
        .filter((l) => l.url);

      await addDoc(collection(db, "slang_terms"), {
        term: term.trim(),
        category,
        definition: definition.trim(),
        example_usage: exampleUsage.trim(),
        related_links: relatedLinks,
        meme_image_urls: memeImageUrls,
        contributor_id: user.uid,
        contributor_name: profile?.name || user.displayName || "A community member",
        status: "pending",
        admin_approved: false,
        likes_count: 0,
        created_at: serverTimestamp(),
      });

      setStep("success");
      onSuccess?.();
    } catch (err) {
      console.error("Failed to submit slang word:", err);
      setError("Something went wrong submitting your word. Please try again.");
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
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white truncate">
              🗣️ Contribute a Slang Word
            </h2>
            {step === "form" && (
              <p className="text-xs text-gray-500 mt-0.5">
                Your word will be reviewed by an admin before it appears publicly.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition p-1 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {step === "success" ? (
          <div className="flex-1 overflow-y-auto px-6 py-10 flex flex-col items-center text-center gap-3">
            <span className="text-5xl">🎉</span>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Thanks for the contribution!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              "{term}" is awaiting a quick review. Once approved, it'll show up in the Slang Decoder dictionary for everyone.
            </p>
            <button
              onClick={onClose}
              className="mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Section title="📋 The Word">
              <div>
                <label className={labelClass}>Term *</label>
                <input type="text" value={term} onChange={(e) => setTerm(e.target.value)}
                  placeholder="e.g. Rizz" className={inputBase} required />
              </div>
              <div>
                <label className={labelClass}>Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputBase}>
                  {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Plain-Language Definition *</label>
                <textarea value={definition} onChange={(e) => setDefinition(e.target.value)}
                  rows={3} placeholder="Explain it simply, like you're teaching someone who's never heard it before..."
                  className={inputBase} required />
              </div>
              <div>
                <label className={labelClass}>Example Usage</label>
                <input type="text" value={exampleUsage} onChange={(e) => setExampleUsage(e.target.value)}
                  placeholder='e.g. "That trick shot was so rizz."' className={inputBase} />
              </div>
            </Section>

            <Section title="🔗 Related Links (optional)">
              {links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" value={link.title} onChange={(e) => updateLink(idx, "title", e.target.value)}
                    placeholder="Link title" className={inputBase + " flex-1"} />
                  <input type="url" value={link.url} onChange={(e) => updateLink(idx, "url", e.target.value)}
                    placeholder="https://..." className={inputBase + " flex-[1.5]"} />
                  {links.length > 1 && (
                    <button type="button" onClick={() => removeLinkRow(idx)} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLinkRow}
                className="flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 transition">
                <Plus className="w-3.5 h-3.5" /> Add another link
              </button>
            </Section>

            <Section title="🖼️ Example Memes (optional)">
              <label className="cursor-pointer flex items-center gap-3 bg-gray-100 dark:bg-zinc-800 hover:bg-teal-50 dark:hover:bg-teal-950/20 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 transition">
                <ImagePlus className="w-4 h-4 text-teal-500 flex-shrink-0" />
                <span className="text-xs text-gray-500">
                  {memeFiles.length > 0 ? `${memeFiles.length} image(s) selected` : "Upload up to 4 memes that use this word"}
                </span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => handleMemeFiles(e.target.files)} />
              </label>
              {memePreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {memePreviews.map((src, i) => (
                    <img key={i} src={src} alt={`Meme example ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200 dark:border-zinc-700" />
                  ))}
                </div>
              )}
            </Section>
          </form>
        )}

        {/* Footer */}
        {step === "form" && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition px-4 py-2">
              Cancel
            </button>
            <button type="submit" onClick={handleSubmit} disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition">
              {loading ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ContributeSlangModal;
