import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc, getDoc, updateDoc, increment, setDoc, deleteDoc, orderBy,
  addDoc, collection, query, where, onSnapshot, serverTimestamp, getDocs, limit
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import {
  ArrowLeft, Heart, Share2, Bookmark, Flag, Eye,
  ChevronDown, ChevronUp, ExternalLink, Clock, BookOpen
} from "lucide-react";
import PdfSlideViewer from "../components/PdfSlideViewer";
import FormattedText from "../components/FormattedText";
import ActivityContributeModal from "../components/ActivityContributeModal";
import TtsSpeakerButton from "../components/TtsSpeakerButton";

import { useToast } from "../components/ToastNotification";

// ─── Pending Approval Popup ───────────────────────────────────────────────────
const PendingApprovalPopup = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white dark:bg-zinc-900 border border-yellow-200 dark:border-yellow-800 rounded-2xl shadow-2xl p-6 max-w-sm text-center space-y-3" onClick={e => e.stopPropagation()}>
      <div className="text-4xl">⏳</div>
      <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Pending Admin Approval</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        This activity was uploaded by a community member and is currently awaiting review by our admin team. The content has not yet been verified or approved.
      </p>
      <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl px-3 py-2">
        You can still view and interact with this activity. It will receive a ✅ verified badge once approved.
      </p>
      <button onClick={onClose} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">
        Got it
      </button>
    </div>
  </div>
);

