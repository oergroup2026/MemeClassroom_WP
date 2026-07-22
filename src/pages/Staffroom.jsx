import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useUserModal } from "../context/UserModalContext";
import { SUBJECTS, GRADE_GROUPS } from "../constants/taxonomy";
import { useToast } from "../components/ToastNotification";
import ConfirmDialog from "../components/ConfirmDialog";
import { 
  ThumbsUp, 
  MessageSquare, 
  Bookmark, 
  Flag, 
  Paperclip, 
  ShieldCheck, 
  Check, 
  BookOpen, 
  HelpCircle, 
  BarChart3, 
  Vote, 
  Send,
  Music,
  Pencil,
  Bell,
  Megaphone,
  Download,
  Sparkles,
  Lock,
  School,
  Heart,
  Lightbulb,
  Flame,
  Smile
} from "lucide-react";

// ── Static admin cache entry ──────────────────────────────────────────────────
const ADMIN_CACHE_ENTRY = {
  name: "MemeClassroom Team",
  role: "admin",
  is_verified: true,
  avatar_url: "",
  tagline: "Official MemeClassroom Account",
};

// ── Emoji reactions config ────────────────────────────────────────────────────
const REACTION_EMOJIS = ["👍", "❤️", "💡", "👏", "🔥", "😮"];

const renderReactionIcon = (emoji, sizeClass = "w-4 h-4") => {
  switch (emoji) {
    case "👍": return <ThumbsUp className={`${sizeClass} text-blue-600 dark:text-blue-400`} />;
    case "❤️": return <Heart className={`${sizeClass} text-red-500 dark:text-red-400 fill-current`} />;
    case "💡": return <Lightbulb className={`${sizeClass} text-amber-500 dark:text-amber-400 fill-current`} />;
    case "👏": return <Sparkles className={`${sizeClass} text-green-600 dark:text-green-400`} />;
    case "🔥": return <Flame className={`${sizeClass} text-orange-500 dark:text-orange-400 fill-current`} />;
    case "😮": return <Smile className={`${sizeClass} text-purple-500 dark:text-purple-450`} />;
    default: return <ThumbsUp className={sizeClass} />;
  }
};

const getReactionStyle = (emoji) => {
  switch (emoji) {
    case "👍": return { label: "Like", className: "text-blue-600 dark:text-blue-450 font-bold" };
    case "❤️": return { label: "Love", className: "text-red-500 dark:text-red-400 font-bold" };
    case "💡": return { label: "Insightful", className: "text-amber-500 dark:text-amber-450 font-bold" };
    case "👏": return { label: "Celebrate", className: "text-green-600 dark:text-green-450 font-bold" };
    case "🔥": return { label: "Fire", className: "text-orange-500 dark:text-orange-450 font-bold" };
    case "😮": return { label: "Amazed", className: "text-purple-500 dark:text-purple-450 font-bold" };
    default: return { label: "Like", className: "text-gray-500 dark:text-gray-400 hover:text-purple-650" };
  }
};

// ── Skeleton card placeholder ─────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="p-5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm animate-pulse space-y-3">
    <div className="flex justify-between items-center">
      <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-24" />
      <div className="h-4 bg-gray-200 dark:bg-zinc-700 rounded w-32" />
    </div>
    <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-full" />
    <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-5/6" />
    <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-4/6" />
    <div className="flex gap-4 pt-2 border-t border-gray-100 dark:border-zinc-800">
      <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-16" />
      <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-16" />
    </div>
  </div>
);

// ── AI Writing Hints ──────────────────────────────────────────────────────────
const WRITING_HINTS = {
  story: "Try starting with: \"When I used [meme] to teach [topic], students reacted by…\"",
  query: "Be specific: mention the grade level, subject, and what you've already tried.",
  poll: "Strong polls compare 2–4 distinct options. Example: \"Which works better for revision: GIF memes or diagram memes?\"",
};

