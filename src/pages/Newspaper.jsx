import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Heart, Eye, Share2, Bookmark, Flag as FlagIcon, Clock,
  ExternalLink, Plus, Newspaper as NewspaperIcon, TrendingUp, Rss
} from "lucide-react";
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc,
  addDoc, updateDoc, serverTimestamp, increment
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ToastNotification";
import { NEWSPAPER_CATEGORIES } from "../constants/newspaperCategories";
import { fuzzySearch } from "../utils/searchUtils";
import ContributeNewspaperModal from "../components/ContributeNewspaperModal";

const ITEMS_PER_PAGE = 12;

// Full literal class strings (not dynamic interpolation) so Tailwind's
// content scanner can find them at build time.
const CATEGORY_STYLES = {
  rose: {
    pill: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900",
    ph: "from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-950/10 text-rose-300 dark:text-rose-800",
  },
  emerald: {
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
    ph: "from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-950/10 text-emerald-300 dark:text-emerald-800",
  },
  teal: {
    pill: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900",
    ph: "from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-950/10 text-teal-300 dark:text-teal-800",
  },
  indigo: {
    pill: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900",
    ph: "from-indigo-50 to-indigo-100 dark:from-indigo-950/30 dark:to-indigo-950/10 text-indigo-300 dark:text-indigo-800",
  },
  amber: {
    pill: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
    ph: "from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-950/10 text-amber-300 dark:text-amber-800",
  },
  fuchsia: {
    pill: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-900",
    ph: "from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-950/30 dark:to-fuchsia-950/10 text-fuchsia-300 dark:text-fuchsia-800",
  },
  sky: {
    pill: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900",
    ph: "from-sky-50 to-sky-100 dark:from-sky-950/30 dark:to-sky-950/10 text-sky-300 dark:text-sky-800",
  },
  violet: {
    pill: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900",
    ph: "from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-950/10 text-violet-300 dark:text-violet-800",
  },
  gray: {
    pill: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800/50 dark:text-gray-400 dark:border-zinc-700",
    ph: "from-gray-50 to-gray-100 dark:from-zinc-800/50 dark:to-zinc-900/50 text-gray-300 dark:text-zinc-700",
  },
};

function categoryMeta(value) {
  return NEWSPAPER_CATEGORIES.find((c) => c.value === value) || NEWSPAPER_CATEGORIES[NEWSPAPER_CATEGORIES.length - 1];
}

