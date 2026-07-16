import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
  runTransaction
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";
import { useUserModal } from "../context/UserModalContext";
import { SUBJECTS, GRADE_GROUPS, RESOURCE_TYPES } from "../constants/taxonomy";

// ─── Constants ───────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 12;

const MOCK_FEATURED = [
  {
    id: "feat-1",
    title: "Humor-Based Cognition: Visual Memory Triggers in STEM",
    body: "This literature analysis reviews how visual humor constructs cognitive neural shortcuts, dramatically improving recall of complex physics formulas among middle school students.",
    type: "research_paper",
    subject: "Physics",
    grade_group: "High School (9–10)",
    author_id: "admin"
  },
  {
    id: "feat-2",
    title: "Classroom Activity: Mitosis Dance Battle Meme Sheets",
    body: "An active learning lesson plan where students construct memes depicting cell division phases, followed by peer-to-peer voting criteria matrices.",
    type: "activity",
    subject: "Biology",
    grade_group: "Middle School (6–8)",
    author_id: "admin"
  }
];

const trackCustomSubmission = async (type, name) => {
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
          }
        }
      }
    });
  } catch (err) {
    console.error("Error tracking custom submission", err);
  }
};


// ─── Toast Component ──────────────────────────────────────────────────────────
const Toast = ({ message, type = "info", onDismiss }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const colors = {
    info: "bg-indigo-600",
    success: "bg-green-600",
    warning: "bg-yellow-500 text-gray-900",
    error: "bg-red-600"
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl text-white text-sm font-medium max-w-sm animate-slideInUp ${colors[type]}`}>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100 font-bold text-lg leading-none">×</button>
    </div>
  );
};

// ─── Resource Detail Modal ─────────────────────────────────────────────────────
const ResourceDetailModal = ({ res, authorName, isLiked, isBookmarked, user, onLike, onBookmark, onClose, onViewLink }) => {
  if (!res) return null;
  const typeLabel = res.type ? res.type.replace(/_/g, " ") : "Resource";
  const isStory = res.type === "stories";

  // Local state for expand — lives in the modal instance
  const [storyExpanded, setStoryExpanded] = React.useState(false);

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
          isStory
            ? "bg-gradient-to-b from-amber-50 to-white dark:from-zinc-900 dark:to-zinc-950 border border-amber-200/40 dark:border-amber-700/30"
            : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {isStory ? (
          <div className="sticky top-0 bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-4 flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 pr-4">
              <span className="text-3xl flex-shrink-0">📖</span>
              <div>
                <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-1">
                  Meme Story
                </span>
                <h2 className="text-xl font-extrabold text-white leading-snug">{res.title}</h2>
                {res.meme_name && (
                  <span className="inline-flex items-center gap-1 bg-white/15 text-amber-100 text-xs font-semibold px-2 py-0.5 rounded-full mt-1">
                    🎭 {res.meme_name}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-2xl font-bold leading-none flex-shrink-0">×</button>
          </div>
        ) : (
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4 flex items-start justify-between">
            <div className="flex-1 pr-4">
              <span className="inline-block bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded mb-2 capitalize">
                {typeLabel}
              </span>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-snug">{res.title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl font-bold leading-none flex-shrink-0">×</button>
          </div>
        )}

        <div className="px-6 py-5 space-y-5">
          {/* Thumbnail */}
          {res.thumbnail_url && (
            <div className="w-full aspect-[16/9] rounded-xl overflow-hidden border border-gray-150 dark:border-gray-700">
              <img src={res.thumbnail_url} alt={res.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Author + Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-200">By {authorName}</span>
            {res.subject && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{res.subject}</span>}
            {res.grade_group && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{res.grade_group}</span>}
            <span>📅 {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "Unknown date"}</span>
            {res.view_count > 0 && <span>👁 {res.view_count} views</span>}
          </div>

          {/* Publication Info */}
          {(res.type === "article" || res.type === "research_paper") && (res.publication_year || res.publisher_name) && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-xl text-sm text-purple-800 dark:text-purple-300">
              📖 {res.publisher_name && <span className="font-semibold">{res.publisher_name}</span>}
              {res.publication_year && <span> ({res.publication_year})</span>}
            </div>
          )}

          {/* Story body — with Read Full Story expand for long content */}
          {isStory ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                <span>📜</span> Background
              </h4>
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {res.body && res.body.length > 400 && !storyExpanded ? (
                  <>
                    <p className="whitespace-pre-wrap">{res.body.slice(0, 400)}...</p>
                    <button
                      onClick={() => setStoryExpanded(true)}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline mt-2 text-xs"
                    >
                      Read Full Story ↓
                    </button>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap">{res.body}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{res.body}</div>
          )}

          {/* Typical Meaning & Usage (stories only) */}
          {isStory && res.usage_context && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-1">
                <span>💡</span> Typical Meaning & Usage
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{res.usage_context}</p>
            </div>
          )}

          {/* Keywords */}
          {res.keywords && res.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {res.keywords.map((k) => (
                <span key={k} className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">#{k}</span>
              ))}
            </div>
          )}

          {/* Admin Approval Badge */}
          {!res.admin_approved && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-xs text-yellow-700 dark:text-yellow-300 font-medium">
              ⏳ Pending Admin Approval — this resource is visible but awaiting review.
            </div>
          )}

          {/* Course embed */}
          {res.type === "course" && res.file_url && (
            <div className="w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-black">
              <iframe src={res.file_url} title={res.title} className="w-full h-full" allowFullScreen />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`sticky bottom-0 px-6 py-4 flex flex-wrap items-center gap-3 border-t ${
          isStory
            ? "bg-amber-50 dark:bg-zinc-900 border-amber-100 dark:border-zinc-800"
            : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
        }`}>
          {res.file_url && res.type !== "course" && (
            <a
              href={res.file_url}
              target="_blank"
              rel="noreferrer"
              onClick={onViewLink}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition flex items-center gap-2"
            >
              {res.file_url.includes("firebasestorage.googleapis.com") ? "📄 Open PDF ↗" : "🔗 Visit Website ↗"}
            </a>
          )}
          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={onLike}
              className={`flex items-center gap-1.5 text-sm font-semibold transition hover:scale-105 ${isLiked ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}
            >
              <span>{isLiked ? "❤️" : "🤍"}</span>
              <span>{res.likes_count || 0}</span>
            </button>
            <button
              onClick={onBookmark}
              className={`flex items-center gap-1.5 text-sm font-semibold transition ${isBookmarked ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:text-indigo-500"}`}
            >
              <span>{isBookmarked ? "🔖" : "📥"}</span>
              <span>{isBookmarked ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Flag Popup Component ─────────────────────────────────────────────────────
const FlagPopup = ({ onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-8 max-w-sm text-center space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl">🏳️</div>
        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Report Submitted</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Thank you for reporting. This content will only be removed upon admin review and approval.
          We appreciate your contribution to keeping the community safe.
        </p>
        <button
          onClick={onClose}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

// ─── Main Resources Component ─────────────────────────────────────────────────
const Resources = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state (reads from URL ?tab= for deep-linking from MoreResources redirect)
  const initialTab = searchParams.get("tab") || "all";
  const [activeTab, setActiveTab] = useState(initialTab);

  // ── Data
  const [resources, setResources] = useState([]);
  const [externalLinks, setExternalLinks] = useState([]);
  const userCacheRef = useRef({});
  const [displayCache, setDisplayCache] = useState({});

  // ── Hero Carousel
  const [featuredResources, setFeaturedResources] = useState(MOCK_FEATURED);
  const [featuredIndex, setFeaturedIndex] = useState(0);

  // ── Filters & Sort
  const [subjectFilter, setSubjectFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // ── Taxonomy (from Firestore, fallback to constants)
  const [subjects, setSubjects] = useState(SUBJECTS);
  const [gradeGroups, setGradeGroups] = useState(GRADE_GROUPS);
  const [filterSubjectSearch, setFilterSubjectSearch] = useState("");
  const [formSubjectSearch, setFormSubjectSearch] = useState("");

  // ── Interaction maps
  const [savedResourcesMap, setSavedResourcesMap] = useState({});
  const [savedResourceLikesMap, setSavedResourceLikesMap] = useState({});
  const [likePendingMap, setLikePendingMap] = useState({});
  const [userFlagsMap, setUserFlagsMap] = useState({}); // tracks resources user has already flagged

  // ── Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ── Modals & UI
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null); // null = create mode; resource obj = edit mode
  const [detailResource, setDetailResource] = useState(null);
  const [showFlagPopup, setShowFlagPopup] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadBody, setUploadBody] = useState("");
  const [uploadType, setUploadType] = useState("article");
  const [uploadSubject, setUploadSubject] = useState("Biology");
  const [uploadCustomSubject, setUploadCustomSubject] = useState("");
  const [uploadGrade, setUploadGrade] = useState("High School (9–10)");
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPublicationYear, setUploadPublicationYear] = useState("");
  const [uploadPublisherName, setUploadPublisherName] = useState("");
  const [uploadThumbnailUrl, setUploadThumbnailUrl] = useState("");
  const [uploadThumbnailFile, setUploadThumbnailFile] = useState(null);
  const [uploadKeywords, setUploadKeywords] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // Story-specific upload fields
  const [uploadUsageContext, setUploadUsageContext] = useState("");
  const [uploadEducationalUse, setUploadEducationalUse] = useState("");

  // ── External link form state (for "External" tab)
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [extTitle, setExtTitle] = useState("");
  const [extDescription, setExtDescription] = useState("");
  const [extImageUrl, setExtImageUrl] = useState("");
  const [extDestUrl, setExtDestUrl] = useState("");
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState("");

  // ── Helpers
  const getTitleLabel = () => {
    switch (uploadType) {
      case "stories":
        return "Template/Meme Name *";
      case "article":
        return "Article Title *";
      case "research_paper":
        return "Research Paper Title *";
      case "activity":
        return "Activity Name *";
      case "course":
        return "Course Title *";
      default:
        return "Resource Title *";
    }
  };

  const getTitlePlaceholder = () => {
    switch (uploadType) {
      case "stories":
        return "e.g. Winnie the Pooh Reading a Paper";
      case "article":
        return "e.g. Cognitive Recalls on Meme-based Biology";
      case "research_paper":
        return "e.g. Analysis of Meme Pedagogy in Classrooms";
      case "activity":
        return "e.g. Mitosis Meme Matching Game";
      case "course":
        return "e.g. Introduction to Memetics 101";
      default:
        return "e.g. Cognitive Recalls on Meme-based Biology";
    }
  };

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const resetUploadForm = () => {
    setUploadTitle(""); setUploadBody(""); setUploadUrl(""); setUploadFile(null);
    setUploadPublicationYear(""); setUploadPublisherName(""); setUploadThumbnailUrl("");
    setUploadThumbnailFile(null); setUploadKeywords(""); setUploadError("");
    setUploadSubject("Biology"); setUploadCustomSubject(""); setUploadGrade("High School (9–10)");
    setUploadType("article"); setEditingResource(null);
    setUploadUsageContext(""); setUploadEducationalUse("");
  };

  // ── URL tab sync
  useEffect(() => {
    if (activeTab !== "all") {
      setSearchParams({ tab: activeTab }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [activeTab, setSearchParams]);

  // Reset page on filter/tab change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, subjectFilter, gradeFilter, searchQuery, sortBy]);

  // ── 1. Load taxonomy from Firestore (with fallback)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configs", "taxonomy"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.subjects?.length) {
          const loadedSubs = data.subjects.includes("Other") ? data.subjects : [...data.subjects, "Other"];
          setSubjects(loadedSubs);
        }
        if (data.grades?.length) {
          const hasOldGrades = data.grades.some(g => ["10-12", "13-15", "16-18", "University"].includes(g));
          setGradeGroups(hasOldGrades ? GRADE_GROUPS : data.grades);
        }
      }
    });
    return () => unsub();
  }, []);

  // ── 2. Hero Carousel auto-advance
  useEffect(() => {
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % (featuredResources.length || 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [featuredResources.length]);

  // ── 3. Update featured resources from real data (top liked)
  useEffect(() => {
    if (resources.length > 0) {
      const sortedByLikes = [...resources]
        .filter((r) => (r.likes_count || 0) > 0)
        .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
      if (sortedByLikes.length > 0) {
        setFeaturedResources(sortedByLikes.slice(0, 3).map((r) => ({
          id: r.id, title: r.title, body: r.body, type: r.type,
          subject: r.subject, grade_group: r.grade_group, author_id: r.author_id
        })));
      } else {
        setFeaturedResources(MOCK_FEATURED);
      }
    } else {
      setFeaturedResources(MOCK_FEATURED);
    }
  }, [resources]);

  // ── 4. Real-time resources listener (ALL resources — approved + unapproved — shown with badges)
  useEffect(() => {
    const resCol = collection(db, "resources");
    // We load all non-hidden resources. Resources are hidden only when admin explicitly hides them.
    const q = query(resCol, where("status", "!=", "hidden_moderation"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list = [];
      const newAuthorIds = new Set();

      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        list.push(data);
        if (data.author_id && data.author_id !== "admin") {
          newAuthorIds.add(data.author_id);
        }
      });

      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setResources(list);

      // Resolve author usernames (using ref to avoid re-triggering this effect)
      const toFetch = [...newAuthorIds].filter((id) => !userCacheRef.current[id]);
      if (toFetch.length > 0) {
        const fetched = {};
        await Promise.all(
          toFetch.map(async (authorId) => {
            try {
              const userDoc = await getDoc(doc(db, "users", authorId));
              if (userDoc.exists()) {
                fetched[authorId] = userDoc.data().name;
              }
            } catch (e) {
              console.error("Username query failed", e);
            }
          })
        );
        if (Object.keys(fetched).length > 0) {
          userCacheRef.current = { ...userCacheRef.current, ...fetched };
          setDisplayCache((prev) => ({ ...prev, ...fetched }));
        }
      }
    });

    return () => unsubscribe();
  }, []); // No dependency on userCache — use ref to avoid infinite loop

  // ── 5. Real-time external links listener (loaded once, used when tab=external)
  useEffect(() => {
    const collRef = collection(db, "external_links");
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const results = [];
      snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }));
      results.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setExternalLinks(results);
    });
    return () => unsubscribe();
  }, []);

  // ── 6. Real-time likes listener (user-specific)
  useEffect(() => {
    if (!user) { setSavedResourceLikesMap({}); return; }
    const q = query(collection(db, "resource_likes"), where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((d) => { map[d.data().resource_id] = d.id; });
      setSavedResourceLikesMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // ── 7. Real-time bookmarks listener (user-specific, resources only)
  useEffect(() => {
    if (!user) { setSavedResourcesMap({}); return; }
    const q = query(
      collection(db, "saves"),
      where("user_id", "==", user.uid),
      where("content_type", "==", "resource")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((d) => {
        const data = d.data();
        map[data.resource_id] = d.id; // key by resource_id
      });
      setSavedResourcesMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // ── 8. Load user's prior flags (to prevent double-flagging)
  useEffect(() => {
    if (!user) { setUserFlagsMap({}); return; }
    const q = query(
      collection(db, "flags"),
      where("reporter_id", "==", user.uid),
      where("content_type", "==", "resource")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const map = {};
      snapshot.forEach((d) => { map[d.data().content_id] = true; });
      setUserFlagsMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // ─── Filtering + Sorting + Pagination ────────────────────────────────────────
  const filteredResources = React.useMemo(() => {
    let result = [...resources];

    // Tab filter
    if (activeTab === "saved") {
      result = result.filter((r) => !!savedResourcesMap[r.id]);
    } else if (activeTab === "mine") {
      result = result.filter((r) => r.author_id === user?.uid);
    } else if (activeTab === "article_paper") {
      result = result.filter((r) => r.type === "article" || r.type === "research_paper");
    } else if (activeTab !== "all" && activeTab !== "external") {
      result = result.filter((r) => r.type === activeTab);
    }

    // Subject filter
    if (subjectFilter) result = result.filter((r) => r.subject === subjectFilter);
    // Grade filter
    if (gradeFilter) result = result.filter((r) => r.grade_group === gradeFilter);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        return (
          r.title?.toLowerCase().includes(q) ||
          r.body?.toLowerCase().includes(q) ||
          r.subject?.toLowerCase().includes(q) ||
          r.publisher_name?.toLowerCase().includes(q) ||
          r.type?.toLowerCase().includes(q) ||
          (Array.isArray(r.keywords)
            ? r.keywords.some((k) => k.toLowerCase().includes(q))
            : String(r.keywords || "").toLowerCase().includes(q))
        );
      });
    }

    // Sort
    if (sortBy === "most_liked") {
      result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else if (sortBy === "most_viewed") {
      result.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    } else if (sortBy === "oldest") {
      result.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
    } else {
      // newest (default)
      result.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
    }

    return result;
  }, [resources, activeTab, subjectFilter, gradeFilter, searchQuery, sortBy, savedResourcesMap, user]);

  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Top viewed resources for "Suggested Reads"
  const suggestedResources = React.useMemo(() => {
    const featuredIds = new Set(featuredResources.map((f) => f.id));
    return [...resources]
      .filter((r) => !featuredIds.has(r.id) && (r.view_count || 0) > 0)
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 3);
  }, [resources, featuredResources]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleBookmarkToggle = async (resourceId) => {
    if (!user) { showToast("Please sign in to save resources.", "warning"); return; }
    const existingId = savedResourcesMap[resourceId];
    try {
      if (existingId) {
        await deleteDoc(doc(db, "saves", existingId));
      } else {
        const saveDocId = `${user.uid}_res_${resourceId}`;
        await setDoc(doc(db, "saves", saveDocId), {
          user_id: user.uid,
          resource_id: resourceId,
          content_type: "resource",
          created_at: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Bookmark toggle failed", e);
    }
  };

  const handleFlagResource = async (resourceId) => {
    if (!user) { showToast("Please sign in to report content.", "warning"); return; }
    if (userFlagsMap[resourceId]) {
      showToast("You have already reported this resource.", "info"); return;
    }
    try {
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: "resource",
        content_id: resourceId,
        reason: "Resource flagged by user",
        status: "pending",
        created_at: serverTimestamp()
      });
      // Increment flag_count on the resource — do NOT hide it
      const resDocRef = doc(db, "resources", resourceId);
      await updateDoc(resDocRef, { flag_count: increment(1) });
      setShowFlagPopup(true);
    } catch (e) {
      console.error("Flag resource failed", e);
      showToast("Failed to submit report. Please try again.", "error");
    }
  };

  const handleResourceLikeToggle = async (resourceId, authorId) => {
    if (!user) { showToast("Please sign in to like resources.", "warning"); return; }
    if (likePendingMap[resourceId]) return;
    setLikePendingMap((prev) => ({ ...prev, [resourceId]: true }));
    const existingLikeId = savedResourceLikesMap[resourceId];
    const resourceRef = doc(db, "resources", resourceId);
    const statsRef = doc(db, "user_stats", authorId);
    try {
      if (existingLikeId) {
        await deleteDoc(doc(db, "resource_likes", existingLikeId));
        await updateDoc(resourceRef, { likes_count: increment(-1) });
        if (authorId && authorId !== "admin") {
          await setDoc(statsRef, { total_likes_received: increment(-1) }, { merge: true });
        }
      } else {
        const likeDocId = `${user.uid}_${resourceId}`;
        await setDoc(doc(db, "resource_likes", likeDocId), {
          user_id: user.uid, resource_id: resourceId, created_at: serverTimestamp()
        });
        await updateDoc(resourceRef, { likes_count: increment(1) });
        if (authorId && authorId !== "admin") {
          await setDoc(statsRef, { total_likes_received: increment(1) }, { merge: true });
        }
      }
    } catch (e) {
      console.error("Resource like toggle failed", e);
    } finally {
      setLikePendingMap((prev) => ({ ...prev, [resourceId]: false }));
    }
  };

  const handleIncrementViewCount = async (resourceId) => {
    try {
      await updateDoc(doc(db, "resources", resourceId), { view_count: increment(1) });
    } catch (e) {
      // Silent fail — view count is analytics, not critical
    }
  };

  const handleDeleteResource = async (resId) => {
    if (!window.confirm("Are you sure you want to delete this resource? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "resources", resId));
      if (user) {
        await updateDoc(doc(db, "user_stats", user.uid), {
          resources_contributed_count: increment(-1)
        }).catch(() => {});
      }
      showToast("Resource deleted successfully.", "success");
    } catch (e) {
      console.error("Failed to delete resource", e);
      showToast("Failed to delete resource. Please try again.", "error");
    }
  };

  const handleOpenEditModal = (res) => {
    setEditingResource(res);
    setUploadTitle(res.title || res.meme_name || "");
    setUploadBody(res.body || "");
    setUploadType(res.type || "article");
    setUploadSubject(subjects.includes(res.subject) ? res.subject : "Other");
    setUploadCustomSubject(subjects.includes(res.subject) ? "" : (res.subject || ""));
    setUploadGrade(res.grade_group || "High School (9–10)");
    setUploadUrl(res.file_url || "");
    setUploadPublicationYear(res.publication_year || "");
    setUploadPublisherName(res.publisher_name || "");
    setUploadThumbnailUrl(res.thumbnail_url || "");
    setUploadFile(null);
    setUploadThumbnailFile(null);
    setUploadKeywords(Array.isArray(res.keywords) ? res.keywords.join(", ") : (res.keywords || ""));
    setUploadUsageContext(res.usage_context || "");
    setUploadEducationalUse(res.educational_use || "");
    setUploadError("");
    setShowUploadModal(true);
  };

  const handleResourceSubmit = async (e) => {
    e.preventDefault();
    if (!user) { showToast("Please sign in to contribute resources.", "warning"); return; }
    setUploadLoading(true);
    setUploadError("");

    const finalSubject = uploadSubject === "Other" ? uploadCustomSubject.trim() : uploadSubject;
    if (uploadType !== "stories" && !finalSubject) { setUploadError("Please specify a subject."); setUploadLoading(false); return; }

    let fileUrl = editingResource ? (editingResource.file_url || "") : uploadUrl;
    if (!editingResource) fileUrl = uploadUrl;
    let thumbnailUrl = editingResource ? (editingResource.thumbnail_url || "") : "";

    try {
      if (uploadFile) {
        const storageRef = ref(storage, `resources/${user.uid}_res_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, uploadFile);
        fileUrl = await getDownloadURL(snapshot.ref);
      }
      if (uploadThumbnailFile) {
        const thumbRef = ref(storage, `resources/thumb_${user.uid}_${Date.now()}`);
        const snapshot = await uploadBytes(thumbRef, uploadThumbnailFile);
        thumbnailUrl = await getDownloadURL(snapshot.ref);
      } else if (!thumbnailUrl && uploadFile && uploadFile.type.startsWith("image/")) {
        // Auto-use the uploaded image as thumbnail if no separate thumbnail provided
        thumbnailUrl = fileUrl;
      }

      const parsedKeywords = uploadKeywords
        ? uploadKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
        : [];

      if (editingResource) {
        // ── EDIT MODE
        const wasApproved = editingResource.admin_approved === true;
        const isAdmin = profile?.role === "admin";

        const finalSubject = uploadType === "stories" ? "" : (uploadSubject === "Other" ? uploadCustomSubject.trim() : uploadSubject);
        const finalGrade = uploadType === "stories" ? "" : uploadGrade;

        const updatedData = {
          title: uploadTitle.trim(),
          body: uploadBody,
          type: uploadType,
          subject: finalSubject,
          grade_group: finalGrade,
          file_url: fileUrl || editingResource.file_url || "",
          thumbnail_url: thumbnailUrl || editingResource.thumbnail_url || "",
          keywords: parsedKeywords,
          updated_at: serverTimestamp()
        };
        if (uploadType === "article" || uploadType === "research_paper") {
          updatedData.publication_year = uploadPublicationYear;
          updatedData.publisher_name = uploadPublisherName;
        }
        if (uploadType === "stories") {
          updatedData.meme_name = uploadTitle.trim();
          updatedData.usage_context = uploadUsageContext.trim();
          updatedData.educational_use = uploadEducationalUse.trim();
        }

        await updateDoc(doc(db, "resources", editingResource.id), updatedData);
        showToast(wasApproved && !isAdmin
          ? "Resource updated! It will be re-reviewed by admin before approval badge is removed."
          : "Resource updated successfully.",
          "success"
        );
      } else {
        // ── CREATE MODE — go live immediately, pending admin approval badge
        const resColRef = collection(db, "resources");
        const statsDocRef = doc(db, "user_stats", user.uid);

        await runTransaction(db, async (transaction) => {
          const newDocRef = doc(resColRef);
          const resourceData = {
            title: uploadTitle.trim(),
            body: uploadBody,
            type: uploadType,
            subject: uploadType === "stories" ? "" : finalSubject,
            grade_group: uploadType === "stories" ? "" : uploadGrade,
            file_url: fileUrl,
            thumbnail_url: thumbnailUrl,
            keywords: parsedKeywords,
            likes_count: 0,
            flag_count: 0,
            view_count: 0,
            author_id: user.uid,
            status: "live",
            admin_approved: false,
            created_at: serverTimestamp()
          };
          if (uploadType === "article" || uploadType === "research_paper") {
            resourceData.publication_year = uploadPublicationYear;
            resourceData.publisher_name = uploadPublisherName;
          }
          if (uploadType === "stories") {
            resourceData.meme_name = uploadTitle.trim();
            resourceData.usage_context = uploadUsageContext.trim();
            resourceData.educational_use = uploadEducationalUse.trim();
          }
          transaction.set(newDocRef, resourceData);
          // Try updating stats; ignore if doc doesn't exist yet
          const statsSnap = await transaction.get(statsDocRef);
          if (statsSnap.exists()) {
            transaction.update(statsDocRef, { resources_contributed_count: increment(1) });
          } else {
            transaction.set(statsDocRef, { resources_contributed_count: 1 }, { merge: true });
          }
        });
        showToast("Resource published! It's live and pending admin review.", "success");
      }

      if (uploadSubject === "Other" && uploadCustomSubject.trim()) {
        trackCustomSubmission("subject", uploadCustomSubject.trim());
      }

      setShowUploadModal(false);
      resetUploadForm();
    } catch (err) {
      console.error(err);
      setUploadError("Submission failed. Please check your connection and try again.");
    } finally {
      setUploadLoading(false);
    }
  };

  // External link submit
  const handleExternalSubmit = async (e) => {
    e.preventDefault();
    if (!user) { showToast("Please sign in to contribute.", "warning"); return; }
    if (!extTitle || !extDescription || !extDestUrl) {
      setExtError("Please fill out all required fields."); return;
    }
    setExtLoading(true); setExtError("");
    try {
      await addDoc(collection(db, "external_links"), {
        title: extTitle,
        description: extDescription,
        image_url: extImageUrl || "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80",
        destination_url: extDestUrl,
        contributor_id: user.uid,
        admin_approved: false,
        created_at: serverTimestamp()
      });
      setShowExternalModal(false);
      setExtTitle(""); setExtDescription(""); setExtImageUrl(""); setExtDestUrl("");
      showToast("External resource added! Pending admin review.", "success");
    } catch (err) {
      console.error(err); setExtError("Failed to add resource. Try again.");
    } finally {
      setExtLoading(false);
    }
  };

  const handleDeleteExternalLink = async (linkId) => {
    if (!window.confirm("Delete this external link? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "external_links", linkId));
      showToast("External link deleted.", "success");
    } catch (e) {
      showToast("Failed to delete.", "error");
    }
  };

  const handleShareResource = (resId) => {
    const url = `${window.location.origin}/resources?id=${resId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast("Link copied to clipboard! 🔗", "success");
    }).catch(() => {
      showToast("Could not copy link.", "error");
    });
  };

  // ─── UDL Styling ──────────────────────────────────────────────────────────────
  const containerClass = highContrastMode
    ? "bg-zinc-900 border border-zinc-800 text-white shadow-sm rounded-xl"
    : "bg-white border border-gray-200 shadow-sm rounded-xl";

  const btnClass = "bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-xs text-gray-800";

  const activeFeat = featuredResources[featuredIndex] || MOCK_FEATURED[0];
  const isAdmin = profile?.role === "admin";

  // ─── Tab config ───────────────────────────────────────────────────────────────
  const tabs = [
    { id: "all", label: "All Resources" },
    { id: "article_paper", label: "Articles & Papers" },
    { id: "activity", label: "Activities" },
    { id: "course", label: "Courses" },
    { id: "stories", label: "Meme Stories" },
    { id: "other", label: "Other Tools" },
    { id: "external", label: "🌐 External Platforms" },
    ...(user ? [
      { id: "saved", label: "📥 My Saved" },
      { id: "mine", label: "📤 My Uploads" }
    ] : [])
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Flag Popup */}
      {showFlagPopup && <FlagPopup onClose={() => setShowFlagPopup(false)} />}

      {/* Resource Detail Modal */}
      {detailResource && (
        <ResourceDetailModal
          res={detailResource}
          authorName={detailResource.author_id === "admin" ? "Admin" : (displayCache[detailResource.author_id] || "Contributor")}
          isLiked={!!savedResourceLikesMap[detailResource.id]}
          isBookmarked={!!savedResourcesMap[detailResource.id]}
          user={user}
          onLike={() => handleResourceLikeToggle(detailResource.id, detailResource.author_id)}
          onBookmark={() => handleBookmarkToggle(detailResource.id)}
          onViewLink={() => handleIncrementViewCount(detailResource.id)}
          onClose={() => setDetailResource(null)}
        />
      )}

      {/* ── Page Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {activeTab === "external" ? "Open Education Resources" : "Meme Resources"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "external"
              ? "Curated external OER platforms, pedagogical tools, and teaching resources."
              : "Access curriculum activities, lesson cards, research papers, and stories. No login needed to browse."}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          {activeTab === "external" ? (
            user && (
              <button onClick={() => setShowExternalModal(true)} className={btnClass}>
                ➕ Add External Link
              </button>
            )
          ) : (
            user && (
              <button onClick={() => { resetUploadForm(); setShowUploadModal(true); }} className={btnClass}>
                ➕ Contribute Resource
              </button>
            )
          )}
          {!user && (
            <a href="/auth" className={btnClass}>
              Sign in to Contribute
            </a>
          )}
        </div>
      </div>

      {/* ── Hero Featured Carousel ────────────────────────────────────────────── */}
      {activeTab !== "external" && activeTab !== "saved" && activeTab !== "mine" && (
        <div className={`p-6 rounded-xl border relative overflow-hidden flex flex-col justify-between min-h-[220px] ${
          highContrastMode
            ? "bg-black border-yellow-400 text-yellow-400"
            : "bg-gradient-to-r from-purple-900 via-indigo-900 to-indigo-950 text-white border-transparent"
        }`}>
          {/* Dynamic type badge */}
          <div className="absolute top-4 right-4 bg-purple-500/20 text-purple-300 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-purple-500/30 capitalize">
            {activeFeat.type ? activeFeat.type.replace(/_/g, " ") : "Featured"}
          </div>

          <div className="max-w-2xl">
            <span className="text-[10px] font-extrabold uppercase bg-purple-600/50 px-2 py-0.5 rounded tracking-wide">
              {activeFeat.subject} • {activeFeat.grade_group}
            </span>
            <h2 className="text-2xl font-extrabold mt-3 leading-tight tracking-tight">
              {activeFeat.title}
            </h2>
            <p className="text-sm mt-2 opacity-85 line-clamp-2 leading-relaxed">
              {activeFeat.body}
            </p>
          </div>

          <div className="flex items-center justify-between pt-6">
            <div className="flex space-x-1.5">
              {featuredResources.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setFeaturedIndex(idx)}
                  className={`h-1.5 rounded-full transition-all ${featuredIndex === idx ? "w-6 bg-purple-500" : "w-2 bg-gray-400/50"}`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                const found = resources.find((r) => r.id === activeFeat.id);
                if (found) { setDetailResource(found); handleIncrementViewCount(found.id); }
              }}
              className="text-xs font-bold text-purple-300 hover:text-white transition underline underline-offset-2"
            >
              View Resource →
            </button>
          </div>
        </div>
      )}

      {/* ── Category Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === tab.id
                ? "bg-purple-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-850"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── EXTERNAL RESOURCES TAB ────────────────────────────────────────────── */}
      {activeTab === "external" ? (
        <div>
          {externalLinks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {externalLinks.map((link) => {
                const contributorName = displayCache[link.contributor_id] || "Contributor";
                return (
                  <div key={link.id} className={`${containerClass} p-5 flex flex-col justify-between`}>
                    <div>
                      {!link.admin_approved && (
                        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-2 py-1 rounded-lg">
                          ⏳ Pending Admin Approval
                        </div>
                      )}
                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-4 border border-gray-200 dark:border-gray-700 bg-gray-100">
                        <img
                          src={link.image_url}
                          alt={link.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&w=400&q=80"; }}
                        />
                      </div>
                      <h3 className="font-extrabold text-sm mb-1.5 line-clamp-1">{link.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed">{link.description}</p>
                    </div>
                    <div className="space-y-3">
                      <a
                        href={link.destination_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full py-2.5 rounded-lg text-xs text-center block transition"
                      >
                        Visit Resource ↗
                      </a>
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[10px] text-gray-400 font-semibold">
                        <span>Added: {link.created_at ? new Date(link.created_at.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                        <div className="flex items-center gap-2">
                          {user && (link.contributor_id === user.uid || isAdmin) && (
                            <button
                              onClick={() => handleDeleteExternalLink(link.id)}
                              className="text-red-500 hover:text-red-700 font-bold transition"
                            >
                              Delete
                            </button>
                          )}
                          <button
                            onClick={() => { if (link.contributor_id) openUserModal(link.contributor_id); }}
                            className="text-purple-600 hover:underline capitalize"
                          >
                            By {contributorName}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${containerClass} p-12 text-center text-gray-500`}>
              <p className="text-2xl mb-3">🌐</p>
              <p className="text-sm font-medium mb-2">No external resources yet.</p>
              {user
                ? <button onClick={() => setShowExternalModal(true)} className={`${btnClass} mx-auto`}>Be the first to add one →</button>
                : <a href="/auth" className="text-purple-600 text-xs font-bold hover:underline">Sign in to contribute →</a>
              }
            </div>
          )}
        </div>
      ) : (
        /* ── MAIN RESOURCES GRID ───────────────────────────────────────────── */
        <div>
          {/* Search + Sort bar */}
          <div className={`p-4 ${containerClass} flex flex-wrap items-center gap-3 mb-6`}>
            <div className="relative flex-grow min-w-0">
              <span className="absolute left-3.5 top-2.5 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search by title, keywords, subject, publisher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-10 h-10 rounded-xl`}
              />
            </div>
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-xs font-bold text-red-500 hover:underline px-2 flex-shrink-0">
                Clear
              </button>
            )}
            {/* Sort control */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`${inputClass} w-auto flex-shrink-0 rounded-lg px-3 py-2 h-10`}
              title="Sort resources"
            >
              <option value="newest">Newest</option>
              <option value="most_liked">Most Liked</option>
              <option value="most_viewed">Most Viewed</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Filters */}
            <div className={`p-6 h-fit ${containerClass}`}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4 border-b pb-2">Filters</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="🔍 Search subject..."
                    value={filterSubjectSearch}
                    onChange={(e) => setFilterSubjectSearch(e.target.value)}
                    className="w-full px-2.5 py-1 mb-1.5 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs"
                  />
                  <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={inputClass}>
                    <option value="">All Subjects</option>
                    {subjects
                      .filter((s) => s.toLowerCase().includes(filterSubjectSearch.toLowerCase()))
                      .map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">Grade Group</label>
                  <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className={inputClass}>
                    <option value="">All Grades</option>
                    {gradeGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                {(subjectFilter || gradeFilter) && (
                  <button
                    onClick={() => { setSubjectFilter(""); setGradeFilter(""); }}
                    className="text-xs text-red-500 hover:underline font-bold"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Resources Grid */}
            <div className="lg:col-span-3">
              {paginatedResources.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {paginatedResources.map((res) => {
                      const isBookmarked = !!savedResourcesMap[res.id];
                      const isLiked = !!savedResourceLikesMap[res.id];
                      const authorName = res.author_id === "admin" ? "Admin" : (displayCache[res.author_id] || "Contributor");
                      const canEdit = user && res.author_id === user.uid;
                      const canDelete = user && (res.author_id === user.uid || isAdmin);
                      const alreadyFlagged = !!userFlagsMap[res.id];

                      return (
                        <div 
                          key={res.id} 
                          className={`p-5 flex flex-col justify-between h-full ${
                            res.type === "stories"
                              ? "bg-gradient-to-b from-amber-50 to-white dark:from-zinc-900 dark:to-zinc-950 border border-amber-200 dark:border-amber-800/40 shadow-sm rounded-xl"
                              : containerClass
                          }`}
                        >
                          <div>
                            {/* Pending Admin Approval Badge */}
                            {!res.admin_approved && (
                              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-2 py-1 rounded-lg">
                                ⏳ Pending Admin Approval
                              </div>
                            )}

                            {/* Author header */}
                            <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-zinc-800 pb-3">
                              <div className="flex items-center min-w-0">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs mr-2.5 shadow-sm flex-shrink-0 ${
                                  res.type === "stories"
                                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                                    : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                                }`}>
                                  {res.type === "stories" ? "📖" : (authorName ? authorName.charAt(0).toUpperCase() : "C")}
                                </div>
                                <div className="flex-grow min-w-0">
                                  <button
                                    onClick={() => { if (res.author_id !== "admin") openUserModal(res.author_id); }}
                                    className="text-xs font-bold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition text-left block leading-tight truncate"
                                  >
                                    {authorName}
                                  </button>
                                  <span className="text-[9px] text-gray-400 block leading-tight mt-0.5">Contributor</span>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ml-2 ${
                                res.type === "stories"
                                  ? "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                                  : "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300"
                              }`}>
                                {res.type === "stories" ? "📜 Meme Story" : (res.type?.replace(/_/g, " ") || "resource")}
                              </span>
                            </div>

                            {/* Thumbnail */}
                            {res.thumbnail_url && (
                              <div className="w-full aspect-[16/9] mb-3 rounded-lg overflow-hidden border border-gray-150 dark:border-zinc-800 bg-gray-50">
                                <img src={res.thumbnail_url} alt={res.title} className="w-full h-full object-cover" />
                              </div>
                            )}

                            {/* Title */}
                            <button
                              onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                              className="font-extrabold text-sm mb-2 text-left hover:text-purple-600 dark:hover:text-purple-400 transition block w-full text-gray-900 dark:text-white"
                            >
                              {res.title}
                            </button>

                            <p className="text-xs text-gray-500 mb-3 line-clamp-3 leading-relaxed">{res.body}</p>

                            {/* Story-specific: meme name badge + usage context */}
                            {res.type === "stories" && (
                              <>
                                {res.meme_name && (
                                  <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full mb-2 border border-amber-200 dark:border-amber-700/50">
                                    🎭 {res.meme_name}
                                  </span>
                                )}
                              </>
                            )}

                            {/* Keywords */}
                            {res.keywords && res.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {res.keywords.map((k) => (
                                  <button
                                    key={k}
                                    onClick={() => setSearchQuery(k)}
                                    className="bg-gray-100 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 text-[9px] px-1.5 py-0.5 rounded hover:bg-purple-100 hover:text-purple-700 transition"
                                  >
                                    #{k}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Publication info for articles */}
                            {(res.type === "article" || res.type === "research_paper") && (res.publication_year || res.publisher_name) && (
                              <div className="mb-3 p-2 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/50 rounded-lg text-[10px] text-purple-900 dark:text-purple-300 flex items-center space-x-1.5">
                                <span>📖</span>
                                <span className="font-semibold">
                                  {res.publisher_name}{res.publication_year && ` (${res.publication_year})`}
                                </span>
                              </div>
                            )}

                            {/* Course embed */}
                            {res.type === "course" && res.file_url && (
                              <div className="w-full aspect-video rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-black mb-3">
                                <iframe src={res.file_url} title={res.title} className="w-full h-full" allowFullScreen />
                              </div>
                            )}
                          </div>

                          {/* Card Footer */}
                          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col space-y-2 text-xs font-semibold">
                            <div className="flex items-center justify-between text-gray-400 text-[10px] pb-1">
                              <div className="flex items-center gap-2">
                                <span>📅 {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                                {(res.view_count || 0) > 0 && <span>👁 {res.view_count}</span>}
                              </div>
                              {res.file_url && res.type !== "course" && (
                                <a
                                  href={res.file_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => handleIncrementViewCount(res.id)}
                                  className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-[10px] font-bold px-2.5 py-1 rounded-full transition flex items-center"
                                >
                                  {res.file_url.includes("firebasestorage.googleapis.com") ? "📄 Open PDF ↗" : "🔗 Visit ↗"}
                                </a>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <div className="flex flex-wrap gap-3">
                                {/* Like */}
                                <button
                                  onClick={() => handleResourceLikeToggle(res.id, res.author_id)}
                                  className={`flex items-center gap-1 transition hover:scale-105 active:scale-95 ${isLiked ? "text-red-500 font-bold" : "text-gray-400 hover:text-gray-500"}`}
                                  title="Like"
                                >
                                  <span>{isLiked ? "❤️" : "🤍"}</span>
                                  <span>{res.likes_count || 0}</span>
                                </button>

                                {/* Bookmark */}
                                <button
                                  onClick={() => handleBookmarkToggle(res.id)}
                                  className={`flex items-center gap-1 ${isBookmarked ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:text-gray-500"}`}
                                  title="Save to My Bookmarks"
                                >
                                  <span>{isBookmarked ? "🔖" : "📥"}</span>
                                  <span>{isBookmarked ? "Saved" : "Save"}</span>
                                </button>

                                {/* Flag — shows count */}
                                <button
                                  onClick={() => handleFlagResource(res.id)}
                                  className={`flex items-center gap-1 transition ${alreadyFlagged ? "text-orange-500" : "text-gray-400 hover:text-red-500"}`}
                                  title={alreadyFlagged ? "Already reported" : "Report resource"}
                                >
                                  <span>🏳️</span>
                                  {(res.flag_count || 0) > 0 && <span className="text-[9px]">{res.flag_count}</span>}
                                </button>

                                {/* Share */}
                                <button
                                  onClick={() => handleShareResource(res.id)}
                                  className="text-gray-400 hover:text-indigo-500 transition"
                                  title="Copy link"
                                >
                                  🔗
                                </button>
                              </div>

                              {/* Edit / Delete */}
                              <div className="flex gap-2">
                                {canEdit && (
                                  <button
                                    onClick={() => handleOpenEditModal(res)}
                                    className="text-gray-400 hover:text-blue-500 flex items-center gap-1 transition"
                                    title="Edit Resource"
                                  >
                                    <span>✏️</span>
                                    <span className="text-[10px]">Edit</span>
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteResource(res.id)}
                                    className="text-gray-400 hover:text-red-500 flex items-center gap-1 transition"
                                    title="Delete Resource"
                                  >
                                    <span>🗑️</span>
                                    <span className="text-[10px]">Delete</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Read More button */}
                            <button
                              onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                              className="w-full text-center text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline mt-1"
                            >
                              Read More →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition"
                      >
                        ← Previous
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 text-xs font-bold rounded-lg transition ${
                            p === currentPage
                              ? "bg-purple-600 text-white"
                              : "border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition"
                      >
                        Next →
                      </button>
                    </div>
                  )}

                  {/* Suggested Reads */}
                  {suggestedResources.length > 0 && currentPage === 1 && (
                    <div className="mt-10">
                      <h3 className="text-sm font-extrabold uppercase tracking-wider mb-4 text-gray-500 dark:text-gray-400">
                        📚 Suggested Reads — Most Viewed
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {suggestedResources.map((res) => (
                          <button
                            key={res.id}
                            onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                            className={`p-4 text-left ${containerClass} hover:border-purple-300 dark:hover:border-purple-700 transition`}
                          >
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 capitalize">{res.type?.replace(/_/g, " ")}</span>
                            <p className="font-bold text-xs mt-1 line-clamp-2">{res.title}</p>
                            <p className="text-[10px] text-gray-400 mt-1">👁 {res.view_count || 0} views · ❤️ {res.likes_count || 0}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className={`${containerClass} p-12 text-center`}>
                  <p className="text-2xl mb-3">📂</p>
                  <p className="text-sm font-medium text-gray-500 mb-4">No resources match your current filters.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {(subjectFilter || gradeFilter || searchQuery) && (
                      <button
                        onClick={() => { setSubjectFilter(""); setGradeFilter(""); setSearchQuery(""); }}
                        className={btnClass}
                      >
                        Clear All Filters
                      </button>
                    )}
                    {user && (
                      <button onClick={() => { resetUploadForm(); setShowUploadModal(true); }} className="border border-purple-600 text-purple-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-purple-50 transition">
                        Be the first to contribute →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONTRIBUTE RESOURCE MODAL ─────────────────────────────────────────── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-1">{editingResource ? "Edit Resource" : "Contribute Resource"}</h2>
            <p className="text-xs text-gray-500 mb-5">
              {editingResource
                ? editingResource.admin_approved
                  ? "Editing an approved resource will re-enter it into the admin review queue."
                  : "You can freely edit this resource before admin approval."
                : "Your resource will go live immediately. A 'Pending Admin Approval' badge will show until an admin reviews it."}
            </p>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 text-red-600 rounded text-xs">{uploadError}</div>
            )}

            <form onSubmit={handleResourceSubmit} className="space-y-4 text-xs font-semibold">
              {/* Type moved above title */}
              <div>
                <label className="block text-gray-500 uppercase mb-1">Category Type</label>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)} className={inputClass}>
                  {RESOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">{getTitleLabel()}</label>
                <input type="text" placeholder={getTitlePlaceholder()} value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)} className={inputClass} required />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">
                  {uploadType === "stories" ? "Background *" : "Description / Abstract *"}
                </label>
                <textarea
                  placeholder={uploadType === "stories"
                    ? "Where did this template originate? Mention the source (movie, TV show, game, etc.) and how it became popular."
                    : "Provide a detailed description of the resource..."}
                  value={uploadBody}
                  onChange={(e) => setUploadBody(e.target.value)} rows="3"
                  className={`${inputClass} resize-none`} required />
              </div>

              {/* Stories-specific fields */}
              {uploadType === "stories" && (
                <>
                  <div>
                    <label className="block text-gray-500 uppercase mb-1">Typical Meaning & Usage</label>
                    <textarea
                      placeholder="Used to express confusion while reading something complicated or reacting to unexpected information."
                      value={uploadUsageContext || ""}
                      onChange={(e) => setUploadUsageContext(e.target.value)}
                      rows="2"
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-500 uppercase mb-1">Educational Use</label>
                    <textarea
                      placeholder="Suggest classroom situations where this template can be used. E.g. Assignment instructions"
                      value={uploadEducationalUse || ""}
                      onChange={(e) => setUploadEducationalUse(e.target.value)}
                      rows="2"
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </>
              )}

              {/* Subject + Grade — hidden for stories */}
              {uploadType !== "stories" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Subject</label>
                      <input
                        type="text"
                        placeholder="Search subject..."
                        value={formSubjectSearch}
                        onChange={(e) => setFormSubjectSearch(e.target.value)}
                        className="w-full px-2 py-1 mb-1 border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded text-[10px]"
                      />
                      <select value={uploadSubject} onChange={(e) => setUploadSubject(e.target.value)} className={inputClass}>
                        {subjects
                          .filter((s) => s.toLowerCase().includes(formSubjectSearch.toLowerCase()))
                          .map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {uploadSubject === "Other" && (
                        <input type="text" placeholder="Type your subject..." value={uploadCustomSubject}
                          onChange={(e) => setUploadCustomSubject(e.target.value)}
                          className={`${inputClass} mt-2`} required />
                      )}
                    </div>
                    <div>
                      <label className="block text-gray-500 uppercase mb-1">Grade Group</label>
                      <select value={uploadGrade} onChange={(e) => setUploadGrade(e.target.value)} className={inputClass}>
                        {gradeGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {(uploadType === "article" || uploadType === "research_paper") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 uppercase mb-1">Year of Publication</label>
                    <input type="text" placeholder="e.g. 2024" value={uploadPublicationYear}
                      onChange={(e) => setUploadPublicationYear(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-gray-500 uppercase mb-1">Journal / Publisher</label>
                    <input type="text" placeholder="e.g. Nature Science" value={uploadPublisherName}
                      onChange={(e) => setUploadPublisherName(e.target.value)} className={inputClass} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-500 uppercase mb-1">External URL / Embed Link</label>
                <input type="text" placeholder="https://youtube.com/embed/..." value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className="block text-gray-500 uppercase mb-1">Attach File (PDF / Image)</label>
                <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="block w-full text-xs" />
              </div>

              {/* Thumbnail upload — hidden for stories (the template/uploaded file is used) */}
              {uploadType !== "stories" && (
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Thumbnail Image (optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => setUploadThumbnailFile(e.target.files?.[0] || null)} className="block w-full text-xs" />
                  <p className="text-[10px] text-gray-400 mt-1">
                    💡 If no thumbnail is uploaded and you attach an image file, it will automatically be used as the thumbnail.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-gray-500 uppercase mb-1">Keywords (comma-separated)</label>
                <input type="text" placeholder="e.g. biology, cell division, mitosis" value={uploadKeywords}
                  onChange={(e) => setUploadKeywords(e.target.value)} className={inputClass} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={uploadLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-purple-700 disabled:opacity-60">
                  {uploadLoading ? "Saving..." : editingResource ? "Save Changes" : "Publish Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD EXTERNAL LINK MODAL ───────────────────────────────────────────── */}
      {showExternalModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
            <h2 className="text-lg font-bold mb-5">Add External Resource Link</h2>
            {extError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 text-red-600 rounded text-xs">{extError}</div>
            )}
            <form onSubmit={handleExternalSubmit} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-gray-500 uppercase mb-1">Resource Title *</label>
                <input type="text" value={extTitle} onChange={(e) => setExtTitle(e.target.value)} className={inputClass}
                  placeholder="e.g. Edutopia Meme Resources" required />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1">Short Description *</label>
                <textarea value={extDescription} onChange={(e) => setExtDescription(e.target.value)}
                  className={`${inputClass} h-20 resize-none`} placeholder="A quick summary of the tool or platform..." required />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1">Thumbnail Image URL</label>
                <input type="url" value={extImageUrl} onChange={(e) => setExtImageUrl(e.target.value)} className={inputClass}
                  placeholder="https://domain.com/thumbnail.png" />
              </div>
              <div>
                <label className="block text-gray-500 uppercase mb-1">Destination URL *</label>
                <input type="url" value={extDestUrl} onChange={(e) => setExtDestUrl(e.target.value)} className={inputClass}
                  placeholder="https://example.com/pedagogy-reads" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowExternalModal(false)}
                  className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-lg font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={extLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-60">
                  {extLoading ? "Adding..." : "Add Resource Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Resources;