// ─── Collapsible Section ──────────────────────────────────────────────────────
const CollapsibleSection = ({ title, icon, count, defaultOpen = false, children, accentColor = "purple" }) => {
  const [open, setOpen] = useState(defaultOpen);
  const colors = {
    purple: "text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/40",
    amber: "text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/40",
    blue: "text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/40",
    green: "text-green-600 dark:text-green-400 border-green-100 dark:border-green-900/40",
  };
  return (
    <div className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50/70 dark:bg-zinc-900/60 hover:bg-gray-100/80 dark:hover:bg-zinc-800/60 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className={`text-sm font-extrabold ${colors[accentColor].split(" ")[0]} ${colors[accentColor].split(" ")[1]}`}>{title}</span>
          {count !== undefined && (
            <span className="text-[10px] font-bold text-gray-400 bg-gray-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-4 bg-white dark:bg-zinc-950/40 border-t border-gray-100 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Comment Item ─────────────────────────────────────────────────────────────
const CommentItem = ({ comment, currentUser, onDelete }) => {
  const date = comment.created_at?.seconds
    ? new Date(comment.created_at.seconds * 1000).toLocaleDateString()
    : "Just now";
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-[10px] flex-shrink-0">
        {(comment.author_name || "U").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-gray-800 dark:text-white">{comment.author_name || "User"}</span>
          <span className="text-[10px] text-gray-400">{date}</span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{comment.text}</p>
      </div>
      {currentUser && comment.author_id === currentUser.uid && (
        <button onClick={() => onDelete(comment.id)} className="text-gray-300 hover:text-red-400 transition text-xs flex-shrink-0">
          ✕
        </button>
      )}
    </div>
  );
};

// ─── Reference Item ───────────────────────────────────────────────────────────
const ReferenceItem = ({ ref: r, navigate }) => {
  if (r.type === "external") {
    return (
      <a href={r.url} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline">
        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
        {r.label || r.url}
      </a>
    );
  }
  const path = r.type === "internal_meme"
    ? `/library#meme-${r.resource_id}`
    : `/resources/${r.resource_id}`;
  const icon = r.type === "internal_meme" ? "😂" : "📄";
  return (
    <button
      onClick={() => navigate(path)}
      className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline text-left"
    >
      <span className="flex-shrink-0">{icon}</span>
      {r.label || "View resource"}
      <span className="text-[10px] text-gray-400 ml-1">
        {r.type === "internal_meme" ? "(Library)" : "(Resource)"}
      </span>
    </button>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const toast = useToast();
  const showToast = toast;

  const [activity, setActivity] = useState(null);
  const [authorName, setAuthorName] = useState("Contributor");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Interaction
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeDocId, setLikeDocId] = useState(null);
  const [bookmarkDocId, setBookmarkDocId] = useState(null);
  const [likePending, setLikePending] = useState(false);
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const [showFlagConfirm, setShowFlagConfirm] = useState(false);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Comments
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Related activities
  const [related, setRelated] = useState([]);

  const viewCountedRef = useRef(false);
  const isAdmin = profile?.role === "admin";

  // ── Load activity
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const snap = await getDoc(doc(db, "resources", id));
        if (!snap.exists() || snap.data().type !== "activity") {
          setNotFound(true); setLoading(false); return;
        }
        const data = { id: snap.id, ...snap.data() };
        setActivity(data);

        // Author name
        if (data.author_id && data.author_id !== "admin") {
          try {
            const uSnap = await getDoc(doc(db, "users", data.author_id));
            if (uSnap.exists()) setAuthorName(uSnap.data().name || "Contributor");
          } catch (_) {}
        } else if (data.author_id === "admin") {
          setAuthorName("Admin");
        }
      } catch (e) {
        console.error("Failed to load activity", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [id]);

  // ── View count (once)
  useEffect(() => {
    if (!activity || viewCountedRef.current) return;
    viewCountedRef.current = true;
    updateDoc(doc(db, "resources", id), { view_count: increment(1) }).catch(() => {});
  }, [activity, id]);

  // ── Likes
  useEffect(() => {
    if (!user || !activity) { setIsLiked(false); setLikeDocId(null); return; }
    const q = query(
      collection(db, "resource_likes"),
      where("user_id", "==", user.uid),
      where("resource_id", "==", id)
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) { setIsLiked(true); setLikeDocId(snap.docs[0].id); }
      else { setIsLiked(false); setLikeDocId(null); }
    });
    return () => unsub();
  }, [user, activity, id]);

  // ── Bookmarks
  useEffect(() => {
    if (!user || !activity) { setIsBookmarked(false); setBookmarkDocId(null); return; }
    const q = query(
      collection(db, "saves"),
      where("user_id", "==", user.uid),
      where("resource_id", "==", id),
      where("content_type", "==", "resource")
    );
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) { setIsBookmarked(true); setBookmarkDocId(snap.docs[0].id); }
      else { setIsBookmarked(false); setBookmarkDocId(null); }
    });
    return () => unsub();
  }, [user, activity, id]);

  // ── Flags
  useEffect(() => {
    if (!user) { setAlreadyFlagged(false); return; }
    const q = query(
      collection(db, "flags"),
      where("reporter_id", "==", user.uid),
      where("content_id", "==", id)
    );
    const unsub = onSnapshot(q, snap => setAlreadyFlagged(!snap.empty));
    return () => unsub();
  }, [user, id]);

  // ── Comments (real-time)
  useEffect(() => {
    const q = query(
      collection(db, "activity_comments"),
      where("activity_id", "==", id),
      orderBy("created_at", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setComments(list);
    }, () => {});
    return () => unsub();
  }, [id]);

  // ── Related activities
  useEffect(() => {
    if (!activity) return;
    const fetchRelated = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "resources"),
            where("type", "==", "activity"),
            where("status", "!=", "admin_hidden"),
            limit(10)
          )
        );
        const all = [];
        snap.forEach(d => {
          if (d.id !== id) all.push({ id: d.id, ...d.data() });
        });
        // Filter by same subject or overlapping tags
        const sameSubject = all.filter(a =>
          a.subject === activity.subject ||
          (a.strategy_tags || []).some(t => (activity.strategy_tags || []).includes(t))
        );
        setRelated((sameSubject.length > 0 ? sameSubject : all).slice(0, 3));
      } catch (e) {}
    };
    fetchRelated();
  }, [activity, id]);

  // ── Like handler
  const handleLike = async () => {
    if (!user) { showToast("Please sign in to like activities.", "warning"); return; }
    if (likePending) return;
    setLikePending(true);
    try {
      if (isLiked && likeDocId) {
        await deleteDoc(doc(db, "resource_likes", likeDocId));
        await updateDoc(doc(db, "resources", id), { likes_count: increment(-1) });
      } else {
        const likeId = `${user.uid}_${id}`;
        await setDoc(doc(db, "resource_likes", likeId), {
          user_id: user.uid, resource_id: id, created_at: serverTimestamp()
        });
        await updateDoc(doc(db, "resources", id), { likes_count: increment(1) });
      }
    } catch (e) { console.error("Like failed", e); }
    finally { setLikePending(false); }
  };

  // ── Bookmark handler
  const handleBookmark = async () => {
    if (!user) { showToast("Please sign in to save.", "warning"); return; }
    try {
      if (isBookmarked && bookmarkDocId) {
        await deleteDoc(doc(db, "saves", bookmarkDocId));
        showToast("Removed from saved.", "info");
      } else {
        const saveId = `${user.uid}_res_${id}`;
        await setDoc(doc(db, "saves", saveId), {
          user_id: user.uid, resource_id: id, content_type: "resource",
          created_at: serverTimestamp()
        });
        showToast("Activity saved! 🔖", "success");
      }
    } catch (e) { console.error("Bookmark failed", e); }
  };

  // ── Flag handler
  const handleFlag = async () => {
    if (!user) { showToast("Please sign in to report.", "warning"); return; }
    if (alreadyFlagged) { showToast("You've already reported this.", "info"); return; }
    try {
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid, content_type: "resource", content_id: id,
        reason: "Activity flagged by user", status: "pending", created_at: serverTimestamp()
      });
      await updateDoc(doc(db, "resources", id), { flag_count: increment(1) });
      setShowFlagConfirm(true);
    } catch (e) { showToast("Failed to submit report.", "error"); }
  };

  // ── Share
  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => showToast("Link copied! 🔗", "success"))
      .catch(() => showToast("Could not copy link.", "error"));
  };

  // ── Comment submit
  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user) { showToast("Please sign in to comment.", "warning"); return; }
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      await addDoc(collection(db, "activity_comments"), {
        activity_id: id,
        author_id: user.uid,
        author_name: user.displayName || authorName,
        text: commentText.trim(),
        created_at: serverTimestamp()
      });
      await updateDoc(doc(db, "resources", id), { comments_count: increment(1) }).catch(() => {});
      setCommentText("");
    } catch (e) { showToast("Failed to post comment.", "error"); }
    finally { setCommentLoading(false); }
  };

  // ── Delete comment
  const handleDeleteComment = async (commentId) => {
    try {
      await deleteDoc(doc(db, "activity_comments", commentId));
      await updateDoc(doc(db, "resources", id), { comments_count: increment(-1) }).catch(() => {});
    } catch (e) {}
  };

  // ── Loading / Not found
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 flex flex-col items-center gap-4 text-gray-400">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading activity...</p>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center space-y-4">
        <p className="text-5xl">🎯</p>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Activity not found</h1>
        <p className="text-sm text-gray-500">This activity may have been removed or the link is incorrect.</p>
        <button onClick={() => navigate("/resources?tab=activity")}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition">
          ← Back to Use Cases & Activities
        </button>
      </div>
    );
  }

  const isPending = !activity.admin_approved;
  const dateStr = activity.created_at?.seconds
    ? new Date(activity.created_at.seconds * 1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : "Unknown date";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Toast notifications are rendered by the shared ToastProvider */}
      {showPendingPopup && <PendingApprovalPopup onClose={() => setShowPendingPopup(false)} />}
      {showFlagConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4" onClick={() => setShowFlagConfirm(false)}>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-8 max-w-sm text-center space-y-3" onClick={e => e.stopPropagation()}>
            <div className="text-5xl">🏳️</div>
            <h3 className="text-lg font-extrabold">Report Submitted</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Thank you for reporting. Our admin team will review this content.</p>
            <button onClick={() => setShowFlagConfirm(false)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">Got it</button>
          </div>
        </div>
      )}

      {/* ── Back + Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/resources?tab=activity")}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Use Cases & Activities
        </button>
        <div className="flex items-center gap-2">
          {user && (activity.author_id === user.uid || isAdmin) && (
            <button onClick={() => setShowEditModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
            >
              ✏️ Edit Activity
            </button>
          )}
          <button onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition hover:scale-105 ${isLiked ? "border-red-200 dark:border-red-800 text-red-500 bg-red-50 dark:bg-red-950/20" : "border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-red-300 hover:text-red-500"}`}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} strokeWidth={1.5} />
            {activity.likes_count || 0}
          </button>
          <button onClick={handleBookmark}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${isBookmarked ? "border-amber-200 dark:border-amber-800 text-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-gray-300 dark:border-zinc-700 text-gray-500 hover:border-amber-300"}`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-current" : ""}`} strokeWidth={1.5} />
            {isBookmarked ? "Saved" : "Save"}
          </button>
          <TtsSpeakerButton
            text={`${activity.title}. ${activity.overview || activity.body || ""}`}
            id={`activity-${id}`}
          />
          <button onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-bold text-gray-500 hover:border-green-300 hover:text-green-600 transition"
          >
            <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} /> Share
          </button>
          <button onClick={handleFlag}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${alreadyFlagged ? "border-orange-200 text-orange-500" : "border-gray-300 dark:border-zinc-700 text-gray-400 hover:border-orange-300 hover:text-orange-500"}`}
          >
            <Flag className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Hero card ────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row gap-0">
          {/* Cover image */}
          <div className="sm:w-56 flex-shrink-0 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-950/30 dark:to-indigo-950/30 flex items-center justify-center" style={{ minHeight: 160 }}>
            {activity.cover_image_url ? (
              <img src={activity.cover_image_url} alt={activity.title}
                className="w-full h-full object-cover sm:max-h-56" />
            ) : (
              <span className="text-6xl opacity-30">🎯</span>
            )}
          </div>
          {/* Meta */}
          <div className="flex-1 p-5 space-y-3">
            {/* Pending banner */}
            {isPending && (
              <button
                onClick={() => setShowPendingPopup(true)}
                className="flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition w-fit"
              >
                <Clock className="w-3.5 h-3.5" />
                ⏳ Pending Admin Approval — tap to learn more
              </button>
            )}

            {/* Strategy tags */}
            {(activity.strategy_tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {activity.strategy_tags.map(tag => (
                  <span key={tag} className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-snug">
              {activity.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {activity.subject && (
                <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-semibold">{activity.subject}</span>
              )}
              {activity.grade_group && (
                <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-semibold">{activity.grade_group}</span>
              )}
              {activity.duration_minutes && (
                <span className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-100 dark:border-indigo-900">
                  ⏱ {activity.duration_minutes} min
                </span>
              )}
              {(activity.view_count || 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" strokeWidth={1.5} /> {activity.view_count} views
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-[10px]">
                {authorName.charAt(0).toUpperCase()}
              </div>
              <span>By <span className="font-bold text-gray-700 dark:text-gray-300">{authorName}</span></span>
              <span>·</span>
              <span>{dateStr}</span>
            </div>

            {activity.body && (
              <FormattedText text={activity.body} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" />
            )}
          </div>
        </div>
      </div>

      {/* ── Presentation Viewer ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">📄 Presentation</h2>
        <PdfSlideViewer
          pdfUrl={activity.pdf_url}
          slidesEmbedUrl={activity.slides_embed_url}
          title={activity.title}
        />
      </div>

      {/* ── Educator Notes ───────────────────────────────────────────────────── */}
      {activity.educator_notes && (
        <CollapsibleSection title="Educator Notes" icon="📝" accentColor="green" defaultOpen>
          <FormattedText text={activity.educator_notes} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed" />
        </CollapsibleSection>
      )}

      {/* ── Videos ───────────────────────────────────────────────────────────── */}
      {(activity.videos || []).length > 0 && (
        <CollapsibleSection
          title="Embedded Videos"
          icon="🎬"
          count={activity.videos.length}
          accentColor="blue"
          defaultOpen={activity.videos.length > 0}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activity.videos.map((v, i) => (
              <div key={i} className="space-y-2">
                {v.label && (
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-400 truncate">
                    {v.platform === "youtube" ? "▶" : "✦"} {v.label}
                  </p>
                )}
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-black">
                  <iframe
                    src={v.url}
                    title={v.label || `Video ${i + 1}`}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── References ───────────────────────────────────────────────────────── */}
      {(activity.references || []).length > 0 && (
        <CollapsibleSection
          title="References"
          icon="📚"
          count={activity.references.length}
          accentColor="amber"
          defaultOpen
        >
          <div className="space-y-2.5">
            {activity.references.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-gray-300 dark:text-zinc-600 text-xs mt-0.5 flex-shrink-0">{i + 1}.</span>
                <ReferenceItem ref={r} navigate={navigate} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Comments ─────────────────────────────────────────────────────────── */}
      <CollapsibleSection
        title="Comments"
        icon="💬"
        count={comments.length}
        accentColor="purple"
        defaultOpen
      >
        <div className="space-y-4">
          {comments.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No comments yet. Be the first!</p>
          )}
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} currentUser={user} onDelete={handleDeleteComment} />
          ))}

          {/* Comment input */}
          {user ? (
            <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-[10px] flex-shrink-0">
                {(user.displayName || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button type="submit" disabled={!commentText.trim() || commentLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-40">
                  {commentLoading ? "..." : "Post"}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-center text-gray-400 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <a href="/auth" className="text-purple-600 hover:underline font-bold">Sign in</a> to leave a comment
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Related Activities ────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">🔗 Related Activities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map(r => (
              <button
                key={r.id}
                onClick={() => navigate(`/resources/activity/${r.id}`)}
                className="flex flex-col items-start gap-2 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition text-left"
              >
                {r.cover_image_url ? (
                  <img src={r.cover_image_url} alt={r.title}
                    className="w-full h-24 object-cover rounded-xl" />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-xl flex items-center justify-center text-3xl opacity-30">🎯</div>
                )}
                <p className="text-xs font-extrabold text-gray-800 dark:text-white line-clamp-2 leading-snug">{r.title}</p>
                {(r.strategy_tags || []).length > 0 && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                    {r.strategy_tags[0]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {showEditModal && (
        <ActivityContributeModal
          activityToEdit={activity}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updatedData) => {
            showToast("Activity updated successfully! ✏️", "success");
            if (updatedData) {
              setActivity(prev => ({ ...prev, ...updatedData }));
            }
          }}
        />
      )}
    </div>
  );
}
