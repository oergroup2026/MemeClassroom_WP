import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  setDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import FormattedText from "../components/FormattedText";
import RichTextArea from "../components/RichTextArea";
import {
  ArrowLeft,
  Heart,
  Share2,
  Bookmark,
  Flag,
  BookOpen,
  Clock,
  Eye,
  Tag,
  Lightbulb,
  GraduationCap,
  Puzzle,
  Pencil,
  X,
} from "lucide-react";

import { useToast } from "../components/ToastNotification";
import TtsSpeakerButton from "../components/TtsSpeakerButton";

// ─── Section block ─────────────────────────────────────────────────────────────
const Section = ({ icon: Icon, label, colorClass, children }) => (
  <div className={`rounded-2xl p-5 border ${colorClass}`}>
    <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest mb-3 opacity-80">
      <Icon className="w-4 h-4" />
      {label}
    </h3>
    <div className="text-sm leading-relaxed">{children}</div>
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MemeStoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const showToast = useToast();


  const [story, setStory] = useState(null);
  const [authorName, setAuthorName] = useState("Contributor");
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Interaction state
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeDocId, setLikeDocId] = useState(null);
  const [bookmarkDocId, setBookmarkDocId] = useState(null);
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const [likePending, setLikePending] = useState(false);

  // Edit Story State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editUsageContext, setEditUsageContext] = useState("");
  const [editEducationalUse, setEditEducationalUse] = useState("");
  const [editExampleImages, setEditExampleImages] = useState([]);
  const [editExampleFiles, setEditExampleFiles] = useState([]);
  const [editFile, setEditFile] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const canEdit = user && (user.uid === story?.author_id || profile?.role === "admin");

  const openEditModal = () => {
    if (!story) return;
    setEditTitle(story.title || story.meme_name || "");
    setEditBody(story.body || "");
    setEditUsageContext(story.usage_context || "");
    setEditEducationalUse(story.educational_use || "");
    setEditExampleImages(Array.isArray(story.example_images) ? story.example_images : []);
    setEditExampleFiles([]);
    setEditFile(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!story || !user) return;
    setEditLoading(true);
    try {
      let fileUrl = story.file_url || story.thumbnail_url || "";
      if (editFile) {
        const storageRef = ref(storage, `resources/${user.uid}_res_${Date.now()}`);
        const snap = await uploadBytes(storageRef, editFile);
        fileUrl = await getDownloadURL(snap.ref);
      }

      let uploadedExampleUrls = [];
      if (editExampleFiles.length > 0) {
        for (let i = 0; i < editExampleFiles.length; i++) {
          const exFile = editExampleFiles[i];
          if (exFile) {
            const exRef = ref(storage, `resources/examples_${user.uid}_${Date.now()}_${i}`);
            const exSnap = await uploadBytes(exRef, exFile);
            const exUrl = await getDownloadURL(exSnap.ref);
            uploadedExampleUrls.push(exUrl);
          }
        }
      }

      const finalExamples = [
        ...editExampleImages.filter(Boolean),
        ...uploadedExampleUrls
      ];

      const updatedData = {
        title: editTitle.trim(),
        meme_name: editTitle.trim(),
        body: editBody.trim(),
        usage_context: editUsageContext.trim(),
        educational_use: editEducationalUse.trim(),
        example_images: finalExamples,
        file_url: fileUrl,
        thumbnail_url: fileUrl,
        updated_at: serverTimestamp()
      };

      await updateDoc(doc(db, "resources", story.id), updatedData);
      setStory(prev => ({ ...prev, ...updatedData }));
      showToast("Story updated successfully!", "success");
      setShowEditModal(false);
    } catch (err) {
      console.error("Failed to edit story:", err);
      showToast("Failed to update story.", "error");
    } finally {
      setEditLoading(false);
    }
  };

  // ── 1. Load story ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchStory = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "resources", id));
        if (!snap.exists() || snap.data().type !== "stories") {
          setNotFound(true);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setStory(data);

        // Increment view count silently
        updateDoc(doc(db, "resources", id), { view_count: increment(1) }).catch(() => {});

        // Resolve author name
        if (data.author_id && data.author_id !== "admin") {
          const userSnap = await getDoc(doc(db, "users", data.author_id));
          if (userSnap.exists()) setAuthorName(userSnap.data().name || "Contributor");
        } else if (data.author_id === "admin") {
          setAuthorName("Admin");
        }

        // Load associated template
        if (data.template_id) {
          const tSnap = await getDoc(doc(db, "templates", data.template_id));
          if (tSnap.exists()) setTemplate({ id: tSnap.id, ...tSnap.data() });
        }
      } catch (e) {
        console.error("Error loading story:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [id]);

  // ── 2. Real-time like subscription ───────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, "resource_likes"),
      where("user_id", "==", user.uid),
      where("resource_id", "==", id)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setIsLiked(true);
        setLikeDocId(snap.docs[0].id);
      } else {
        setIsLiked(false);
        setLikeDocId(null);
      }
    });
    return () => unsub();
  }, [user, id]);

  // ── 3. Real-time bookmark subscription ───────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, "saves"),
      where("user_id", "==", user.uid),
      where("resource_id", "==", id),
      where("content_type", "==", "resource")
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setIsBookmarked(true);
        setBookmarkDocId(snap.docs[0].id);
      } else {
        setIsBookmarked(false);
        setBookmarkDocId(null);
      }
    });
    return () => unsub();
  }, [user, id]);

  // ── 4. Flag status ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, "flags"),
      where("reporter_id", "==", user.uid),
      where("content_id", "==", id)
    );
    const unsub = onSnapshot(q, (snap) => setAlreadyFlagged(!snap.empty));
    return () => unsub();
  }, [user, id]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleLike = async () => {
    if (!user) { showToast("Sign in to like stories.", "info"); return; }
    if (likePending) return;
    setLikePending(true);
    try {
      if (likeDocId) {
        await deleteDoc(doc(db, "resource_likes", likeDocId));
        await updateDoc(doc(db, "resources", id), { likes_count: increment(-1) });
        setStory((s) => ({ ...s, likes_count: Math.max(0, (s.likes_count || 1) - 1) }));
      } else {
        const likeId = `${user.uid}_${id}`;
        await setDoc(doc(db, "resource_likes", likeId), {
          user_id: user.uid, resource_id: id, created_at: serverTimestamp(),
        });
        await updateDoc(doc(db, "resources", id), { likes_count: increment(1) });
        setStory((s) => ({ ...s, likes_count: (s.likes_count || 0) + 1 }));
      }
    } catch (e) {
      showToast("Failed to update like.", "error");
    } finally {
      setLikePending(false);
    }
  };

  const handleBookmark = async () => {
    if (!user) { showToast("Sign in to save stories.", "info"); return; }
    try {
      if (bookmarkDocId) {
        await deleteDoc(doc(db, "saves", bookmarkDocId));
        showToast("Removed from bookmarks.", "success");
      } else {
        const saveId = `${user.uid}_res_${id}`;
        await setDoc(doc(db, "saves", saveId), {
          user_id: user.uid, resource_id: id, content_type: "resource", created_at: serverTimestamp(),
        });
        showToast("Story saved to bookmarks!", "success");
      }
    } catch (e) {
      showToast("Failed to update bookmark.", "error");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: story?.title, url }); } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard! 🔗", "success");
      } catch (_) { showToast("Could not copy link.", "error"); }
    }
  };

  const handleFlag = async () => {
    if (!user) { showToast("Sign in to report content.", "info"); return; }
    if (alreadyFlagged) { showToast("You already reported this.", "info"); return; }
    try {
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid, content_type: "resource", content_id: id,
        reason: "Flagged by user", status: "pending", created_at: serverTimestamp(),
      });
      await updateDoc(doc(db, "resources", id), { flag_count: increment(1) });
      showToast("Report submitted. Thank you.", "success");
    } catch (e) {
      showToast("Failed to submit report.", "error");
    }
  };

  // ── Loading / Not Found states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-gray-400">Loading story…</p>
        </div>
      </div>
    );
  }

  if (notFound || !story) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center flex-col gap-4 text-center px-4">
        <span className="text-6xl">📭</span>
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Story not found</h2>
        <p className="text-sm text-gray-500 max-w-xs">This meme story may have been removed or the link is invalid.</p>
        <button
          onClick={() => navigate("/resources?tab=stories")}
          className="mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition"
        >
          ← Back to Stories
        </button>
      </div>
    );
  }

  const dateStr = story.created_at
    ? new Date(story.created_at.seconds * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : "Just now";

  return (
    <div className="relative overflow-visible">
      {/* Toast notifications are rendered by the shared ToastProvider */}

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-[5%] left-[10%] w-[450px] h-[450px] rounded-full bg-amber-400/10 dark:bg-amber-600/15 blur-[90px] animate-pulse" style={{ animationDuration: "9s" }} />
        <div className="absolute top-[40%] right-[5%] w-[380px] h-[380px] rounded-full bg-orange-400/10 dark:bg-orange-600/15 blur-[80px] animate-pulse" style={{ animationDuration: "12s" }} />
        <div className="absolute bottom-[10%] left-[15%] w-[320px] h-[320px] rounded-full bg-yellow-400/10 dark:bg-yellow-700/15 blur-[70px] animate-pulse" style={{ animationDuration: "7s" }} />
      </div>

      <div className="max-w-4xl mx-auto py-6 px-4 space-y-8 relative z-10">

        {/* ── Back navigation ─────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Resources
        </button>

        {/* ── Hero image ──────────────────────────────────────────────────────── */}
        {(() => {
          const heroUrl = story.thumbnail_url || template?.media_url || null;
          const heroAlt = story.thumbnail_url ? story.title : (template?.title || story.meme_name || story.title);
          return heroUrl ? (
            <div className="w-full rounded-2xl overflow-hidden border border-amber-200/50 dark:border-amber-800/30 shadow-2xl shadow-amber-500/10 bg-amber-50/30 dark:bg-zinc-900 flex items-center justify-center">
              <img
                src={heroUrl}
                alt={heroAlt}
                className="w-full object-contain"
                style={{ maxHeight: '520px' }}
              />
            </div>
          ) : (
            <div className="w-full h-60 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-950/30 dark:to-zinc-900 border border-amber-200/50 dark:border-amber-800/30 flex flex-col items-center justify-center gap-3 shadow-lg">
              <BookOpen className="w-16 h-16 text-amber-400/50" />
              {story.meme_name && (
                <span className="text-sm font-bold text-amber-600/70 dark:text-amber-400/60">🎭 {story.meme_name}</span>
              )}
            </div>
          );
        })()}

        {/* ── Title + meta header ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-extrabold px-3 py-1 rounded-full border border-amber-200/60 dark:border-amber-700/40">
              📖 Meme Story
            </span>
            {story.meme_name && (
              <span className="inline-flex items-center gap-1.5 bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 text-[11px] font-bold px-3 py-1 rounded-full border border-orange-200/50 dark:border-orange-800/30">
                🎭 {story.meme_name}
              </span>
            )}
            {!story.admin_approved && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3" /> Pending Review
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
            {story.title}
          </h1>

          {/* Author + date + views */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 pt-1">
            <span className="font-semibold text-gray-700 dark:text-gray-200">By {authorName}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {dateStr}
            </span>
            {(story.view_count || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {story.view_count} views
              </span>
            )}
          </div>
        </div>

        {/* ── Action bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleLike}
            disabled={likePending}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm border transition hover:scale-105 active:scale-95 ${
              isLiked
                ? "bg-red-50 dark:bg-red-950/30 text-red-500 border-red-200 dark:border-red-800"
                : "bg-white/60 dark:bg-zinc-900/60 text-gray-500 border-gray-200 dark:border-zinc-700 hover:text-red-500 hover:border-red-200"
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} strokeWidth={1.5} />
            <span>{story.likes_count || 0}</span>
          </button>

          <button
            onClick={handleBookmark}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm border transition hover:scale-105 active:scale-95 ${
              isBookmarked
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 border-amber-200 dark:border-amber-700"
                : "bg-white/60 dark:bg-zinc-900/60 text-gray-500 border-gray-200 dark:border-zinc-700 hover:text-amber-500 hover:border-amber-200"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? "fill-current" : ""}`} strokeWidth={1.5} />
            <span>{isBookmarked ? "Saved" : "Save"}</span>
          </button>

          <TtsSpeakerButton
            text={`${story.title}. Background Story: ${story.body || ""}. Typical Usage: ${story.usage_context || ""}. Educational Context: ${story.educational_use || ""}`}
            id={`story-${id}`}
          />

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm border bg-white/60 dark:bg-zinc-900/60 text-gray-500 border-gray-200 dark:border-zinc-700 hover:text-green-500 hover:border-green-200 transition hover:scale-105 active:scale-95"
          >
            <Share2 className="w-4 h-4" strokeWidth={1.5} />
            Share
          </button>

          {canEdit && (
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm border bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition hover:scale-105 active:scale-95"
            >
              <Pencil className="w-4 h-4" />
              Edit Story
            </button>
          )}

          <button
            onClick={handleFlag}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm border transition hover:scale-105 active:scale-95 ${
              alreadyFlagged
                ? "text-orange-500 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
                : "bg-white/60 dark:bg-zinc-900/60 text-gray-400 border-gray-200 dark:border-zinc-700 hover:text-orange-500 hover:border-orange-200"
            }`}
            title={alreadyFlagged ? "Already reported" : "Report this story"}
          >
            <Flag className="w-4 h-4" strokeWidth={1.5} />
            {alreadyFlagged ? "Reported" : "Report"}
          </button>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-amber-100 dark:border-amber-900/30" />

        {/* ── Story Body ──────────────────────────────────────────────────────── */}
        <Section
          icon={BookOpen}
          label="Story Background"
          colorClass="bg-amber-50/80 dark:bg-amber-950/15 border-amber-200/60 dark:border-amber-800/30 text-amber-900 dark:text-amber-100"
        >
          <FormattedText text={story.body || "No story content provided."} className="text-gray-700 dark:text-gray-300 leading-7" />
        </Section>

        {/* ── Usage Context ────────────────────────────────────────────────────── */}
        {story.usage_context && (
          <Section
            icon={Lightbulb}
            label="Typical Meaning & Usage"
            colorClass="bg-indigo-50/80 dark:bg-indigo-950/15 border-indigo-200/50 dark:border-indigo-800/30 text-indigo-900 dark:text-indigo-100"
          >
            <FormattedText text={story.usage_context} className="text-gray-700 dark:text-gray-300 leading-7" />
          </Section>
        )}

        {/* ── Educational Use ──────────────────────────────────────────────────── */}
        {story.educational_use && (
          <Section
            icon={GraduationCap}
            label="Educational Use"
            colorClass="bg-emerald-50/80 dark:bg-emerald-950/15 border-emerald-200/50 dark:border-emerald-800/30 text-emerald-900 dark:text-emerald-100"
          >
            <FormattedText text={story.educational_use} className="text-gray-700 dark:text-gray-300 leading-7" />
          </Section>
        )}

        {/* ── Associated Template ──────────────────────────────────────────────── */}
        {template && (
          <div className="rounded-2xl p-5 border bg-purple-50/80 dark:bg-purple-950/15 border-purple-200/50 dark:border-purple-800/30">
            <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest mb-4 text-purple-700 dark:text-purple-400 opacity-80">
              <Puzzle className="w-4 h-4" />
              Original Meme Template
            </h3>
            {/* Large full-width template image */}
            {template.media_url && (
              <div className="w-full rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800 mb-4 bg-white dark:bg-zinc-900 flex items-center justify-center">
                <img
                  src={template.media_url}
                  alt={template.title}
                  className="w-full object-contain"
                  style={{ maxHeight: '420px' }}
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="flex-grow">
                <h4 className="font-extrabold text-gray-900 dark:text-white text-base leading-snug">{template.title}</h4>
                <p className="text-xs text-gray-400 capitalize mt-0.5">Format: {template.format || "image"}</p>
              </div>
              <button
                onClick={() => navigate(`/lab?templateId=${template.id}&templateUrl=${encodeURIComponent(template.media_url)}&format=${template.format || "image"}`)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition shadow-sm flex-shrink-0"
              >
                🎨 Remix Template
              </button>
            </div>
          </div>
        )}

        {/* ── Example Images ───────────────────────────────────────────────────── */}
        {story.example_images && story.example_images.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest mb-3 text-amber-600 dark:text-amber-400">
              <span>🖼️</span> Example Uses of This Meme
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {story.example_images.map((imgUrl, idx) => (
                <a
                  key={idx}
                  href={imgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square rounded-xl overflow-hidden border border-amber-200/50 dark:border-amber-800/30 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <img
                    src={imgUrl}
                    alt={`Example ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold bg-black/50 px-2 py-1 rounded-full">Open ↗</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom action bar (sticky feel) ─────────────────────────────────── */}
        <div className="sticky bottom-4 mt-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-amber-200/50 dark:border-amber-800/30 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-amber-500/5">
            <div className="flex items-center gap-3">
              <button
                onClick={handleLike}
                disabled={likePending}
                className={`flex items-center gap-1.5 font-bold text-sm transition hover:scale-105 active:scale-95 ${
                  isLiked ? "text-red-500" : "text-gray-400 hover:text-red-500"
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} strokeWidth={1.5} />
                <span>{story.likes_count || 0}</span>
              </button>
              <button
                onClick={handleBookmark}
                className={`flex items-center gap-1.5 font-bold text-sm transition hover:scale-105 active:scale-95 ${
                  isBookmarked ? "text-amber-500" : "text-gray-400 hover:text-amber-500"
                }`}
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} strokeWidth={1.5} />
                <span>{isBookmarked ? "Saved" : "Save"}</span>
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 font-bold text-sm text-gray-400 hover:text-green-500 transition hover:scale-105 active:scale-95"
              >
                <Share2 className="w-5 h-5" strokeWidth={1.5} />
                Share
              </button>
            </div>
            <button
              onClick={() => navigate("/resources?tab=stories")}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow-md"
            >
              ← More Stories
            </button>
          </div>
        </div>

      </div>

      {/* ── EDIT STORY MODAL ─────────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 w-full max-w-lg p-6 rounded-2xl overflow-y-auto max-h-[90vh] shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-zinc-800">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-purple-600" />
                Edit Meme Story
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Attach File / Replace Image Template</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  💡 Upload a new image file to replace the main customizable image.
                </p>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Template / Meme Name *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Background — How it became a meme *</label>
                <RichTextArea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  placeholder="How it became a meme: Mention where this template originated (movie, TV show, game, viral event) and how it gained popularity."
                  required
                />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Typical Meaning & Usage</label>
                <RichTextArea
                  value={editUsageContext}
                  onChange={(e) => setEditUsageContext(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Educational Use</label>
                <RichTextArea
                  value={editEducationalUse}
                  onChange={(e) => setEditEducationalUse(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Example Images (Upload Multiple Images)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setEditExampleFiles(prev => [...prev, ...files]);
                  }}
                  className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                />
                {editExampleFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editExampleFiles.map((file, idx) => (
                      <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-amber-300 dark:border-amber-700 bg-gray-100">
                        <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditExampleFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-0 right-0 bg-red-600 text-white rounded-bl p-0.5 text-[10px] font-bold leading-none"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {editExampleImages.filter(Boolean).length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-400 mb-1">Existing Example Images:</p>
                    <div className="flex flex-wrap gap-2">
                      {editExampleImages.map((url, idx) => (
                        url ? (
                          <div key={idx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 bg-gray-100">
                            <img src={url} alt="example" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setEditExampleImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-0 right-0 bg-red-600 text-white rounded-bl p-0.5 text-[10px] font-bold leading-none"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl font-bold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