const Staffroom = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();
  const navigate = useNavigate();
  const toast = useToast();

  // ── Core data states ─────────────────────────────────────────────────────
  const [threads, setThreads] = useState([]);
  const [replies, setReplies] = useState({});
  const [userCache, setUserCache] = useState({ admin: ADMIN_CACHE_ENTRY });
  const [availableMemes, setAvailableMemes] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // ── Meme detail modal states ─────────────────────────────────────────────
  const [activeMeme, setActiveMeme] = useState(null);
  const [expertComments, setExpertComments] = useState([]);
  const [newExpertComment, setNewExpertComment] = useState("");
  const [currentMemeRatings, setCurrentMemeRatings] = useState([]);
  const [userSubmittedRating, setUserSubmittedRating] = useState(null);
  const [userLikesMap, setUserLikesMap] = useState({});
  const [animatingHeartMemeId, setAnimatingHeartMemeId] = useState(null);
  const [likePendingMap, setLikePendingMap] = useState({});

  // ── Compose modal states ─────────────────────────────────────────────────
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeType, setComposeType] = useState("story");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeOutcome, setComposeOutcome] = useState("worked");
  const [linkedMemeId, setLinkedMemeId] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [composeSubject, setComposeSubject] = useState("Biology");
  const [composeGradeGroup, setComposeGradeGroup] = useState("Middle School (6–8)");
  const [composerTab, setComposerTab] = useState("write");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [composeIsAnnouncement, setComposeIsAnnouncement] = useState(false);

  // AI writing hint
  const [showWritingHint, setShowWritingHint] = useState(false);
  const hintTimerRef = useRef(null);

  // ── User stats & badges ───────────────────────────────────────────────────
  const [userStats, setUserStats] = useState({
    memes_created_count: 0,
    resources_contributed_count: 0,
    staffroom_posts_count: 0,
    ratings_provided_count: 0,
    total_likes_received: 0,
  });
  const [userBadges, setUserBadges] = useState([]);

  // ── Filters & search ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortMode, setSortMode] = useState("newest"); // "newest" | "upvoted" | "discussed"

  // Bookmarks (localStorage)
  const [bookmarkedIds, setBookmarkedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("staffroom_bookmarks") || "[]");
    } catch {
      return [];
    }
  });

  // Unread indicator
  const [unreadCount, setUnreadCount] = useState(0);
  const lastVisitRef = useRef(
    parseInt(localStorage.getItem("staffroom_last_visit") || "0", 10)
  );

  // Reply input map
  const [replyInputMap, setReplyInputMap] = useState({});

  // Back-to-top
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Emoji reactions open state (threadId -> bool)
  const [reactionMenuOpen, setReactionMenuOpen] = useState({});
  const [reactionPending, setReactionPending] = useState({});

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    variant: "danger",
    confirmLabel: "Delete",
    onConfirm: null,
  });

  // Flagged map
  const [flaggedByUser, setFlaggedByUser] = useState({});

  // Moderation: Flag popup replaced by toast
  // (no separate showFlagPopup needed)

  // ── Refs for modal focus management ─────────────────────────────────────
  const composeTitleRef = useRef(null);
  const memeDetailCloseRef = useRef(null);

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────────────────────────────────────

  // 1. Public memes for linked-meme dropdown
  useEffect(() => {
    const q = query(collection(db, "memes"), where("visibility", "==", "public"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAvailableMemes(list);
    });
    return () => unsubscribe();
  }, []);

  // 2. User stats & badges
  useEffect(() => {
    if (!user) return;
    const statsRef = doc(db, "user_stats", user.uid);
    const unsubStats = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) setUserStats(snap.data());
    });
    const bQuery = query(collection(db, "badges"), where("user_id", "==", user.uid));
    const unsubBadges = onSnapshot(bQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setUserBadges(list);
    });
    return () => {
      unsubStats();
      unsubBadges();
    };
  }, [user]);

  // 3. Expert comments & ratings for active meme
  useEffect(() => {
    let unsubComments = () => {};
    let unsubRatings = () => {};
    setCurrentMemeRatings([]);
    setUserSubmittedRating(null);
    setExpertComments([]);

    if (activeMeme) {
      const commentsQuery = query(
        collection(db, "comments"),
        where("meme_id", "==", activeMeme.id),
        where("is_expert_comment", "==", true)
      );
      unsubComments = onSnapshot(commentsQuery, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setExpertComments(list);
      });

      const ratingsQuery = query(collection(db, "ratings"), where("meme_id", "==", activeMeme.id));
      unsubRatings = onSnapshot(ratingsQuery, (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setCurrentMemeRatings(list);
        if (user) {
          const myRating = list.find((r) => r.user_id === user.uid);
          setUserSubmittedRating(myRating || null);
        }
      });

      // Focus close button when modal opens
      setTimeout(() => memeDetailCloseRef.current?.focus(), 60);
    }
    return () => {
      unsubComments();
      unsubRatings();
    };
  }, [activeMeme, user]);

  // 4. User likes map
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "likes"), where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => {
        const data = d.data();
        map[data.meme_id] = d.id;
      });
      setUserLikesMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // 5. Main thread feed + FIXED reply listeners (no leak)
  useEffect(() => {
    const replyUnsubs = {};

    const unsubThreads = onSnapshot(collection(db, "staffroom_posts"), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      // Exclude admin-hidden posts from the public Staffroom feed
      const visibleList = list.filter((t) => t.visibility !== "admin_hidden");
      setThreads(visibleList);
      setFeedLoading(false);

      // Track unread (only from visible posts)
      const newPosts = visibleList.filter(
        (t) => (t.created_at?.seconds || 0) * 1000 > lastVisitRef.current
      );
      setUnreadCount(newPosts.length);

      // Subscribe to replies for each visible thread — clean up removed threads
      const currentIds = new Set(visibleList.map((t) => t.id));

      // Remove subs for threads that no longer exist
      Object.keys(replyUnsubs).forEach((id) => {
        if (!currentIds.has(id)) {
          replyUnsubs[id]();
          delete replyUnsubs[id];
        }
      });

      // Add subs for new threads
      visibleList.forEach((thread) => {
        if (replyUnsubs[thread.id]) return; // already subscribed
        const rq = query(
          collection(db, "staffroom_replies"),
          where("post_id", "==", thread.id)
        );
        replyUnsubs[thread.id] = onSnapshot(rq, (replySnap) => {
          const rList = [];
          replySnap.forEach((d) => rList.push({ id: d.id, ...d.data() }));
          rList.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
          setReplies((prev) => ({ ...prev, [thread.id]: rList }));
        });
      });
    });

    return () => {
      unsubThreads();
      Object.values(replyUnsubs).forEach((unsub) => unsub());
    };
  }, []);

  // 6. User profile resolution (batch, no infinite loop)
  useEffect(() => {
    const ids = new Set();
    threads.forEach((t) => t.author_id && ids.add(t.author_id));
    Object.values(replies).forEach((rList) =>
      rList.forEach((r) => r.author_id && ids.add(r.author_id))
    );
    if (activeMeme?.creator_id) ids.add(activeMeme.creator_id);
    expertComments.forEach((c) => c.user_id && ids.add(c.user_id));

    const idsToFetch = [...ids].filter(
      (id) => id !== "admin" && !userCache[id]
    );
    if (idsToFetch.length === 0) return;

    // Optimistically mark loading so we don't re-fetch
    const placeholders = {};
    idsToFetch.forEach((id) => {
      placeholders[id] = { name: "Loading…", role: "student", is_verified: false, avatar_url: "", tagline: "" };
    });
    setUserCache((prev) => ({ ...prev, ...placeholders }));

    const fetchBatch = async () => {
      const updates = {};
      await Promise.all(
        idsToFetch.map(async (userId) => {
          try {
            const snap = await getDoc(doc(db, "users", userId));
            if (snap.exists()) {
              const d = snap.data();
              updates[userId] = {
                name: d.name || "Unknown User",
                role: d.role || "student",
                is_verified: d.is_verified || false,
                avatar_url: d.avatar_url || "",
                tagline: d.tagline || "",
              };
            } else {
              updates[userId] = { name: "Unknown User", role: "student", is_verified: false, avatar_url: "", tagline: "" };
            }
          } catch {
            /* ignore individual fetch errors */
          }
        })
      );
      if (Object.keys(updates).length > 0) {
        setUserCache((prev) => ({ ...prev, ...updates }));
      }
    };
    fetchBatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, replies, activeMeme, expertComments]);

  // 7. Back-to-top scroll listener
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 8. Update lastVisit on mount
  useEffect(() => {
    localStorage.setItem("staffroom_last_visit", Date.now().toString());
  }, []);

  // 9. Escape key for compose modal
  useEffect(() => {
    if (!showComposeModal) return;
    const handler = (e) => { if (e.key === "Escape") closeComposeModal(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showComposeModal]);

  // 10. Escape key for meme detail modal
  useEffect(() => {
    if (!activeMeme) return;
    const handler = (e) => { if (e.key === "Escape") setActiveMeme(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeMeme]);

  // Focus compose title on open
  useEffect(() => {
    if (showComposeModal) {
      setTimeout(() => composeTitleRef.current?.focus(), 60);
    }
  }, [showComposeModal]);

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  const closeComposeModal = () => {
    setShowComposeModal(false);
    setComposeBody("");
    setComposeTitle("");
    setLinkedMemeId("");
    setAttachmentFile(null);
    setAttachmentName("");
    setPollOptions(["", ""]);
    setComposerTab("write");
    setComposeIsAnnouncement(false);
    setComposeError("");
    setShowWritingHint(false);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  };

  const openCompose = (type = "story") => {
    setComposeType(type);
    setShowComposeModal(true);
  };

  const openConfirm = (opts) => {
    setConfirmState({ isOpen: true, ...opts });
  };

  const closeConfirm = () => {
    setConfirmState((s) => ({ ...s, isOpen: false, onConfirm: null }));
  };

  const getAvatarImage = (userId) => {
    const author = userCache[userId];
    if (author?.avatar_url) return author.avatar_url;
    const fallbackIdx = (userId ? userId.length % 5 : 0) + 1;
    return `/avatar${fallbackIdx}.png`;
  };

  const getSubjectTagClass = (subj) => {
    switch (String(subj).toLowerCase()) {
      case "maths": case "math": case "mathematics": return "tag-subject-maths";
      case "biology": return "tag-subject-biology";
      case "physics": return "tag-subject-physics";
      case "chemistry": return "tag-subject-chemistry";
      case "history": return "tag-subject-history";
      case "geography": return "tag-subject-geography";
      default: return "tag-subject-default";
    }
  };

  // Bookmark toggle
  const toggleBookmark = (threadId) => {
    setBookmarkedIds((prev) => {
      const next = prev.includes(threadId)
        ? prev.filter((id) => id !== threadId)
        : [...prev, threadId];
      localStorage.setItem("staffroom_bookmarks", JSON.stringify(next));
      toast(
        prev.includes(threadId) ? "Bookmark removed." : "Post saved to bookmarks! Switch to 'Saved' tab to view.",
        "info"
      );
      return next;
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FIRESTORE ACTIONS
  // ──────────────────────────────────────────────────────────────────────────

  const handleFlagContent = async (contentId, contentType = "meme") => {
    if (!user) { toast("Please sign in to report content.", "warning"); return; }
    if (flaggedByUser[contentId]) { toast("You have already reported this content.", "warning"); return; }
    try {
      const flagsRef = collection(db, "flags");
      const q = query(flagsRef, where("reporter_id", "==", user.uid), where("content_id", "==", contentId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setFlaggedByUser((prev) => ({ ...prev, [contentId]: true }));
        toast("You have already reported this content.", "warning");
        return;
      }
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: contentType,
        content_id: contentId,
        reason: "Inappropriate Content / Report",
        status: "pending",
        created_at: serverTimestamp(),
      });
      if (contentType === "meme") {
        await updateDoc(doc(db, "memes", contentId), { flag_count: increment(1) });
      } else if (contentType === "post") {
        await updateDoc(doc(db, "staffroom_posts", contentId), { flag_count: increment(1) });
      }
      setFlaggedByUser((prev) => ({ ...prev, [contentId]: true }));
      toast("Report submitted. Our moderation team will review it.", "success");
    } catch (e) {
      console.error("Flag content failed", e);
      toast("Failed to submit report. Please try again.", "error");
    }
  };

  const handleThreadSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setComposeError("");

    if (!composeTitle.trim()) {
      setComposeError("Please add a thread title (e.g. 'Using osmosis meme for Grade 9').");
      return;
    }
    if (composeBody.trim().length < 50) {
      setComposeError("Thread body must be at least 50 characters long.");
      return;
    }
    if (composeType === "poll") {
      const clean = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (clean.length < 2) {
        setComposeError("A poll must have at least 2 non-empty options.");
        return;
      }
    }

    setComposeLoading(true);
    try {
      // Upload attachment if selected
      let attachmentUrl = "";
      let attachmentStoragePath = "";
      if (attachmentFile) {
        setAttachmentUploading(true);
        const path = `staffroom_attachments/${user.uid}_${Date.now()}_${attachmentFile.name}`;
        const storageRef = ref(storage, path);
        const snap = await uploadBytes(storageRef, attachmentFile);
        attachmentUrl = await getDownloadURL(snap.ref);
        attachmentStoragePath = path;
        setAttachmentUploading(false);
      }

      const postsColRef = collection(db, "staffroom_posts");
      const statsDocRef = doc(db, "user_stats", user.uid);

      await runTransaction(db, async (transaction) => {
        const newPostRef = doc(postsColRef);
        const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        const votesMap = {};
        cleanOptions.forEach((_, i) => { votesMap[i] = 0; });

        transaction.set(newPostRef, {
          author_id: user.uid,
          post_type: composeType,
          title: composeTitle.trim(),
          body: composeBody,
          meme_id: linkedMemeId,
          attachment_name: attachmentName,
          attachment_url: attachmentUrl,
          attachment_storage_path: attachmentStoragePath,
          likes: 0,
          liked_by: [],
          reactions: {},
          is_solved: false,
          solved_reply_id: "",
          subject: composeSubject,
          grade_group: composeGradeGroup,
          is_announcement: profile?.role === "admin" && composeIsAnnouncement,
          poll_options: composeType === "poll" ? cleanOptions : [],
          poll_votes: composeType === "poll" ? votesMap : {},
          poll_voted_users: [],
          created_at: serverTimestamp(),
        });

        transaction.update(statsDocRef, { staffroom_posts_count: increment(1) });
      });

      closeComposeModal();
      toast("Thread published successfully!", "success");
    } catch (err) {
      console.error(err);
      setComposeError("Failed to publish thread.");
      setAttachmentUploading(false);
    } finally {
      setComposeLoading(false);
    }
  };

  const handleReplySubmit = async (threadId) => {
    if (!user) return;
    const body = replyInputMap[threadId]?.trim();
    if (!body || body.length < 10) {
      toast("Reply must be at least 10 characters.", "warning");
      return;
    }
    try {
      await addDoc(collection(db, "staffroom_replies"), {
        post_id: threadId,
        author_id: user.uid,
        body,
        is_accepted_solution: false,
        created_at: serverTimestamp(),
      });
      setReplyInputMap((prev) => ({ ...prev, [threadId]: "" }));
      toast("Reply posted!", "success");
    } catch (e) {
      console.error("Reply failed", e);
      toast("Failed to post reply. Try again.", "error");
    }
  };

  const handleThreadLike = async (thread) => {
    if (!user) { toast("Please log in to upvote threads.", "warning"); return; }
    try {
      const threadRef = doc(db, "staffroom_posts", thread.id);
      const hasLiked = (thread.liked_by || []).includes(user.uid);
      await updateDoc(threadRef, {
        liked_by: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likes: increment(hasLiked ? -1 : 1),
      });
    } catch (e) {
      console.error("Like update failed", e);
    }
  };

  // Emoji reactions
  const handleReaction = async (threadId, emoji) => {
    if (!user) { toast("Please log in to react.", "warning"); return; }
    if (reactionPending[threadId]) return;
    setReactionPending((p) => ({ ...p, [threadId]: true }));
    setReactionMenuOpen((p) => ({ ...p, [threadId]: false }));
    try {
      const threadRef = doc(db, "staffroom_posts", threadId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(threadRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const reactions = { ...(data.reactions || {}) };
        const myReaction = data[`reaction_by_${user.uid}`];

        if (myReaction === emoji) {
          // toggle off
          reactions[emoji] = Math.max(0, (reactions[emoji] || 0) - 1);
          tx.update(threadRef, { reactions, [`reaction_by_${user.uid}`]: null });
        } else {
          if (myReaction) {
            reactions[myReaction] = Math.max(0, (reactions[myReaction] || 0) - 1);
          }
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          tx.update(threadRef, { reactions, [`reaction_by_${user.uid}`]: emoji });
        }
      });
    } catch (e) {
      console.error("Reaction failed", e);
    } finally {
      setReactionPending((p) => ({ ...p, [threadId]: false }));
    }
  };

  const handleDeleteThread = (threadId) => {
    openConfirm({
      title: "Delete Thread?",
      message: "This will permanently remove the thread and all its replies. This action cannot be undone.",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "staffroom_posts", threadId));
          if (user) {
            await updateDoc(doc(db, "user_stats", user.uid), { staffroom_posts_count: increment(-1) });
          }
          toast("Thread deleted.", "success");
        } catch (e) {
          console.error(e);
          toast("Failed to delete thread.", "error");
        }
      },
    });
  };

  const handleDeleteReply = (replyId) => {
    openConfirm({
      title: "Delete Reply?",
      message: "This reply will be permanently removed.",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "staffroom_replies", replyId));
          toast("Reply deleted.", "success");
        } catch (e) {
          console.error(e);
          toast("Failed to delete reply.", "error");
        }
      },
    });
  };

  const handleAcceptSolution = async (threadId, replyId) => {
    try {
      await updateDoc(doc(db, "staffroom_replies", replyId), { is_accepted_solution: true });
      await updateDoc(doc(db, "staffroom_posts", threadId), { is_solved: true, solved_reply_id: replyId });
      toast("Solution accepted! Thread marked as solved.", "success");
    } catch (e) {
      console.error("Accept solution failed", e);
    }
  };

  const handleVoteSubmit = async (threadId, optionIdx) => {
    if (!user) { toast("Please log in to vote.", "warning"); return; }
    const threadRef = doc(db, "staffroom_posts", threadId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(threadRef);
        if (!snap.exists()) return;
        const data = snap.data();
        if ((data.poll_voted_users || []).includes(user.uid)) {
          toast("You have already voted on this poll.", "warning");
          return;
        }
        const currentVotes = data.poll_votes || {};
        tx.update(threadRef, {
          poll_voted_users: arrayUnion(user.uid),
          [`poll_votes.${optionIdx}`]: (currentVotes[optionIdx] || 0) + 1,
        });
      });
      toast("Vote recorded!", "success");
    } catch (e) {
      console.error("Voting failed", e);
    }
  };

  const handleDeleteMeme = (memeId) => {
    openConfirm({
      title: "Delete Meme?",
      message: "This will permanently remove the meme from the library.",
      variant: "danger",
      confirmLabel: "Delete Meme",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "memes", memeId));
          if (user) {
            await setDoc(doc(db, "user_stats", user.uid), { memes_created_count: increment(-1) }, { merge: true });
          }
          setActiveMeme(null);
          toast("Meme deleted.", "success");
        } catch (e) {
          console.error(e);
          toast("Failed to delete meme.", "error");
        }
      },
    });
  };

  const handleDeleteComment = (commentId) => {
    openConfirm({
      title: "Delete Comment?",
      message: "This expert review will be permanently removed.",
      variant: "danger",
      confirmLabel: "Delete",
      onConfirm: async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, "comments", commentId));
          toast("Comment deleted.", "success");
        } catch (e) {
          console.error(e);
          toast("Failed to delete comment.", "error");
        }
      },
    });
  };

  const handleRateSubmit = async (criteria, score) => {
    if (!user || !activeMeme) return;
    const ratingDocId = `${user.uid}_${activeMeme.id}`;
    const ratingRef = doc(db, "ratings", ratingDocId);
    const statsRef = doc(db, "user_stats", user.uid);
    try {
      await runTransaction(db, async (tx) => {
        const ratingDoc = await tx.get(ratingRef);
        const existingData = ratingDoc.exists() ? ratingDoc.data() : {};

        const statsDoc = await tx.get(statsRef);
        const currentCount = statsDoc.exists() ? (statsDoc.data().ratings_provided_count || 0) : 0;

        let newRating = {
          meme_id: activeMeme.id,
          user_id: user.uid,
          ...existingData,
          [criteria]: score,
          updated_at: new Date()
        };

        if (!existingData.created_at) {
          newRating.created_at = new Date();
        }

        tx.set(ratingRef, newRating);

        if (!ratingDoc.exists()) {
          tx.set(statsRef, { ratings_provided_count: currentCount + 1 }, { merge: true });
        }
      });
      toast("Rating submitted!", "success");
    } catch (e) {
      console.error("Rating failed", e);
    }
  };

  const handleExpertCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user || !profile || !activeMeme || !newExpertComment) return;
    if (profile.role !== "expert" && profile.role !== "admin") return;
    try {
      await addDoc(collection(db, "comments"), {
        meme_id: activeMeme.id,
        user_id: user.uid,
        body: newExpertComment,
        timestamp: serverTimestamp(),
        parent_id: null,
        is_expert_comment: true,
      });
      setNewExpertComment("");
      toast("Verified review submitted!", "success");
    } catch (e) {
      console.error("Expert comment failed", e);
    }
  };

  const handleLikeToggle = async (memeId, creatorId) => {
    if (!user) { toast("Please log in to like memes.", "warning"); return; }
    if (likePendingMap[memeId]) return;
    setLikePendingMap((p) => ({ ...p, [memeId]: true }));
    setAnimatingHeartMemeId(memeId);
    setTimeout(() => setAnimatingHeartMemeId(null), 300);
    const existingLikeId = userLikesMap[memeId];
    const statsRef = doc(db, "user_stats", creatorId);
    const memeRef = doc(db, "memes", memeId);
    try {
      if (existingLikeId) {
        await deleteDoc(doc(db, "likes", existingLikeId));
        await setDoc(statsRef, { total_likes_received: increment(-1) }, { merge: true });
        await updateDoc(memeRef, { likes_count: increment(-1) });
      } else {
        const likeDocId = `${user.uid}_${memeId}`;
        await setDoc(doc(db, "likes", likeDocId), {
          user_id: user.uid,
          meme_id: memeId,
          created_at: serverTimestamp(),
        });
        await setDoc(statsRef, { total_likes_received: increment(1) }, { merge: true });
        await updateDoc(memeRef, { likes_count: increment(1) });
      }
    } catch (e) {
      console.error("Like toggle failed", e);
    } finally {
      setLikePendingMap((p) => ({ ...p, [memeId]: false }));
    }
  };

  // Download with watermark
  const downloadMemeWithWatermark = (imageUrl, title) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl + (imageUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = img.naturalWidth || img.width || 500;
      const h = img.naturalHeight || img.height || 500;
      const borderHeight = Math.max(45, Math.min(120, Math.round(h * 0.08)));
      canvas.width = w;
      canvas.height = h + borderHeight;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, h, w, borderHeight);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, w, h);
      const fontSize = Math.max(11, Math.round(borderHeight * 0.28));
      ctx.fillStyle = "#374151";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textBaseline = "middle";
      const paddingX = Math.max(15, Math.round(w * 0.04));
      const textY = h + Math.round(borderHeight / 2);
      ctx.textAlign = "left";
      ctx.fillText("MemeClassroom", paddingX, textY);
      ctx.textAlign = "right";
      ctx.fillText("CC BY-NC-SA 4.0 License", w - paddingX, textY);
      const link = document.createElement("a");
      link.download = `${title || "meme"}_watermarked.png`;
      link.href = canvas.toDataURL("image/png");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.onerror = () => {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.target = "_blank";
      link.download = `${title || "meme"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  };

  const handleMediaDownload = (url, title) => {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("License Notice: This media file is licensed under Creative Commons CC BY-NC-SA 4.0.", "info");
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  const parseMarkdownInline = (text = "") => {
    return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} className="font-extrabold text-purple-650 dark:text-purple-400">{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i} className="italic text-gray-600 dark:text-gray-300">{part.slice(1, -1)}</em>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={i} className="bg-gray-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[10px]">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  const renderMarkdown = (text = "") => {
    return text.split("\n").map((line, idx) => {
      const content = line.trim();
      if (content.startsWith("# ")) return <h1 key={idx} className="text-lg font-black mt-2 mb-1">{content.slice(2)}</h1>;
      if (content.startsWith("## ")) return <h2 key={idx} className="text-base font-extrabold mt-2 mb-1">{content.slice(3)}</h2>;
      if (content.startsWith("### ")) return <h3 key={idx} className="text-sm font-bold mt-1.5 mb-1">{content.slice(4)}</h3>;
      if (content.startsWith("- ") || content.startsWith("* "))
        return <li key={idx} className="list-disc list-inside ml-2 my-0.5 text-xs text-left">{parseMarkdownInline(content.slice(2))}</li>;
      if (!content.trim()) return <div key={idx} className="h-2" />;
      return <p key={idx} className="my-1 text-xs leading-relaxed text-left">{parseMarkdownInline(content)}</p>;
    });
  };

  const renderPoll = (thread) => {
    const options = thread.poll_options || [];
    const votes = thread.poll_votes || {};
    const votedUsers = thread.poll_voted_users || [];
    const totalVotes = Object.values(votes).reduce((sum, v) => sum + (v || 0), 0);
    const hasVoted = user && votedUsers.includes(user.uid);

    return (
      <div className="mt-3 space-y-3 bg-gray-50/50 dark:bg-zinc-950 p-4 rounded-xl border border-gray-200 dark:border-zinc-800">
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-purple-600 dark:text-purple-400 mb-2">
          <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          Classroom Poll ({totalVotes} total {totalVotes === 1 ? "vote" : "votes"})
        </span>
        <div className="space-y-2.5 text-left">
          {options.map((option, idx) => {
            const count = votes[idx] || 0;
            const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            if (user && !hasVoted) {
              return (
                <button
                  key={idx}
                  onClick={() => handleVoteSubmit(thread.id, idx)}
                  className="w-full text-left text-xs font-semibold px-4 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-purple-600 dark:hover:border-purple-500 transition duration-150 flex items-center justify-between"
                >
                  <span>{option}</span>
                  <Vote className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </button>
              );
            }
            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                  <span>{option}</span>
                  <span>{percent}% ({count})</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full poll-bar-fill"
                    style={{ '--poll-pct': `${percent}%`, width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {!user && (
          <span className="block text-[10px] text-gray-400 text-center italic mt-2">Please log in to cast your vote.</span>
        )}
      </div>
    );
  };

  // Engagement micro-bar
  const renderEngagementBar = (thread) => {
    const totalReactions = Object.values(thread.reactions || {}).reduce((s, v) => s + (v || 0), 0);
    const rCount = (replies[thread.id] || []).length;
    const pollVotes = Object.values(thread.poll_votes || {}).reduce((s, v) => s + (v || 0), 0);
    const total = totalReactions + rCount + pollVotes;
    const score = Math.min(100, Math.round((total / 10) * 100));
    const color = score < 30 ? "from-gray-300 to-gray-400" : score < 60 ? "from-amber-400 to-orange-400" : "from-purple-500 to-indigo-500";
    return (
      <div className="mt-2 h-0.5 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-zinc-800" title={`Engagement score: ${total} interactions`}>
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    );
  };

  // Trending topics
  const trendingTopics = React.useMemo(() => {
    const counts = {};
    threads.forEach((t) => {
      if (!t.body) return;
      const tags = t.body.match(/#\w+/g);
      if (tags) {
        [...new Set(tags.map((tag) => tag.toLowerCase()))].forEach((tag) => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [threads]);

  // Filtered & sorted threads
  const filteredThreads = React.useMemo(() => {
    let list = threads.filter((t) => {
      if (activeFilter === "story" && t.post_type !== "story") return false;
      if (activeFilter === "query" && t.post_type !== "query") return false;
      if (activeFilter === "poll" && t.post_type !== "poll") return false;
      if (activeFilter === "saved" && !bookmarkedIds.includes(t.id)) return false;

      if (subjectFilter) {
        const threadSubject = t.subject || "";
        const linkedMeme = availableMemes.find((m) => m.id === t.meme_id);
        const memeSubject = linkedMeme?.subject || "";
        if (
          threadSubject.toLowerCase() !== subjectFilter.toLowerCase() &&
          memeSubject.toLowerCase() !== subjectFilter.toLowerCase()
        ) return false;
      }
      if (gradeFilter) {
        const threadGrade = t.grade_group || "";
        const linkedMeme = availableMemes.find((m) => m.id === t.meme_id);
        const memeGrade = linkedMeme?.age_group || "";
        if (
          threadGrade.toLowerCase() !== gradeFilter.toLowerCase() &&
          memeGrade.toLowerCase() !== gradeFilter.toLowerCase()
        ) return false;
      }
      if (topicFilter && !t.body?.toLowerCase().includes(topicFilter.toLowerCase())) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const bodyMatch = (t.body || "").toLowerCase().includes(q);
        const titleMatch = (t.title || "").toLowerCase().includes(q);
        const author = userCache[t.author_id]?.name || "";
        const authorMatch = author.toLowerCase().includes(q);
        const linkedMeme = availableMemes.find((m) => m.id === t.meme_id);
        const memeMatch = linkedMeme ? linkedMeme.title.toLowerCase().includes(q) : false;
        if (!bodyMatch && !titleMatch && !authorMatch && !memeMatch) return false;
      }
      return true;
    });

    // Sort
    list = list.sort((a, b) => {
      const aAnn = a.is_announcement ? 1 : 0;
      const bAnn = b.is_announcement ? 1 : 0;
      if (aAnn !== bAnn) return bAnn - aAnn;
      if (sortMode === "upvoted") {
        const getReactionsCount = (t) => Object.values(t.reactions || {}).reduce((s, v) => s + (v || 0), 0);
        return getReactionsCount(b) - getReactionsCount(a);
      }
      if (sortMode === "discussed") {
        return ((replies[b.id] || []).length) - ((replies[a.id] || []).length);
      }
      return (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);
    });

    return list;
  }, [threads, activeFilter, subjectFilter, gradeFilter, topicFilter, searchQuery, userCache, availableMemes, bookmarkedIds, sortMode, replies]);

  // Rating helpers
  const getAverageScore = (criteria) => {
    if (currentMemeRatings.length === 0) return 0;
    const valid = currentMemeRatings.filter((r) => r[criteria] != null);
    if (valid.length === 0) return 0;
    return valid.reduce((acc, r) => acc + (r[criteria] || 0), 0) / valid.length;
  };
  const getScoreCount = (criteria) =>
    currentMemeRatings.filter((r) => r[criteria] != null).length;

  // ──────────────────────────────────────────────────────────────────────────
  // STYLE TOKENS
  // ──────────────────────────────────────────────────────────────────────────

  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl"
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const btnClass =
    "bg-purple-600 hover:bg-purple-750 text-white font-semibold text-sm px-4 py-2 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-800 bg-zinc-950 rounded-lg text-sm text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-sm text-gray-800";

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">

      {/* Confirm Dialog (global for this page) */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Back-to-Top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-6 z-50 bg-purple-600 text-white text-xs font-bold px-3 py-2 rounded-full shadow-lg hover:bg-purple-700 transition"
          style={{ animation: "fadeIn 0.2s ease-out" }}
        >
          ↑ Top
        </button>
      )}

      {/* Unread banner */}
      {unreadCount > 0 && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-xl px-4 py-3 flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300">
          <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5 text-purple-650 dark:text-purple-400" /> {unreadCount} new {unreadCount === 1 ? "post" : "posts"} since your last visit</span>
          <button onClick={() => setUnreadCount(0)} className="ml-4 opacity-60 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Staffroom Forum</h1>
          <p className="mt-1 text-sm text-gray-500">
            Share teacher stories or post queries for verified peer answers.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => {
              if (user) {
                openCompose("story");
              } else {
                navigate("/auth");
              }
            }}
            className={btnClass}
          >
            <span className="flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Compose Thread</span>
          </button>
        </div>
      </div>

      {/* LinkedIn-style 3-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

        {/* ── LEFT COLUMN: Profile widget ── */}
        <div className="lg:col-span-1 space-y-4">
          {user ? (
            <div
              onClick={() => navigate("/profile")}
              className={`overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 ${containerClass}`}
            >
              <div className="h-16 bg-gradient-to-r from-purple-600 to-indigo-650" />
              <div className="px-4 pb-4 text-center relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                  <img
                    src={profile?.avatar_url || `/avatar${(user.uid.length % 5) + 1}.png`}
                    alt="User Avatar"
                    className="w-16 h-16 rounded-full border-4 border-white dark:border-zinc-900 shadow-md object-cover"
                  />
                </div>
                <div className="pt-8">
                  <h3 className="font-extrabold text-sm text-gray-900 dark:text-white hover:underline leading-tight">
                    {profile?.name || "Educator"}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-semibold mt-1 uppercase tracking-wider">
                    {profile?.role || "Teacher"}
                  </p>
                  {profile?.tagline && (
                    <p className="text-[10px] text-gray-400 italic mt-0.5">{profile.tagline}</p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-800 text-left space-y-2.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>Contribution Points</span>
                    <span className="text-purple-650 dark:text-purple-400">
                      {(userStats.memes_created_count * 10) + (userStats.staffroom_posts_count * 5) + (userStats.ratings_provided_count * 2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Upvotes Received</span>
                    <span className="text-gray-800 dark:text-gray-200">{userStats.total_likes_received}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Ratings Provided</span>
                    <span className="text-gray-800 dark:text-gray-200">{userStats.ratings_provided_count}</span>
                  </div>
                </div>

                {userBadges.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 text-left">
                    <span className="block text-[9px] uppercase tracking-wider text-gray-400 font-extrabold mb-2">My Milestones</span>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {userBadges.map((badge) => (
                        <span
                          key={badge.id}
                          title={badge.badge_name}
                          className="text-[9px] bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 font-extrabold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-850 flex items-center gap-1"
                        >
                          <Trophy className="w-2.5 h-2.5 text-amber-500" /> {badge.badge_name.split(" ")[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={`p-4 text-center space-y-3 ${containerClass}`}>
              <School className="w-8 h-8 text-purple-650 dark:text-purple-400 mx-auto" />
              <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                Join MemeClassroom's professional educator hub to post threads and upvote ideas.
              </p>
              <button onClick={() => navigate("/auth")} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-lg text-xs transition shadow-sm">
                Sign In / Register
              </button>
            </div>
          )}

          {/* Quick Navigation */}
          <div className={`p-4 ${containerClass} hidden lg:block`}>
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-extrabold mb-3">Quick Navigation</span>
            <div className="space-y-2 text-xs font-bold text-gray-600 dark:text-gray-300">
              <button onClick={() => navigate("/lab")} className="block hover:text-purple-650 transition text-left">🎨 Design Workbench</button>
              <button onClick={() => navigate("/library")} className="block hover:text-purple-650 transition text-left">📚 Meme Gallery</button>
              <button onClick={() => navigate("/resources")} className="block hover:text-purple-650 transition text-left">📖 Lesson Plans</button>
            </div>
          </div>
        </div>

        {/* ── CENTER COLUMN: Feed ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Composer shortcut bar */}
          {user && (
            <div className="p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_-6px_rgba(0,0,0,0.1)] border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl transition-all duration-300">
              <div className="flex items-center gap-3">
                <img
                  src={profile?.avatar_url || `/avatar${(user.uid.length % 5) + 1}.png`}
                  alt="My Avatar"
                  className="w-9 h-9 rounded-full border shadow-sm object-cover cursor-pointer hover:opacity-90 animate-fadeIn"
                  onClick={() => navigate("/profile")}
                />
                <button
                  onClick={() => openCompose("story")}
                  className="flex-grow text-left text-xs bg-slate-50 hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-gray-500 font-semibold px-4 py-2.5 rounded-full border border-gray-200 dark:border-zinc-800 transition"
                >
                  Share an experience, doubt, or poll… (Markdown enabled)
                </button>
              </div>
              <div className="flex justify-around items-center border-t border-gray-100 dark:border-zinc-800 mt-3 pt-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                {[
                  { type: "story", icon: <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />, label: "Write Story" },
                  { type: "query", icon: <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />, label: "Ask Doubt" },
                  { type: "poll",  icon: <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />, label: "Create Poll" },
                ].map(({ type, icon, label }) => (
                  <button
                    key={type}
                    onClick={() => openCompose(type)}
                    className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800 px-3 py-1.5 rounded-lg transition"
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters + Sort */}
          <div className={`p-4 space-y-3.5 ${containerClass}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "All Feed" },
                  { id: "story", label: "Stories" },
                  { id: "query", label: "Queries" },
                  { id: "poll", label: "Polls" },
                  { id: "saved", label: `Saved${bookmarkedIds.length > 0 ? ` (${bookmarkedIds.length})` : ""}`, icon: <Bookmark className="w-3 h-3 mr-1" /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveFilter(tab.id); setTopicFilter(""); }}
                    className={`text-xs font-bold border-b-2 pb-1 transition flex items-center ${
                      activeFilter === tab.id
                        ? "border-purple-650 text-purple-650 dark:text-purple-400"
                        : "border-transparent text-gray-400 hover:text-gray-500"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Sort + active topic chip */}
              <div className="flex items-center gap-2 flex-wrap">
                {topicFilter && (
                  <div className="flex items-center gap-1 bg-purple-50 text-purple-750 dark:bg-purple-950/20 dark:text-purple-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-purple-200">
                    <span>Topic: {topicFilter}</span>
                    <button onClick={() => setTopicFilter("")} className="hover:text-red-500 font-bold ml-1">✕</button>
                  </div>
                )}
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                    "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300"
                  }`}
                  title="Sort feed"
                >
                  <option value="newest">Newest</option>
                  <option value="upvoted">Most Upvoted</option>
                  <option value="discussed">Most Discussed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <input
                type="text"
                placeholder="Search threads…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  highContrastMode
                    ? "bg-zinc-950 border-zinc-800 text-white placeholder-zinc-600"
                    : "bg-white border-gray-200 text-gray-800 placeholder-gray-400"
                }`}
              />
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  highContrastMode ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-800"
                }`}
              >
                <option value="">All Subjects</option>
                {SUBJECTS.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className={`px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  highContrastMode ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-gray-200 text-gray-800"
                }`}
              >
                <option value="">All Grades</option>
                {GRADE_GROUPS.map((gr) => <option key={gr} value={gr}>{gr}</option>)}
              </select>
            </div>
          </div>

          {/* Thread cards */}
          <div className="space-y-4">
            {feedLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => {
                const authorName = userCache[thread.author_id]?.name || "Teacher";
                const authorTagline = userCache[thread.author_id]?.tagline || "";
                const isSolved = thread.is_solved;
                const isAnnouncement = thread.is_announcement;
                const activeReplies = replies[thread.id] || [];
                const linkedMeme = availableMemes.find((m) => m.id === thread.meme_id);
                const isBookmarked = bookmarkedIds.includes(thread.id);
                const myReaction = thread[`reaction_by_${user?.uid}`];
                const totalReactions = Object.values(thread.reactions || {}).reduce((s, v) => s + (v || 0), 0);

                return (
                  <div
                    key={thread.id}
                    className={`p-5 transition rounded-xl border ${
                      isAnnouncement ? "border-amber-400 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/20 text-gray-800 dark:text-zinc-100 shadow-sm" : isSolved ? "border-emerald-400 dark:border-emerald-900/50 bg-emerald-50/10 dark:bg-emerald-950/20 text-gray-800 dark:text-zinc-100 shadow-sm" : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-zinc-100 shadow-sm"
                    }`}
                  >
                    {/* Tags row */}
                    <div className="flex flex-wrap gap-2 justify-between items-center mb-3 border-b border-gray-50 dark:border-zinc-800/40 pb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isAnnouncement && (
                          <span className="bg-amber-100 text-amber-850 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded border border-amber-300 flex items-center gap-1 uppercase tracking-wide">
                            📢 Official Announcement
                          </span>
                        )}
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded tracking-wide ${
                          thread.post_type === "query"
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
                            : thread.post_type === "poll"
                              ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800"
                              : "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800"
                        }`}>
                          {thread.post_type === "query" ? "Doubt / Query" : thread.post_type === "poll" ? "Community Poll" : "Experience Story"}
                        </span>
                        {isSolved && (
                          <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                            <span>✓</span><span>Solved</span>
                          </span>
                        )}
                        {thread.subject && (
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded ${getSubjectTagClass(thread.subject)}`}>
                            {thread.subject}
                          </span>
                        )}
                        {thread.grade_group && (
                          <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-200">
                            {thread.grade_group}
                          </span>
                        )}
                      </div>

                      {/* Author + actions */}
                      <div className="flex items-center space-x-2.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={getAvatarImage(thread.author_id)}
                            alt="Author Avatar"
                            onClick={() => openUserModal(thread.author_id)}
                            className="w-7 h-7 rounded-full border shadow-sm object-cover cursor-pointer hover:opacity-90"
                          />
                          <div className="text-left">
                            <button
                              onClick={() => openUserModal(thread.author_id)}
                              className="text-xs text-purple-700 dark:text-purple-400 font-black hover:underline block leading-tight"
                            >
                              {authorName}
                            </button>
                            {authorTagline && (
                              <p className="text-[9px] text-gray-400 italic">{authorTagline}</p>
                            )}
                            {(() => {
                              const author = userCache[thread.author_id];
                              if (!author) return null;
                              let badgeClass = "bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300";
                              if (author.role === "admin") badgeClass = "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
                              else if (author.role === "expert") badgeClass = "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300";
                              else if (author.role === "teacher") badgeClass = "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300";
                              return (
                                <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded tracking-wider uppercase ${badgeClass} inline-flex items-center gap-0.5 mt-0.5`}>
                                  {author.role || "MEMBER"} {author.is_verified && <ShieldCheck className="w-2.5 h-2.5 text-indigo-650 dark:text-indigo-400 inline-block" />}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Bookmark */}
                        <button
                          onClick={() => toggleBookmark(thread.id)}
                          title={isBookmarked ? "Remove bookmark" : "Save for later"}
                          className={`transition p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 ${isBookmarked ? "text-amber-500" : "text-gray-300 dark:text-zinc-500 hover:text-amber-400"}`}
                        >
                          <Bookmark className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} />
                        </button>

                        {/* Delete */}
                        {user && (thread.author_id === user.uid || profile?.role === "admin") && (
                          <button
                            onClick={() => handleDeleteThread(thread.id)}
                            className="text-red-500 hover:text-red-750 text-xs font-bold transition"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    {thread.title && (
                      <h4 className="font-extrabold text-sm text-gray-900 dark:text-white mb-2">{thread.title}</h4>
                    )}

                    {/* Body */}
                    <div className="prose prose-sm dark:prose-invert max-w-none mb-4 text-left leading-relaxed text-gray-800 dark:text-zinc-200 font-medium">
                      {renderMarkdown(thread.body)}
                    </div>

                    {/* Poll */}
                    {thread.post_type === "poll" && renderPoll(thread)}

                    {/* Linked meme */}
                    {linkedMeme && (
                      <div
                        onClick={() => setActiveMeme(linkedMeme)}
                        className="my-4 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-950 flex flex-col sm:flex-row items-center p-3 gap-4 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-purple-500/20 transition"
                      >
                        <div className="w-full sm:w-32 aspect-[4/3] relative flex items-center justify-center bg-white dark:bg-zinc-900 rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden flex-shrink-0">
                          {(linkedMeme.format === "image" || linkedMeme.format === "gif") && (
                            <img src={linkedMeme.media_url} alt={linkedMeme.title} className="max-w-full max-h-full object-contain" />
                          )}
                          {linkedMeme.format === "video" && (
                            <video src={linkedMeme.media_url} className="max-w-full max-h-full object-contain" controls onClick={(e) => e.stopPropagation()} />
                          )}
                          {linkedMeme.format === "audio" && (
                            <div className="flex flex-col items-center justify-center p-2 w-full h-full">
                              <Music className="w-5 h-5 mb-1 text-purple-650 dark:text-purple-400" />
                              <audio src={linkedMeme.media_url} controls className="w-full max-w-[120px] scale-90" onClick={(e) => e.stopPropagation()} />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow min-w-0 text-left">
                          <span className="text-[10px] uppercase tracking-wider text-purple-600 dark:text-purple-400 font-bold block mb-0.5">Linked Meme (Click to view)</span>
                          <h4 className="font-extrabold text-sm text-gray-900 dark:text-white truncate">{linkedMeme.title}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold">{linkedMeme.subject}</span>
                            <span className="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300 text-[10px] px-2 py-0.5 rounded-full font-bold">{linkedMeme.age_group}</span>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">{linkedMeme.format}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attachment */}
                    {thread.attachment_url ? (
                      <div className="my-3 p-3 border border-gray-200 dark:border-zinc-800 rounded-xl bg-gray-50/40 dark:bg-zinc-950/40 text-left space-y-2.5">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                          <a 
                            href={thread.attachment_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="hover:underline text-purple-650 dark:text-purple-400 font-bold truncate max-w-xs sm:max-w-md"
                          >
                            {thread.attachment_name || "View Attachment"}
                          </a>
                        </div>
                        {/* Inline Image Preview if it's an image */}
                        {((thread.attachment_name && thread.attachment_name.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) || thread.attachment_url.toLowerCase().includes("image")) && (
                          <div className="max-w-full sm:max-w-md rounded-xl overflow-hidden border border-gray-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm hover:shadow transition-shadow duration-300">
                            <a href={thread.attachment_url} target="_blank" rel="noreferrer" title="Click to view full size">
                              <img 
                                src={thread.attachment_url} 
                                alt={thread.attachment_name || "Attachment"} 
                                className="max-h-72 w-full object-contain mx-auto hover:opacity-95 transition-opacity"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </a>
                          </div>
                        )}
                      </div>
                    ) : thread.attachment_name ? (
                      <div className="my-3 p-3 border border-dashed rounded-xl text-xs text-gray-400 dark:text-zinc-700 flex items-center space-x-2 bg-gray-50/30 dark:bg-zinc-950/20 italic text-left">
                        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        <span>{thread.attachment_name} (file expired or unavailable)</span>
                      </div>
                    ) : null}

                    {/* LinkedIn-style Reaction and Reply summary */}
                    {(totalReactions > 0 || activeReplies.length > 0) && (
                      <div className="flex items-center justify-between border-t border-gray-100/70 dark:border-gray-700/30 pt-2.5 mt-3 text-[11px] text-gray-500">
                        <div className="flex items-center space-x-1">
                          {totalReactions > 0 && (
                            <div className="flex items-center space-x-1">
                              <div className="flex -space-x-1">
                                {Object.entries(thread.reactions || {})
                                  .filter(([_, count]) => count > 0)
                                  .sort((a, b) => b[1] - a[1])
                                  .slice(0, 3)
                                  .map(([emoji]) => (
                                    <span key={emoji} className="inline-flex items-center justify-center text-[10px] w-5 h-5 rounded-full bg-white dark:bg-zinc-900 shadow-sm border border-gray-100 dark:border-zinc-800">
                                      {renderReactionIcon(emoji, "w-3 h-3")}
                                    </span>
                                  ))}
                              </div>
                              <span className="font-bold text-gray-600 dark:text-gray-300">{totalReactions}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 font-semibold">
                          <span>{activeReplies.length} {activeReplies.length === 1 ? "reply" : "replies"}</span>
                        </div>
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-2 text-xs mt-2">
                      <div className="flex items-center space-x-3">
                        {/* LinkedIn Reactions Button */}
                        <div 
                          className="relative group/react"
                          onMouseEnter={() => setReactionMenuOpen((p) => ({ ...p, [thread.id]: true }))}
                          onMouseLeave={() => setReactionMenuOpen((p) => ({ ...p, [thread.id]: false }))}
                        >
                          <button
                            onClick={() => {
                              if (!user) {
                                toast("Please log in to react.", "warning");
                                return;
                              }
                              if (myReaction) {
                                handleReaction(thread.id, myReaction);
                              } else {
                                handleReaction(thread.id, "👍");
                              }
                            }}
                            className={`flex items-center space-x-1.5 transition px-2.5 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 ${
                              getReactionStyle(myReaction).className
                            }`}
                          >
                            {myReaction ? (
                              myReaction === "👍" ? (
                                <ThumbsUp className="w-4 h-4 fill-current text-blue-600 dark:text-blue-400" />
                              ) : (
                                <span className="text-base leading-none">{myReaction}</span>
                              )
                            ) : (
                              <ThumbsUp className="w-4 h-4 text-gray-400 dark:text-gray-505" />
                            )}
                            <span>{getReactionStyle(myReaction).label}</span>
                          </button>

                          {/* Reaction picker */}
                          {reactionMenuOpen[thread.id] && (
                            <div 
                              className="absolute bottom-full left-0 mb-1 z-30 flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-full shadow-xl px-3 py-1.5"
                              style={{ animation: "scaleIn 0.15s ease-out" }}
                            >
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(thread.id, emoji)}
                                  className="hover:scale-135 active:scale-95 transition-transform p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center"
                                  title={getReactionStyle(emoji).label}
                                >
                                  {renderReactionIcon(emoji, "w-5 h-5")}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <span className="text-gray-400 dark:text-gray-400 flex items-center space-x-1.5">
                          <MessageSquare className="w-4 h-4" />
                          <span>Reply</span>
                        </span>
                      </div>

                      {/* Report */}
                      <button
                        onClick={() => handleFlagContent(thread.id, "post")}
                        className={`text-xs flex items-center gap-1 transition ${
                          flaggedByUser[thread.id] ? "text-red-500 font-bold" : "text-gray-400 dark:text-gray-400 hover:text-red-500"
                        }`}
                        title="Report Inappropriate Thread"
                      >
                        <Flag className="w-3.5 h-3.5" fill={flaggedByUser[thread.id] ? "currentColor" : "none"} />
                        <span>{flaggedByUser[thread.id] ? "Reported" : "Report"}</span>
                      </button>
                    </div>

                    {/* Engagement bar */}
                    {renderEngagementBar(thread)}

                    {/* Replies list */}
                    {activeReplies.length > 0 && (
                      <div className="mt-4 pl-4 border-l border-gray-200 dark:border-zinc-800 space-y-3.5">
                        {activeReplies.map((reply) => {
                          const rAuthorName = userCache[reply.author_id]?.name || "Peer";
                          const isAccepted = reply.is_accepted_solution;
                          return (
                            <div
                              key={reply.id}
                              className={`p-3 rounded-lg text-xs leading-relaxed ${
                                isAccepted
                                  ? "bg-emerald-500/10 border border-emerald-300"
                                  : "bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1.5">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={getAvatarImage(reply.author_id)}
                                    alt="Reply Author"
                                    onClick={() => openUserModal(reply.author_id)}
                                    className="w-5 h-5 rounded-full object-cover shadow-sm cursor-pointer"
                                  />
                                  <button onClick={() => openUserModal(reply.author_id)} className="font-bold text-xs text-purple-650 hover:underline">
                                    {rAuthorName}
                                  </button>
                                  {user && (reply.author_id === user.uid || thread.author_id === user.uid || profile?.role === "admin" || profile?.role === "expert") && (
                                    <button onClick={() => handleDeleteReply(reply.id)} className="text-red-500 hover:text-red-750 text-xs font-bold transition ml-2">
                                      Delete
                                    </button>
                                  )}
                                </div>
                                {isAccepted ? (
                                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span>Accepted Solution</span>
                                  </span>
                                ) : (
                                  user && user.uid === thread.author_id && thread.post_type === "query" && !isSolved && (
                                    <button
                                      onClick={() => handleAcceptSolution(thread.id, reply.id)}
                                      className="text-xs bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 px-2.5 py-1 rounded hover:bg-emerald-100"
                                    >
                                      ✓ Accept Solution
                                    </button>
                                  )
                                )}
                              </div>
                              <p className="text-gray-700 dark:text-gray-300 font-semibold text-left">{reply.body}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reply compose */}
                    {user ? (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800/40 space-y-1">
                        <textarea
                          placeholder="Write a peer response… (min 10 characters)"
                          value={replyInputMap[thread.id] || ""}
                          onChange={(e) => setReplyInputMap((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                          rows={2}
                          className={`${inputClass} resize-none text-xs`}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400">
                            {(replyInputMap[thread.id] || "").length} chars
                            {(replyInputMap[thread.id] || "").length < 10 && (replyInputMap[thread.id] || "").length > 0 && (
                              <span className="text-red-400 ml-1">— 10 min</span>
                            )}
                          </span>
                          <button onClick={() => handleReplySubmit(thread.id)} className={btnClass}>
                            Reply
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800/40 text-center py-2">
                        <button
                          onClick={() => navigate("/auth")}
                          className="text-xs font-bold text-purple-650 hover:underline transition"
                        >
                          Sign in to reply to this thread
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center text-gray-500 shadow-sm">
                <p className="text-sm font-semibold mb-1">No threads match these filters.</p>
                <p className="text-xs text-gray-400">Try broadening your subject, grade, or keywords.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN: Sidebar widgets ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* Trending topics */}
          <div className={`p-4 ${containerClass}`}>
            <span className="block text-[10px] uppercase tracking-wider text-gray-400 font-extrabold mb-3"># Trending Topics</span>
            {trendingTopics.length > 0 ? (
              <div className="space-y-2 text-left">
                {trendingTopics.map((topic) => (
                  <button
                    key={topic.name}
                    onClick={() => setTopicFilter(topic.name)}
                    className={`block text-xs font-semibold hover:underline w-full text-left truncate ${
                      topicFilter.toLowerCase() === topic.name.toLowerCase()
                        ? "text-purple-650 font-black"
                        : "text-gray-600 dark:text-gray-300 hover:text-purple-650"
                    }`}
                  >
                    {topic.name} <span className="text-[10px] text-gray-400 font-medium">({topic.count} {topic.count === 1 ? "post" : "posts"})</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="block text-xs text-gray-400 italic">No topics tagged yet. Add #Hashtags to your posts!</span>
            )}
          </div>

          {/* Community Feed link card */}
          <div className={`p-4 ${containerClass}`}>
            <h3 className="font-extrabold text-[10px] uppercase tracking-wider mb-2">Community Feed</h3>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-4">
              Follow MemeClassroom on X for platform updates, community showcases, and pedagogy tips.
            </p>
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="w-full inline-block text-center bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 rounded-lg text-xs transition"
            >
              Follow MemeClassroom Hub on X ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── COMPOSE MODAL ── */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Compose Thread">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold">Compose Thread</h2>
              <button onClick={closeComposeModal} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none" aria-label="Close compose modal">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-6">Share a classroom experience, ask peers a question, or run a poll.</p>

            {composeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-650 rounded text-xs">{composeError}</div>
            )}

            <form onSubmit={handleThreadSubmit} className="space-y-4 text-xs font-semibold">
              {/* Format / Subject / Grade row */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Format</label>
                  <select value={composeType} onChange={(e) => setComposeType(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded">
                    <option value="story">Story</option>
                    <option value="query">Query</option>
                    <option value="poll">Poll</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Subject</label>
                  <select value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded">
                    {SUBJECTS.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Grades</label>
                  <select value={composeGradeGroup} onChange={(e) => setComposeGradeGroup(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded">
                    {GRADE_GROUPS.map((gr) => <option key={gr} value={gr}>{gr}</option>)}
                  </select>
                </div>
              </div>

              {/* Title field */}
              <div>
                <label className="block text-gray-500 uppercase mb-1">Thread Title <span className="text-red-400">*</span></label>
                <input
                  ref={composeTitleRef}
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Using osmosis meme for Grade 9 retention…"
                  value={composeTitle}
                  onChange={(e) => setComposeTitle(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{composeTitle.length}/120</p>
              </div>

              {/* Body + AI hint */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-gray-500 uppercase">Description <span className="text-[10px] font-normal normal-case">(min 50 chars)</span></label>
                  <div className="flex space-x-1 bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-md">
                    {["write", "preview"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setComposerTab(tab)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize ${composerTab === tab ? "bg-white dark:bg-zinc-700 shadow-sm" : "text-gray-500"}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {composerTab === "write" ? (
                  <div className="relative">
                    <textarea
                      placeholder="Describe your thread (supports Markdown bold **text**, italic *text*, `code`)…"
                      value={composeBody}
                      onChange={(e) => {
                        setComposeBody(e.target.value);
                        setShowWritingHint(false);
                        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
                        hintTimerRef.current = setTimeout(() => setShowWritingHint(true), 5000);
                      }}
                      onFocus={() => {
                        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
                        hintTimerRef.current = setTimeout(() => setShowWritingHint(true), 5000);
                      }}
                      onBlur={() => {
                        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
                        setShowWritingHint(false);
                      }}
                      rows={4}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded resize-y focus:outline-none focus:ring-1 focus:ring-purple-500"
                      required
                    />
                    {showWritingHint && WRITING_HINTS[composeType] && (
                      <div className="mt-1.5 p-2.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg text-[10px] text-purple-700 dark:text-purple-300 leading-relaxed flex items-start gap-1.5" style={{ animation: "fadeIn 0.3s ease-out" }}>
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" /> <em>{WRITING_HINTS[composeType]}</em>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full min-h-[104px] px-3 py-2 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded overflow-y-auto max-h-44 text-[11px] text-left">
                    {composeBody ? renderMarkdown(composeBody) : <span className="text-gray-400 italic">Nothing written yet.</span>}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-1">{composeBody.length} characters</p>
              </div>

              {/* Poll options — dynamic */}
              {composeType === "poll" && (
                <div className="space-y-2 border-t pt-3 border-gray-100 dark:border-gray-800">
                  <span className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Poll Options (min 2 required)</span>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder={`Option ${idx + 1}${idx < 2 ? " (Required)" : " (Optional)"}`}
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...pollOptions];
                          newOpts[idx] = e.target.value;
                          setPollOptions(newOpts);
                        }}
                        className="flex-grow px-2.5 py-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-xs"
                        required={idx < 2}
                      />
                      {idx >= 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((p) => p.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600 font-bold text-sm leading-none"
                          title="Remove option"
                        >✕</button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((p) => [...p, ""])}
                      className="text-xs text-purple-650 font-bold hover:underline"
                    >
                      ＋ Add Option
                    </button>
                  )}
                </div>
              )}

              {/* Linked meme + Attachment */}
              <div className="grid grid-cols-2 gap-4 border-t pt-3 border-gray-100 dark:border-gray-800">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Linked Meme</label>
                  <select
                    value={linkedMemeId}
                    onChange={(e) => setLinkedMemeId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded"
                  >
                    <option value="">No linked meme</option>
                    {availableMemes.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">
                    Attach File
                    <span className="ml-1 text-[9px] normal-case font-normal text-gray-400">(uploaded to cloud)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setAttachmentFile(f); setAttachmentName(f.name); }
                    }}
                    className="block w-full text-[10px] mt-1"
                  />
                  {attachmentName && (
                    <p className="text-[9px] text-purple-650 mt-0.5 truncate">📎 {attachmentName}</p>
                  )}
                  {attachmentUploading && (
                    <p className="text-[9px] text-amber-600 animate-pulse mt-0.5">Uploading…</p>
                  )}
                </div>
              </div>

              {/* Admin announcement checkbox */}
              {profile?.role === "admin" && (
                <div className="flex items-center gap-2 border-t pt-3 border-gray-100 dark:border-gray-800">
                  <input
                    type="checkbox"
                    id="adminAnnouncement"
                    checked={composeIsAnnouncement}
                    onChange={(e) => setComposeIsAnnouncement(e.target.checked)}
                    className="w-4 h-4 text-purple-650 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="adminAnnouncement" className="text-amber-800 dark:text-amber-300 font-bold text-xs select-none">
                    📢 Post as Official Announcement (pins to top of feed)
                  </label>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={closeComposeModal} className="bg-gray-200 dark:bg-gray-700 text-gray-700 px-4 py-2 rounded-lg font-bold text-xs">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composeLoading || attachmentUploading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-purple-750 disabled:opacity-60"
                >
                  {composeLoading ? (attachmentUploading ? "Uploading…" : "Publishing…") : "Submit Thread"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MEME DETAIL MODAL ── */}
      {activeMeme && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Meme Detail">
          <div className={`w-full max-w-4xl p-6 rounded-xl overflow-y-auto max-h-[90vh] grid grid-cols-1 md:grid-cols-2 gap-6 ${containerClass}`}>

            {/* Left: media + ratings */}
            <div>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-extrabold leading-tight">{activeMeme.title}</h2>
                {/* Close button — always visible */}
                <button
                  ref={memeDetailCloseRef}
                  onClick={() => setActiveMeme(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none ml-2 flex-shrink-0"
                  aria-label="Close meme detail"
                >✕</button>
              </div>

              <div className="bg-black aspect-square rounded-xl overflow-hidden flex items-center justify-center mb-4">
                {activeMeme.format === "image" && <img src={activeMeme.media_url} alt={activeMeme.title} className="max-w-full max-h-full object-contain" />}
                {activeMeme.format === "video" && <video src={activeMeme.media_url} controls className="max-w-full max-h-full" />}
                {activeMeme.format === "gif" && <img src={activeMeme.media_url} alt={activeMeme.title} className="max-w-full max-h-full object-contain" />}
                {activeMeme.format === "audio" && <audio src={activeMeme.media_url} controls className="w-full px-6" />}
              </div>

              <div className="flex justify-between items-center mb-4 text-xs font-semibold text-gray-500">
                <div className="flex items-center space-x-2">
                  <button onClick={() => openUserModal(activeMeme.creator_id)} className="hover:underline text-purple-750">
                    By {activeMeme.creator_id === "admin" ? "MemeClassroom Team" : (userCache[activeMeme.creator_id]?.name || "Creator")}
                  </button>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500 fill-current" /> {activeMeme.likes_count || 0} Likes</span>
                </div>
                {user && (activeMeme.creator_id === user.uid || profile?.role === "admin") && (
                  <button onClick={() => handleDeleteMeme(activeMeme.id)} className="text-red-500 hover:text-red-750 hover:underline transition">
                    Delete Meme
                  </button>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    if (activeMeme.format === "image" || activeMeme.format === "gif") {
                      downloadMemeWithWatermark(activeMeme.media_url, activeMeme.title);
                    } else {
                      handleMediaDownload(activeMeme.media_url, activeMeme.title);
                    }
                  }}
                  className="flex-1 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-bold py-2 rounded-lg border border-purple-200 dark:border-purple-800 text-xs flex items-center justify-center space-x-1.5 hover:bg-purple-100 transition"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /><span>Download</span>
                </button>
                <button
                  onClick={() => navigate(`/lab?templateUrl=${encodeURIComponent(activeMeme.media_url)}&format=${activeMeme.format}&clearText=true`)}
                  className="flex-1 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-bold py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs flex items-center justify-center space-x-1.5 hover:bg-indigo-100 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /><span>Use as Template</span>
                </button>
              </div>

              {/* Ratings */}
              <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-xs font-semibold">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-800 mb-2">
                  <span className="uppercase tracking-wider text-gray-400 text-[10px]">Pedagogical Evaluation</span>
                  {(() => {
                    const avgs = ["age_appropriateness", "language_appropriateness", "content_validity", "creativity"].map(getAverageScore).filter((a) => a > 0);
                    const overall = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
                    return (
                      <span className="text-purple-650 font-bold text-xs bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded">
                        Avg: {overall > 0 ? `${overall.toFixed(1)}/5` : "—"}
                      </span>
                    );
                  })()}
                </div>
                {[
                  { label: "Age Appropriateness", key: "age_appropriateness" },
                  { label: "Language Appropriateness", key: "language_appropriateness" },
                  { label: "Content Validity", key: "content_validity" },
                  { label: "Creativity", key: "creativity" },
                ].map((crit) => {
                  const avg = getAverageScore(crit.key);
                  const myVal = userSubmittedRating?.[crit.key] || 0;
                  return (
                    <div key={crit.key} className="space-y-1 min-h-[70px]">
                      <div className="flex justify-between text-[11px]">
                        <span>{crit.label}</span>
                        <span className="text-purple-650 font-bold">
                          {avg > 0 ? `${avg.toFixed(1)}/5 (${getScoreCount(crit.key)} ${getScoreCount(crit.key) === 1 ? "rating" : "ratings"})` : "—/5"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${(avg / 5) * 100}%` }} />
                      </div>
                      {user && (
                        <div className="flex space-x-1.5 pt-0.5 justify-end h-5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRateSubmit(crit.key, star)}
                              className={`text-xs ${star <= myVal ? "text-yellow-500" : "text-gray-300"}`}
                            >★</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: expert reviews */}
            <div className="flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2">
                  <h3 className="font-extrabold text-sm uppercase tracking-wider">Verified Reviews</h3>
                  {expertComments.length > 0 && (
                    <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /><span>Verified</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-grow space-y-4 overflow-y-auto mb-6 max-h-[40vh] border border-gray-200 dark:border-zinc-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                {expertComments.length > 0 ? (() => {
                  const verified = expertComments.filter((c) => {
                    const commenter = userCache[c.user_id];
                    return commenter?.role === "expert" || commenter?.role === "admin" || commenter?.is_verified || c.user_id === "admin";
                  });
                  if (verified.length === 0) {
                    return <p className="text-center text-gray-400 dark:text-gray-500 text-xs py-8">No verified reviews yet.</p>;
                  }
                  return verified.map((comment) => {
                    const commenter = userCache[comment.user_id];
                    const commenterName = commenter?.name || "Verified Reviewer";
                    const isAuthor = user && (comment.user_id === user.uid || profile?.role === "admin" || profile?.role === "expert");
                    return (
                      <div key={comment.id} className="border-b border-gray-200 dark:border-gray-800 pb-3 last:border-b-0 text-xs text-left">
                        <div className="flex justify-between items-center text-gray-500 mb-1">
                          <span className="font-bold text-purple-700 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-purple-650" /> Verified Review ({commenterName})</span>
                          <div className="flex items-center space-x-2">
                            <span>{comment.timestamp?.seconds ? new Date(comment.timestamp.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                            {isAuthor && (
                              <button onClick={() => handleDeleteComment(comment.id)} className="text-red-500 hover:text-red-700 font-bold transition ml-2">Delete</button>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">{comment.body}</p>
                      </div>
                    );
                  });
                })() : (
                  <p className="text-center text-gray-400 dark:text-gray-500 text-xs py-8">No verified reviews logged yet.</p>
                )}
              </div>

              {user && profile && (profile.role === "expert" || profile.role === "admin" || profile.is_verified) ? (
                <form onSubmit={handleExpertCommentSubmit} className="space-y-3 border-t pt-4 text-left">
                  <span className="block text-xs font-semibold text-purple-700 uppercase flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-purple-650" /> Add Verification Review</span>
                  <textarea
                    placeholder="Write a verification review or academic comment…"
                    value={newExpertComment}
                    onChange={(e) => setNewExpertComment(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs rounded text-gray-800"
                    required
                  />
                  <button type="submit" className={btnClass}>Submit Verified Review</button>
                </form>
              ) : (
                <div className="border-t pt-4 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-gray-400" /> Comments are restricted to verified users and subject-matter experts.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subject tag CSS */}
      <style>{`
        .tag-subject-maths    { background: linear-gradient(135deg,#ec4899 0%,#f43f5e 100%) !important; color: white !important; border: none !important; }
        .tag-subject-biology  { background: linear-gradient(135deg,#10b981 0%,#059669 100%) !important; color: white !important; border: none !important; }
        .tag-subject-physics  { background: linear-gradient(135deg,#3b82f6 0%,#2563eb 100%) !important; color: white !important; border: none !important; }
        .tag-subject-chemistry{ background: linear-gradient(135deg,#f59e0b 0%,#d97706 100%) !important; color: white !important; border: none !important; }
        .tag-subject-history  { background: linear-gradient(135deg,#8b5cf6 0%,#7c3aed 100%) !important; color: white !important; border: none !important; }
        .tag-subject-geography{ background: linear-gradient(135deg,#14b8a6 0%,#0d9488 100%) !important; color: white !important; border: none !important; }
        .tag-subject-default  { background: linear-gradient(135deg,#a78bfa 0%,#8b5cf6 100%) !important; color: white !important; border: none !important; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default Staffroom;