export default function Newspaper() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(null); // null = All
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [showContributeModal, setShowContributeModal] = useState(false);

  const [likesMap, setLikesMap] = useState({});
  const [savesMap, setSavesMap] = useState({});
  const [flagsMap, setFlagsMap] = useState({});
  const [likePendingMap, setLikePendingMap] = useState({});

  // ── 1. Real-time item feed (excludes admin-hidden, keeps pending visible)
  useEffect(() => {
    const q = query(collection(db, "newspaper_items"), where("status", "!=", "admin_hidden"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setItems(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ── 2. Real-time likes listener (user-specific)
  useEffect(() => {
    if (!user) { setLikesMap({}); return; }
    const q = query(collection(db, "newspaper_likes"), where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.data().item_id] = d.id; });
      setLikesMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // ── 3. Real-time bookmarks listener (user-specific, newspaper items only)
  useEffect(() => {
    if (!user) { setSavesMap({}); return; }
    const q = query(
      collection(db, "saves"),
      where("user_id", "==", user.uid),
      where("content_type", "==", "newspaper_item")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.data().item_id] = d.id; });
      setSavesMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // ── 4. Load user's prior flags (to prevent double-flagging)
  useEffect(() => {
    if (!user) { setFlagsMap({}); return; }
    const q = query(
      collection(db, "flags"),
      where("reporter_id", "==", user.uid),
      where("content_type", "==", "newspaper_item")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.data().content_id] = true; });
      setFlagsMap(map);
    });
    return () => unsubscribe();
  }, [user]);

  // ─── Curated "Top Picks" strip ──────────────────────────────────────────────
  const topPicks = useMemo(() => {
    return [...items]
      .filter((i) => i.admin_approved)
      .sort((a, b) => ((b.view_count || 0) + (b.likes_count || 0) * 2) - ((a.view_count || 0) + (a.likes_count || 0) * 2))
      .slice(0, 3);
  }, [items]);

  // ─── Filtering + Sorting + Pagination ───────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (categoryFilter) result = result.filter((i) => i.category === categoryFilter);

    if (searchQuery.trim()) {
      result = fuzzySearch(result, searchQuery, [
        { field: "title", weight: 3 },
        { field: "summary_text", weight: 2 },
        { field: "classroom_talking_point", weight: 1 },
        { field: "keywords", weight: 2 },
      ]);
    }

    if (sortBy === "most_liked") {
      result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else if (sortBy === "most_viewed") {
      result.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    } else if (sortBy === "oldest") {
      result.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
    } else {
      result.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
    }

    return result;
  }, [items, categoryFilter, searchQuery, sortBy]);

  useEffect(() => { setCurrentPage(1); }, [categoryFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleViewLink = useCallback((item) => {
    updateDoc(doc(db, "newspaper_items", item.id), { view_count: increment(1) }).catch(() => {});
    window.open(item.source_url, "_blank", "noopener,noreferrer");
  }, []);

  const handleLikeToggle = async (itemId) => {
    if (!user) { toast("Please sign in to like items.", "warning"); return; }
    if (likePendingMap[itemId]) return;
    setLikePendingMap((prev) => ({ ...prev, [itemId]: true }));

    const isLiked = !!likesMap[itemId];
    const likeDocId = likesMap[itemId] || `${user.uid}_${itemId}`;
    const likeRef = doc(db, "newspaper_likes", likeDocId);
    const itemRef = doc(db, "newspaper_items", itemId);

    try {
      if (isLiked) {
        await deleteDoc(likeRef).catch(() => {});
        await setDoc(itemRef, { likes_count: increment(-1) }, { merge: true });
      } else {
        await setDoc(likeRef, { user_id: user.uid, item_id: itemId, created_at: serverTimestamp() }, { merge: true });
        await setDoc(itemRef, { likes_count: increment(1) }, { merge: true });
      }
    } catch (e) {
      console.error("Newspaper like toggle failed", e);
      toast("Failed to update like.", "error");
    } finally {
      setLikePendingMap((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleBookmarkToggle = async (itemId) => {
    if (!user) { toast("Please sign in to save items.", "warning"); return; }
    const existingId = savesMap[itemId];
    try {
      if (existingId) {
        await deleteDoc(doc(db, "saves", existingId));
      } else {
        const saveDocId = `${user.uid}_news_${itemId}`;
        await setDoc(doc(db, "saves", saveDocId), {
          user_id: user.uid,
          item_id: itemId,
          content_type: "newspaper_item",
          created_at: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error("Newspaper bookmark toggle failed", e);
    }
  };

  const handleFlag = async (itemId) => {
    if (!user) { toast("Please sign in to report content.", "warning"); return; }
    if (flagsMap[itemId]) { toast("You have already reported this item.", "info"); return; }
    try {
      await addDoc(collection(db, "flags"), {
        reporter_id: user.uid,
        content_type: "newspaper_item",
        content_id: itemId,
        reason: "Newspaper item flagged by user",
        status: "pending",
        created_at: serverTimestamp(),
      });
      await updateDoc(doc(db, "newspaper_items", itemId), { flag_count: increment(1) });
      toast("Report submitted. An admin will review this item.", "success");
    } catch (e) {
      console.error("Newspaper flag failed", e);
      toast("Failed to submit report. Please try again.", "error");
    }
  };

  const handleShare = (item) => {
    navigator.clipboard.writeText(item.source_url).then(() => {
      toast("Link copied to clipboard! 🔗", "success");
    }).catch(() => {
      toast("Could not copy link.", "error");
    });
  };

  const handleAddClick = () => {
    if (!user) { navigate("/auth"); return; }
    setShowContributeModal(true);
  };

  // ─── Card ────────────────────────────────────────────────────────────────────
  const NewsCard = ({ item }) => {
    const cat = categoryMeta(item.category);
    const style = CATEGORY_STYLES[cat.color] || CATEGORY_STYLES.gray;
    const isPending = !item.admin_approved;
    const isLiked = !!likesMap[item.id];
    const isBookmarked = !!savesMap[item.id];
    const alreadyFlagged = !!flagsMap[item.id];

    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        {/* Header: category pill + auto-fetched/pending badges */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border truncate ${style.pill}`}>
            {cat.label}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {item.auto_fetched && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-2 py-0.5 rounded-full" title="Automatically pulled in from the web">
                <Rss className="w-2.5 h-2.5" /> Auto
              </span>
            )}
            {isPending && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                <Clock className="w-2.5 h-2.5" /> Pending
              </span>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <div
          onClick={() => handleViewLink(item)}
          className={`relative w-full bg-gradient-to-br ${style.ph} flex items-center justify-center overflow-hidden group cursor-pointer flex-shrink-0`}
          style={{ height: 140 }}
        >
          {item.image_url ? (
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
          ) : (
            <NewspaperIcon className="w-10 h-10" strokeWidth={1.25} />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="bg-white/90 dark:bg-zinc-900/90 text-gray-900 dark:text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1">
              Read source <ExternalLink className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-2 flex-grow flex flex-col gap-1.5">
          <button
            onClick={() => handleViewLink(item)}
            className="font-extrabold text-sm text-left hover:text-rose-600 dark:hover:text-rose-400 transition text-gray-900 dark:text-white leading-snug line-clamp-2"
          >
            {item.title}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed flex-grow">{item.summary_text}</p>
          {item.classroom_talking_point && (
            <div className="mt-1 p-2 bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900 rounded-lg text-[10px] text-sky-700 dark:text-sky-400 line-clamp-2">
              🎓 {item.classroom_talking_point}
            </div>
          )}
          <button
            onClick={() => handleViewLink(item)}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 truncate text-left flex items-center gap-1 mt-1"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" /> {item.source_domain || "source"}
          </button>
        </div>

        {/* Footer icon bar */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800/60 flex items-center justify-between text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLikeToggle(item.id)}
              className={`flex items-center gap-1 hover:scale-105 active:scale-95 transition ${isLiked ? "text-red-500 font-bold" : "hover:text-red-500"}`}
              title="Like"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} strokeWidth={1.5} />
              <span className="text-[10px] font-semibold tabular-nums">{item.likes_count || 0}</span>
            </button>
            {(item.view_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} /> {item.view_count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => handleShare(item)} className="hover:text-green-500 hover:scale-105 active:scale-95 transition" title="Share">
              <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleBookmarkToggle(item.id)}
              className={`hover:scale-105 active:scale-95 transition ${isBookmarked ? "text-amber-500" : "hover:text-amber-500"}`}
              title={isBookmarked ? "Remove" : "Save"}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-current" : ""}`} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handleFlag(item.id)}
              className={`hover:scale-105 active:scale-95 transition ${alreadyFlagged ? "text-orange-500" : "hover:text-orange-400"}`}
              title={alreadyFlagged ? "Already reported" : "Report"}
            >
              <FlagIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <NewspaperIcon className="w-6 h-6 text-rose-600" /> Newspaper
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Meme culture meets the real world — for classroom discussion.
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add News Item
        </button>
      </div>

      {/* Top picks strip */}
      {topPicks.length > 0 && (
        <div className="mb-6">
          <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> This Week's Top Picks
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {topPicks.map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${!categoryFilter ? "bg-rose-600 border-rose-600 text-white" : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-rose-300"}`}
          >
            All
          </button>
          {NEWSPAPER_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${categoryFilter === cat.value ? "bg-rose-600 border-rose-600 text-white" : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-rose-300"}`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the Newspaper..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 text-gray-800 dark:text-gray-200"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl text-xs text-gray-800 dark:text-gray-200"
          >
            <option value="newest">Newest</option>
            <option value="most_liked">Most Liked</option>
            <option value="most_viewed">Most Viewed</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Loading Newspaper feed...</div>
      ) : paginatedItems.length === 0 ? (
        <div className="text-center py-16">
          <NewspaperIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-zinc-700 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No items yet — be the first to contribute!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((item) => <NewsCard key={item.id} item={item} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-700 disabled:opacity-40 text-gray-600 dark:text-gray-300"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 dark:border-zinc-700 disabled:opacity-40 text-gray-600 dark:text-gray-300"
          >
            Next
          </button>
        </div>
      )}

      {showContributeModal && (
        <ContributeNewspaperModal
          onClose={() => setShowContributeModal(false)}
          onSuccess={() => toast("Newspaper item published! Pending admin review.", "success")}
        />
      )}
    </div>
  );
}
