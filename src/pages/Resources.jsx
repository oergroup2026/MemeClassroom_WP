import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Clock, Search, BookOpen, Image, Heart, Eye, Share2, Bookmark, Flag as FlagIcon, MessageSquare, LayoutGrid, FileText, Layers, GraduationCap, ExternalLink, ClipboardCheck, Plus, ChevronLeft, Newspaper as NewspaperIcon, MessagesSquare } from "lucide-react";
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
import RichTextArea from "../components/RichTextArea";
import { SUBJECTS, GRADE_GROUPS, RESOURCE_TYPES, DEFAULT_TOOL_SECTIONS } from "../constants/taxonomy";
import ActivityContributeModal from "../components/ActivityContributeModal";
import ContributeResourceModal from "../components/ContributeResourceModal";
import SlangDecoderTabContent from "../components/SlangDecoderTabContent";
import FormattedText from "../components/FormattedText";
import { trackCustomSubmission } from "../utils/taxonomyUtils";
import { fuzzySearch } from "../utils/searchUtils";
import TtsSpeakerButton from "../components/TtsSpeakerButton";
import SmartSearchBar from "../components/SmartSearchBar";
import { useTour } from "../hooks/useTour";
import TourOverlay from "../components/TourOverlay";
import PageHelpPanel from "../components/PageHelpPanel";

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
const ResourceDetailModal = ({ res, authorName, isLiked, isBookmarked, user, activeTemplate, onLike, onBookmark, onClose, onViewLink }) => {
  // Hooks must run on every render, in the same order — so they come before
  // any early return. Bailing out above them changed the hook count between
  // "no resource selected" and "resource selected", which made React throw
  // ("Rendered more hooks than during the previous render") the moment a
  // resource was opened.
  const navigate = useNavigate();

  // Local state for expand — lives in the modal instance
  const [storyExpanded, setStoryExpanded] = React.useState(false);

  if (!res) return null;

  const typeLabel = res.type ? res.type.replace(/_/g, " ") : "Resource";
  const isStory = res.type === "stories";

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${isStory
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
          {/* Thumbnail / Template Hero Image */}
          {res.thumbnail_url ? (
            <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
              <img
                src={res.thumbnail_url}
                alt={res.title}
                className="w-full object-contain max-h-[360px]"
              />
            </div>
          ) : (isStory && activeTemplate?.media_url) ? (
            <div className="w-full rounded-xl overflow-hidden border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-zinc-900 flex items-center justify-center">
              <img
                src={activeTemplate.media_url}
                alt={activeTemplate.title || res.meme_name || res.title}
                className="w-full object-contain max-h-[360px]"
              />
            </div>
          ) : null}

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
                    <FormattedText text={res.body.slice(0, 400) + "..."} />
                    <button
                      onClick={() => setStoryExpanded(true)}
                      className="text-amber-600 dark:text-amber-400 font-bold hover:underline mt-2 text-xs"
                    >
                      Read Full Story ↓
                    </button>
                  </>
                ) : (
                  <FormattedText text={res.body} />
                )}
              </div>
            </div>
          ) : (
            <FormattedText text={res.body} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
          )}

          {/* Typical Meaning & Usage (stories only) */}
          {isStory && res.usage_context && (
            <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-1">
                <span>💡</span> Typical Meaning & Usage
              </h4>
              <FormattedText text={res.usage_context} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
            </div>
          )}

          {/* Educational Use (stories only) */}
          {isStory && res.educational_use && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                <span>🎓</span> Educational Use
              </h4>
              <FormattedText text={res.educational_use} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
            </div>
          )}

          {/* Associated Template Details */}
          {activeTemplate && (
            <div className="bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100/70 dark:border-purple-900/40 rounded-xl p-4 text-xs font-semibold">
              <span className="block uppercase tracking-wider text-purple-700 dark:text-purple-400 text-[10px] mb-3 font-extrabold">
                Original Meme Template
              </span>
              {/* Large template image preview */}
              {activeTemplate.media_url && (
                <div className="w-full rounded-lg overflow-hidden border border-purple-200 dark:border-purple-800 mb-3 bg-purple-50 dark:bg-zinc-900 flex items-center justify-center">
                  <img
                    src={activeTemplate.media_url}
                    alt={activeTemplate.title}
                    className="w-full object-contain max-h-[300px]"
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-extrabold text-gray-800 dark:text-gray-200 text-sm leading-tight">{activeTemplate.title}</h4>
                  <p className="text-gray-500 dark:text-gray-400 text-[10px] capitalize mt-0.5">Format: {activeTemplate.format || "image"}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    navigate(`/lab?templateId=${activeTemplate.id}&templateUrl=${encodeURIComponent(activeTemplate.media_url)}&format=${activeTemplate.format || "image"}`);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition shadow-sm flex-shrink-0"
                >
                  Remix Template
                </button>
              </div>
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
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" /> Pending Admin Approval — this resource is visible but awaiting review.
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
        <div className={`sticky bottom-0 px-6 py-4 flex flex-wrap items-center gap-3 border-t ${isStory
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
          <TtsSpeakerButton
            text={`${res.title}. ${res.body || ""}`}
            id={`resource-${res.id}`}
            size="sm"
          />
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

// ─── External Tool Detail Modal ───────────────────────────────────────────────
const ExternalToolDetailModal = ({ tool, contributorName, user, isAdmin, onClose, onDelete }) => {
  if (!tool) return null;
  const descriptionText = tool.description || tool.body || "";
  const isPending = !tool.admin_approved;

  let domain = "";
  try {
    const targetUrl = tool.destination_url || tool.file_url;
    if (targetUrl) {
      domain = new URL(targetUrl).hostname.replace(/^www\./, "");
    }
  } catch (_) { }

  return (
    <div className="fixed inset-0 bg-black/70 z-[120] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-block bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/40">
                🛠️ {tool.section || "Additional Tool"}
              </span>
              {isPending && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Pending Admin Review
                </span>
              )}
              {tool.is_classroom_friendly && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                  🏫 Classroom Friendly
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-snug">{tool.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl font-bold leading-none flex-shrink-0">×</button>
        </div>

        {/* Body Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Banner Thumbnail */}
          <ExternalToolThumbnail
            src={tool.image_url || tool.thumbnail_url}
            title={tool.title}
            destinationUrl={tool.destination_url || tool.file_url}
          />

          {/* Meta Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 pb-3 border-b border-gray-100 dark:border-zinc-800">
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              Contributed by <strong className="text-purple-600 dark:text-purple-400">{contributorName}</strong>
            </span>
            <span>📅 {tool.created_at ? new Date((tool.created_at.seconds || 0) * 1000).toLocaleDateString() : "Recently added"}</span>
          </div>

          {/* Full Description formatted with FormattedText */}
          <div className="space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Full Description & Guidance
            </h3>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/60 text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              <FormattedText text={descriptionText} />
            </div>
          </div>

          {/* Destination Link Box */}
          {(tool.destination_url || tool.file_url) && (
            <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-indigo-500 uppercase block">Official Website</span>
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate block">
                  {domain || tool.destination_url || tool.file_url}
                </span>
              </div>
              <a
                href={tool.destination_url || tool.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex-shrink-0 transition shadow-sm flex items-center gap-1.5"
              >
                Visit Tool ↗
              </a>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
            {user && (tool.contributor_id === user.uid || tool.author_id === user.uid || isAdmin) ? (
              <button
                onClick={() => { onDelete(tool.id); onClose(); }}
                className="text-xs font-bold text-red-500 hover:text-red-700 transition"
              >
                🗑️ Delete Tool
              </button>
            ) : <div />}
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-5 py-2 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── External Tool Card Thumbnail ──────────────────────────────────────────────
const ExternalToolThumbnail = ({ src, title, destinationUrl }) => {
  const [imgError, setImgError] = useState(false);

  let domain = "";
  try {
    if (destinationUrl) {
      domain = new URL(destinationUrl).hostname.replace(/^www\./, "");
    }
  } catch (_) { }

  const gradients = [
    "from-purple-600 via-indigo-600 to-purple-800",
    "from-blue-600 via-teal-600 to-emerald-700",
    "from-amber-500 via-orange-600 to-rose-600",
    "from-emerald-600 via-teal-700 to-cyan-800",
    "from-violet-600 via-purple-700 to-fuchsia-800"
  ];
  const charCodeSum = (title || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bgGradient = gradients[charCodeSum % gradients.length];
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;

  if (!src || imgError) {
    return (
      <div className={`w-full aspect-video rounded-xl mb-3.5 bg-gradient-to-br ${bgGradient} flex flex-col justify-between p-3.5 text-white shadow-sm relative overflow-hidden group select-none`}>
        <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10 blur-sm pointer-events-none" />
        <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-black/10 blur-sm pointer-events-none" />

        <div className="flex items-center justify-between z-10">
          <span className="text-[10px] font-extrabold uppercase tracking-wider bg-black/25 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20">
            🛠️ {domain || "Tool"}
          </span>
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt=""
              className="w-5 h-5 rounded-full bg-white p-0.5 shadow flex-shrink-0"
              onError={(e) => { e.target.style.display = "none"; }}
            />
          )}
        </div>

        <div className="z-10 mt-auto">
          <h4 className="font-extrabold text-sm leading-tight drop-shadow-sm line-clamp-2 text-white">
            {title}
          </h4>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden mb-3.5 border border-gray-200 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-800 relative group">
      <img
        src={src}
        alt={title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        onError={() => setImgError(true)}
      />
    </div>
  );
};

// ─── Literacy Tests Tab Content ──────────────────────────────────────────────
const LiteracyTestsTabContent = ({ navigate }) => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "literacy_tests"), where("is_active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
        setTests(list);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load literacy tests:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const diffColors = {
    beginner: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
    intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    advanced: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    expert: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };

  return (
    <div className="space-y-6 pt-2 pb-12">
      {/* Featured Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-lg shadow-purple-500/10">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-block bg-white/20 backdrop-blur-md text-purple-100 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            Interactive Assessments
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Standardised Meme Literacy Assessments
          </h2>
          <p className="text-sm text-purple-100/90 leading-relaxed">
            Test your critical meme literacy across media awareness, rhetorical intent, visual semiotics, and contextual verification. Earn verifiable badges and test your comprehension!
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/meme-literacy-test")}
              className="bg-white text-purple-700 font-extrabold px-5 py-2.5 rounded-xl text-xs hover:bg-purple-50 transition shadow-md flex items-center gap-2"
            >
              🚀 Launch Test Center
            </button>
          </div>
        </div>
        <div className="absolute right-4 bottom-4 text-7xl sm:text-8xl opacity-15 pointer-events-none select-none">
          🧪
        </div>
      </div>

      {/* Tests Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
        </div>
      ) : tests.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-8">
          <span className="text-5xl">🧪</span>
          <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-200 mt-3">
            Standard Assessment Available
          </h3>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Take our foundational 10-question Meme Literacy Assessment to measure your skills and earn your certification badge.
          </p>
          <button
            onClick={() => navigate("/meme-literacy-test")}
            className="mt-5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition"
          >
            Take Standard Test →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tests.map((test) => (
            <div
              key={test.id}
              onClick={() => navigate(`/meme-literacy-test/${test.id}`)}
              className="group cursor-pointer bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl p-5 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl leading-none">{test.badge_icon || "🧪"}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">
                      {test.title}
                    </h3>
                    {test.category && (
                      <span className="text-xs text-gray-400 dark:text-zinc-500 block mt-0.5">
                        {test.category}
                      </span>
                    )}
                  </div>
                </div>

                {test.description && (
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed line-clamp-3 mb-4">
                    {test.description}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize ${diffColors[test.difficulty] || diffColors.beginner
                      }`}
                  >
                    {test.difficulty}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                    {test.question_count || 0} Questions
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                    Pass: {test.pass_threshold || 60}%
                  </span>
                  {test.badge_label && (
                    <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                      {test.badge_icon} {test.badge_label}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:text-purple-700 transition">
                  <span>Start Assessment</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Resources Component ─────────────────────────────────────────────────
const Resources = () => {
  const { user, profile } = useAuth();
  const { highContrastMode } = useUdl();
  const { openUserModal } = useUserModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Interactive Tour Hook
  const {
    isTourOpen,
    currentStep,
    totalSteps,
    currentStepData,
    pageTitle,
    hasSkippedTour,
    nextStep,
    prevStep,
    skipTour,
    resetTour,
  } = useTour("resources");

  // ── Category state: null = tile landing, string = category view
  const rawCategory = searchParams.get("category") || searchParams.get("tab") || null;
  const [activeTab, setActiveTab] = useState(rawCategory);

  // ── Data
  const [resources, setResources] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
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

  // Sync ?q= or ?search= from URL (e.g. from global Navbar search or Meme Lab template story links)
  useEffect(() => {
    const q = searchParams.get("q") || searchParams.get("search");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Enriched resources for smart predictive search
  const enrichedResources = React.useMemo(() => {
    return resources.map((r) => ({
      ...r,
      _type: r.type || "resource",
      _authorName: displayCache[r.author_id]?.name || ""
    }));
  }, [resources, displayCache]);

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
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingResource, setEditingResource] = useState(null); // null = create mode; resource obj = edit mode
  const [detailResource, setDetailResource] = useState(null);
  const currentResourceDetail = detailResource ? (resources.find(r => r.id === detailResource.id) || detailResource) : null;
  const [detailTool, setDetailTool] = useState(null);
  const [showFlagPopup, setShowFlagPopup] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Activity tab state
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [strategyTags, setStrategyTags] = useState([]);
  const [activityTagFilter, setActivityTagFilter] = useState("");
  const [showActivityPendingPopup, setShowActivityPendingPopup] = useState(false);

  // ── Universal contribute modal
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contributeDefaultType, setContributeDefaultType] = useState(null); // null = show type picker

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
  const [uploadExampleImages, setUploadExampleImages] = useState([""]); // array of URL strings
  const [uploadExampleFiles, setUploadExampleFiles] = useState([]); // array of File objects

  // ── External link form state (for "External" tab)
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [extTitle, setExtTitle] = useState("");
  const [extDescription, setExtDescription] = useState("");
  const [extImageUrl, setExtImageUrl] = useState("");
  const [extThumbnailFile, setExtThumbnailFile] = useState(null);
  const [extThumbnailPreview, setExtThumbnailPreview] = useState("");
  const [extDestUrl, setExtDestUrl] = useState("");
  const [extSection, setExtSection] = useState("Meme Related Tools");
  const [extIsClassroomFriendly, setExtIsClassroomFriendly] = useState(false);
  const [extClassroomFriendlyOnly, setExtClassroomFriendlyOnly] = useState(false);
  const [extSortBy, setExtSortBy] = useState("newest");
  const [extSectionFilter, setExtSectionFilter] = useState("");
  const [toolSections, setToolSections] = useState(DEFAULT_TOOL_SECTIONS);
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
    setUploadUsageContext(""); setUploadEducationalUse(""); setUploadExampleImages([""]);
    setUploadExampleFiles([]);
  };

  // ── URL category sync
  useEffect(() => {
    if (activeTab) {
      setSearchParams({ category: activeTab }, { replace: true });
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
        if (data.tool_sections?.length) {
          setToolSections(data.tool_sections);
        }
      }
    }, (error) => {
      console.error("Taxonomy configs subscription failed:", error);
    });
    return () => unsub();
  }, []);

  // ── Load strategy tags from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "configs", "strategy_tags"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.tags)) setStrategyTags(data.tags);
      }
    }, () => { });
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
        // Also exclude admin_hidden resources from the public gallery
        if (data.status === "admin_hidden") return;
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
              const userDoc = await getDoc(doc(db, "user_cards", authorId));
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
  }, []);

  // ── 4.05 Deep link: ?highlight=<resourceId> auto-opens that resource's
  // detail modal once (only for plain resources — activities/stories already
  // have their own /resources/activity/:id and /resources/story/:id routes
  // and are linked to directly instead of via this query param).
  const highlightHandledRef = useRef(false);
  useEffect(() => {
    if (highlightHandledRef.current) return;
    const highlightId = searchParams.get("highlight");
    if (!highlightId || resources.length === 0) return;
    const target = resources.find((r) => r.id === highlightId);
    if (target) {
      setDetailResource(target);
      updateDoc(doc(db, "resources", target.id), { view_count: increment(1) }).catch(() => {});
    }
    highlightHandledRef.current = true;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("highlight");
      return next;
    }, { replace: true });
  }, [resources, searchParams, setSearchParams]);

  // ── 4.1 Real-time templates listener
  useEffect(() => {
    const collRef = collection(db, "templates");
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const results = [];
      snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }));
      results.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      setTemplates(results);
    });
    return () => unsubscribe();
  }, []);

  // ── 4.2 Fetch activeTemplate metadata when details modal is opened
  useEffect(() => {
    if (!currentResourceDetail) {
      setActiveTemplate(null);
      return;
    }

    if (currentResourceDetail.template_id) {
      const fetchTemplate = async () => {
        try {
          const docSnap = await getDoc(doc(db, "templates", currentResourceDetail.template_id));
          if (docSnap.exists()) {
            setActiveTemplate({ id: docSnap.id, ...docSnap.data() });
          } else {
            setActiveTemplate(null);
          }
        } catch (e) {
          console.error("Error fetching resource template:", e);
          setActiveTemplate(null);
        }
      };
      fetchTemplate();
    } else {
      setActiveTemplate(null);
    }
  }, [currentResourceDetail]);

  // ── 5. Real-time external links listener (loaded once, used when tab=external)
  useEffect(() => {
    const collRef = collection(db, "external_links");
    const unsubscribe = onSnapshot(collRef, (snapshot) => {
      const results = [];
      snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }));
      // Show only admin-approved links. This listener previously rendered every
      // document, so a link was live to every visitor — including students — the
      // instant anyone submitted it, with no review. Contributors still see
      // their own pending submission so it does not appear to have vanished.
      const visible = results.filter(
        (l) => l.admin_approved === true || (user && l.contributor_id === user.uid)
      );
      visible.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setExternalLinks(visible);
    });
    return () => unsubscribe();
  }, [user]);

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
    if (activeTab === "article_paper") {
      result = result.filter((r) => r.type === "article" || r.type === "research_paper");
    } else if (activeTab && activeTab !== "all" && activeTab !== "additional") {
      result = result.filter((r) => r.type === activeTab);
    }

    // Subject filter
    if (subjectFilter) result = result.filter((r) => r.subject === subjectFilter);
    // Grade filter
    if (gradeFilter) result = result.filter((r) => r.grade_group === gradeFilter);

    // Search
    if (searchQuery.trim()) {
      result = fuzzySearch(result, searchQuery, [
        { field: "title", weight: 3 },
        { field: "body", weight: 1.5 },
        { field: "subject", weight: 2 },
        { field: "keywords", weight: 2 },
        { field: "publisher_name", weight: 1 },
        { field: "meme_name", weight: 2 }
      ]);
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

    const isCurrentlyLiked = Boolean(savedResourceLikesMap[resourceId]);
    const existingLikeDocId = savedResourceLikesMap[resourceId];
    const likeDocRef = doc(db, "resource_likes", existingLikeDocId || `${user.uid}_${resourceId}`);
    const resourceRef = doc(db, "resources", resourceId);

    // Optimistic state update: update likes map and resource array count immediately
    setSavedResourceLikesMap(prev => {
      const copy = { ...prev };
      if (isCurrentlyLiked) delete copy[resourceId];
      else copy[resourceId] = existingLikeDocId || `${user.uid}_${resourceId}`;
      return copy;
    });

    setResources(prev => prev.map(r => {
      if (r.id === resourceId) {
        const cur = r.likes_count || 0;
        return { ...r, likes_count: isCurrentlyLiked ? Math.max(0, cur - 1) : cur + 1 };
      }
      return r;
    }));

    try {
      if (isCurrentlyLiked) {
        await deleteDoc(likeDocRef).catch(() => { });
        await setDoc(resourceRef, { likes_count: increment(-1) }, { merge: true });
        if (authorId && authorId !== "admin") {
          await setDoc(doc(db, "user_stats", authorId), { total_likes_received: increment(-1) }, { merge: true }).catch(() => { });
        }
      } else {
        await setDoc(likeDocRef, {
          user_id: user.uid, resource_id: resourceId, created_at: serverTimestamp()
        }, { merge: true });
        await setDoc(resourceRef, { likes_count: increment(1) }, { merge: true });
        if (authorId && authorId !== "admin") {
          await setDoc(doc(db, "user_stats", authorId), { total_likes_received: increment(1) }, { merge: true }).catch(() => { });
        }
      }
    } catch (e) {
      console.error("Resource like toggle failed", e);
      // Rollback on error
      setSavedResourceLikesMap(prev => {
        const copy = { ...prev };
        if (isCurrentlyLiked) copy[resourceId] = existingLikeDocId || `${user.uid}_${resourceId}`;
        else delete copy[resourceId];
        return copy;
      });
      setResources(prev => prev.map(r => {
        if (r.id === resourceId) {
          const cur = r.likes_count || 0;
          return { ...r, likes_count: isCurrentlyLiked ? cur + 1 : Math.max(0, cur - 1) };
        }
        return r;
      }));
      showToast("Failed to update like.", "error");
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
        const statsRef = doc(db, "user_stats", user.uid);
        try {
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(statsRef);
            if (snap.exists()) {
              const current = snap.data().resources_contributed_count || 0;
              tx.update(statsRef, { resources_contributed_count: Math.max(0, current - 1) });
            }
          });
        } catch (txErr) {
          console.error("Failed to safely decrement resources_contributed_count", txErr);
        }
      }
      showToast("Resource deleted successfully.", "success");
    } catch (e) {
      console.error("Failed to delete resource", e);
      showToast("Failed to delete resource. Please try again.", "error");
    }
  };

  const handleOpenEditModal = (res) => {
    setEditingResource(res);
    setContributeDefaultType(res.type || "article");
    setShowContributeModal(true);
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

      let extraExampleUrls = [];
      if (uploadType === "stories" && uploadExampleFiles.length > 0) {
        for (let i = 0; i < uploadExampleFiles.length; i++) {
          const file = uploadExampleFiles[i];
          if (file) {
            const exRef = ref(storage, `resources/examples_${user.uid}_${Date.now()}_${i}`);
            const exSnap = await uploadBytes(exRef, file);
            const exUrl = await getDownloadURL(exSnap.ref);
            extraExampleUrls.push(exUrl);
          }
        }
      }
      const finalExampleImages = [
        ...uploadExampleImages.map((u) => u.trim()).filter(Boolean),
        ...extraExampleUrls,
      ];

      const parsedKeywords = (uploadType === "stories" || !uploadKeywords)
        ? []
        : uploadKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);

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
          updatedData.example_images = finalExampleImages;
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
          const statsSnap = await transaction.get(statsDocRef);
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
            resourceData.example_images = finalExampleImages;
          }
          transaction.set(newDocRef, resourceData);
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
      let finalImageUrl = extImageUrl ? extImageUrl.trim() : "";

      if (extThumbnailFile) {
        try {
          const fileRef = ref(storage, `external_thumbnails/${Date.now()}_${extThumbnailFile.name}`);
          await uploadBytes(fileRef, extThumbnailFile);
          finalImageUrl = await getDownloadURL(fileRef);
        } catch (uploadErr) {
          console.warn("Thumbnail image upload failed, proceeding without uploaded file:", uploadErr);
        }
      }

      if (!finalImageUrl && extDestUrl) {
        try {
          const domain = new URL(extDestUrl).hostname;
          if (domain) {
            finalImageUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
          }
        } catch (_) { }
      }

      // First attempt writing to external_links collection
      try {
        await addDoc(collection(db, "external_links"), {
          title: extTitle.trim(),
          description: extDescription,
          image_url: finalImageUrl,
          destination_url: extDestUrl,
          section: extSection || "Meme Related Tools",
          is_classroom_friendly: Boolean(extIsClassroomFriendly),
          contributor_id: user.uid,
          admin_approved: false,
          created_at: serverTimestamp()
        });
      } catch (externalErr) {
        console.warn("Writing to external_links collection failed, using resources collection fallback:", externalErr);
        // Fallback: write to resources collection which has production-approved security rules
        await addDoc(collection(db, "resources"), {
          title: extTitle.trim(),
          body: extDescription,
          type: "tool",
          subject: "Other",
          grade_group: "All Grades",
          file_url: extDestUrl,
          thumbnail_url: finalImageUrl,
          section: extSection || "Meme Related Tools",
          is_classroom_friendly: Boolean(extIsClassroomFriendly),
          likes_count: 0,
          flag_count: 0,
          view_count: 0,
          author_id: user.uid,
          status: "live",
          admin_approved: false,
          created_at: serverTimestamp()
        });
      }

      setShowExternalModal(false);
      setExtTitle(""); setExtDescription(""); setExtImageUrl(""); setExtDestUrl(""); setExtSection("Meme Related Tools"); setExtIsClassroomFriendly(false);
      setExtThumbnailFile(null); setExtThumbnailPreview("");
      showToast("External resource added! Pending admin review.", "success");
    } catch (err) {
      console.error("External resource submit error:", err);
      setExtError(err.message || "Failed to add resource. Try again.");
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
  const containerClass = "bg-white/45 dark:bg-zinc-900/45 backdrop-blur-sm border border-gray-200/50 dark:border-zinc-800/40 shadow-md hover:shadow-xl rounded-xl transition-all duration-300";

  const btnClass = "bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-sm";

  const inputClass = highContrastMode
    ? "w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-lg text-xs text-white placeholder-gray-500"
    : "w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-lg text-xs text-gray-800";

  const activeFeat = featuredResources[featuredIndex] || MOCK_FEATURED[0];
  const isAdmin = profile?.role === "admin";

  // ─── Activity Card (for the Activities tab) ────────────────────────────────
  const ActivityCard = ({ res }) => {
    const isPending = !res.admin_approved;
    const isLiked = !!savedResourceLikesMap[res.id];
    const isBookmarked = !!savedResourcesMap[res.id];
    const alreadyFlagged = !!userFlagsMap[res.id];
    const authorName = res.author_id === "admin" ? "Admin" : (displayCache[res.author_id] || "Contributor");
    const canEdit = user && res.author_id === user.uid;
    const canDelete = user && (res.author_id === user.uid || isAdmin);

    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900/80 border border-purple-200/60 dark:border-purple-900/40 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
        {/* Header: author + pending badge */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-purple-100/60 dark:border-purple-900/30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-[10px] flex-shrink-0">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-extrabold text-gray-800 dark:text-white truncate">{authorName}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isPending && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowActivityPendingPopup(true); }}
                className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full hover:bg-amber-100 transition"
                title="Click to learn about pending approval"
              >
                <Clock className="w-2.5 h-2.5" /> Pending
              </button>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        <div
          onClick={() => { navigate(`/resources/activity/${res.id}`); handleIncrementViewCount(res.id); }}
          className="relative w-full bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-purple-950/30 dark:to-indigo-950/30 flex items-center justify-center overflow-hidden group cursor-pointer flex-shrink-0"
          style={{ height: 160 }}
        >
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <span className="bg-white/90 dark:bg-zinc-900/90 text-gray-900 dark:text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm">Open Activity →</span>
          </div>
          {res.cover_image_url ? (
            <img src={res.cover_image_url} alt={res.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl opacity-20">🎯</span>
          )}
        </div>

        {/* Body */}
        <div className="px-4 pt-3 pb-2 flex-grow flex flex-col gap-1.5">
          {/* Strategy tags */}
          {(res.strategy_tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {res.strategy_tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => { navigate(`/resources/activity/${res.id}`); handleIncrementViewCount(res.id); }}
            className="font-extrabold text-sm text-left hover:text-purple-600 dark:hover:text-purple-400 transition text-gray-900 dark:text-white leading-snug line-clamp-2 block w-full"
          >
            {res.title}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed flex-grow">{res.body}</p>
          <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
            {res.subject && <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{res.subject}</span>}
            {res.grade_group && <span className="bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{res.grade_group}</span>}
            {res.duration_minutes && <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900">⏱ {res.duration_minutes} min</span>}
          </div>
        </div>

        {/* CTA */}
        <div className="px-4 pb-3 pt-1">
          <button
            onClick={() => { navigate(`/resources/activity/${res.id}`); handleIncrementViewCount(res.id); }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-xl transition shadow-sm"
          >
            Open →
          </button>
        </div>

        {/* Footer icon bar */}
        <div className="px-4 py-2 border-t border-purple-100/60 dark:border-purple-900/30 flex items-center justify-between text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-3">
            <button onClick={() => handleResourceLikeToggle(res.id, res.author_id)}
              className={`flex items-center gap-1 hover:scale-105 active:scale-95 transition ${isLiked ? 'text-red-500 font-bold' : 'hover:text-red-500'}`} title="Like">
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} strokeWidth={1.5} />
              <span className="text-[10px] font-semibold tabular-nums">{res.likes_count || 0}</span>
            </button>
            {(res.view_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-medium">
                <Eye className="w-3.5 h-3.5" strokeWidth={1.5} /> {res.view_count}
              </span>
            )}

          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => handleShareResource(res.id)} className="hover:text-green-500 hover:scale-105 active:scale-95 transition" title="Share">
              <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button onClick={() => handleBookmarkToggle(res.id)} className={`hover:scale-105 active:scale-95 transition ${isBookmarked ? 'text-amber-500' : 'hover:text-amber-500'}`} title={isBookmarked ? 'Remove' : 'Save'}>
              <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} strokeWidth={1.5} />
            </button>
            <button onClick={() => handleFlagResource(res.id)} className={`hover:scale-105 active:scale-95 transition ${alreadyFlagged ? 'text-orange-500' : 'hover:text-orange-400'}`} title={alreadyFlagged ? 'Already reported' : 'Report'}>
              <FlagIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            {(canEdit || canDelete) && (
              <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-zinc-800 pl-2.5">
                {canEdit && (
                  <button onClick={() => { setEditingActivity(res); setShowActivityModal(true); }} className="text-gray-400 hover:text-purple-600 transition text-[11px]" title="Edit">✏️</button>
                )}
                {canDelete && (
                  <button onClick={() => handleDeleteResource(res.id)} className="text-gray-400 hover:text-red-500 transition text-[11px]" title="Delete">🗑️</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Tile config ───────────────────────────────────────────────────────────────
  const TILES = [
    { id: "all", label: "Browse All", description: "Every resource in one place", Icon: LayoutGrid, accent: "text-[#E0115F]", border: "hover:border-[#E0115F]/40", bg: "group-hover:bg-[#E0115F]/5" },
    { id: "article_paper", label: "Articles & Papers", description: "Research, blogs & academic publications", Icon: FileText, accent: "text-indigo-600 dark:text-indigo-400", border: "hover:border-indigo-400/40", bg: "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20" },
    { id: "activity", label: "Use Cases & Activities", description: "Lesson plans & classroom activities", Icon: Layers, accent: "text-purple-600 dark:text-purple-400", border: "hover:border-purple-400/40", bg: "group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20" },
    { id: "course", label: "Courses & Lessons", description: "Structured learning modules", Icon: GraduationCap, accent: "text-emerald-600 dark:text-emerald-400", border: "hover:border-emerald-400/40", bg: "group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/20" },
    { id: "stories", label: "Meme Stories", description: "Origins & classroom use of meme templates", Icon: BookOpen, accent: "text-amber-600 dark:text-amber-400", border: "hover:border-amber-400/40", bg: "group-hover:bg-amber-50 dark:group-hover:bg-amber-950/20" },
    { id: "additional", label: "Other Digital Tools", description: "Tools, links & open educational resources", Icon: ExternalLink, accent: "text-sky-600 dark:text-sky-400", border: "hover:border-sky-400/40", bg: "group-hover:bg-sky-50 dark:group-hover:bg-sky-950/20" },
    { id: "literacy_tests", label: "Literacy Tests", description: "Assess & develop your meme literacy skills", Icon: ClipboardCheck, accent: "text-violet-600 dark:text-violet-400", border: "hover:border-violet-400/40", bg: "group-hover:bg-violet-50 dark:group-hover:bg-violet-950/20" },
    { id: "slang", label: "Slang Decoder", description: "Decode Gen Z, Gen Alpha & internet slang", Icon: MessagesSquare, accent: "text-teal-600 dark:text-teal-400", border: "hover:border-teal-400/40", bg: "group-hover:bg-teal-50 dark:group-hover:bg-teal-950/20" },
  ];

  // Count resources per category for tile badges
  const categoryCount = React.useMemo(() => {
    const counts = { all: resources.length, article_paper: 0, activity: 0, course: 0, stories: 0, additional: 0, literacy_tests: 0 };
    resources.forEach((r) => {
      if (r.type === "article" || r.type === "research_paper") counts.article_paper++;
      else if (r.type === "activity") counts.activity++;
      else if (r.type === "course") counts.course++;
      else if (r.type === "stories" || r.type === "story") counts.stories++;
      else if (r.type === "tool" || r.type === "other") counts.additional++;
    });
    counts.additional += externalLinks.length;
    return counts;
  }, [resources, externalLinks]);

  // Active tile label for breadcrumb
  const activeTileLabel = activeTab ? (TILES.find(t => t.id === activeTab)?.label || "Resources") : null;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-visible">
      {/* Subtle Background Aura Lightings (Blue Palette for Resources Page) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        {/* Glow Blob 1: Blue Top Left */}
        <div className="absolute -top-[10%] left-[5%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full bg-blue-500/15 dark:bg-blue-600/20 blur-[75px] sm:blur-[95px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }}></div>
        {/* Glow Blob 2: Indigo Middle Right */}
        <div className="absolute top-[30%] right-[5%] w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full bg-indigo-500/15 dark:bg-indigo-600/20 blur-[80px] sm:blur-[105px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }}></div>
        {/* Glow Blob 3: Sky Blue Bottom Left */}
        <div className="absolute bottom-[10%] left-[10%] w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-sky-400/20 dark:bg-sky-700/25 blur-[70px] sm:blur-[90px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '6s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto py-8 px-4 space-y-8 relative z-10">

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
        {showFlagPopup && createPortal(<FlagPopup onClose={() => setShowFlagPopup(false)} />, document.body)}

        {/* Resource Detail Modal */}
        {currentResourceDetail && createPortal(
          <ResourceDetailModal
            res={currentResourceDetail}
            authorName={currentResourceDetail.author_id === "admin" ? "Admin" : (displayCache[currentResourceDetail.author_id] || "Contributor")}
            isLiked={!!savedResourceLikesMap[currentResourceDetail.id]}
            isBookmarked={!!savedResourcesMap[currentResourceDetail.id]}
            user={user}
            activeTemplate={activeTemplate}
            onLike={() => handleResourceLikeToggle(currentResourceDetail.id, currentResourceDetail.author_id)}
            onBookmark={() => handleBookmarkToggle(currentResourceDetail.id)}
            onViewLink={() => handleIncrementViewCount(currentResourceDetail.id)}
            onClose={() => setDetailResource(null)}
          />,
          document.body
        )}

        {/* External Tool Detail Modal Popup */}
        {detailTool && createPortal(
          <ExternalToolDetailModal
            tool={detailTool}
            contributorName={
              detailTool.contributor_id === "admin" || detailTool.author_id === "admin"
                ? "Admin"
                : (displayCache[detailTool.contributor_id || detailTool.author_id] || "Contributor")
            }
            user={user}
            isAdmin={isAdmin}
            onClose={() => setDetailTool(null)}
            onDelete={(id) => handleDeleteExternalLink(id)}
          />,
          document.body
        )}

        {/* ── Page Header ───────────────────────────────────────────────────────── */}
        {activeTab === null ? (
          // ── TILE LANDING SCREEN ────────────────────────────────────────────────
          <div className="space-y-8">
            <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Meme Resources</h1>
            </div>

            {/* Tile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {TILES.map(({ id, label, description, Icon, accent, border, bg }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`group relative flex flex-col items-start gap-3 p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 ${border} shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left ${bg} w-full`}
                >
                  <div className={`p-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 ${accent} transition-colors`}>
                    <Icon className="w-6 h-6" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1">
                    <p className="font-extrabold text-sm text-gray-900 dark:text-white leading-snug">{label}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{description}</p>
                  </div>
                  {categoryCount[id] > 0 && (
                    <span className="absolute bottom-3.5 right-4 text-[10px] font-bold text-gray-400 dark:text-zinc-500">
                      {categoryCount[id]} {id === "literacy_tests" ? "tests" : "resources"}
                    </span>
                  )}
                </button>
              ))}

              {/* Newspaper Tile — navigates to the separate Newspaper page, not a Resources tab */}
              <button
                onClick={() => navigate("/newspaper")}
                className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 hover:border-rose-400/40 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left group-hover:bg-rose-50 dark:group-hover:bg-rose-950/20 w-full"
              >
                <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-rose-600 dark:text-rose-400 transition-colors">
                  <NewspaperIcon className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-sm text-gray-900 dark:text-white leading-snug">Newspaper</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">Meme culture in the news — for classroom discussion</p>
                </div>
              </button>

              {/* Contribute Tile */}
              <button
                onClick={() => {
                  if (!user) { navigate("/auth"); return; }
                  setContributeDefaultType(null);
                  setEditingResource(null);
                  setShowContributeModal(true);
                }}
                className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-dashed border-[#E0115F]/40 hover:border-[#E0115F] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left hover:bg-[#E0115F]/5 w-full"
              >
                <div className="p-2.5 rounded-xl bg-[#E0115F]/10 text-[#E0115F] transition-colors">
                  <Plus className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-sm text-gray-900 dark:text-white leading-snug">Contribute a Resource</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">Share articles, activities, courses, stories & more</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          // ── CATEGORY DETAIL VIEW ───────────────────────────────────────────────
          <div className="border-b border-gray-200 dark:border-gray-800 pb-5">
            <button
              onClick={() => setActiveTab(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition mb-3"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Resources
            </button>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {activeTileLabel}
            </h1>
          </div>
        )}

        {/* ── CATEGORY CONTENT (only rendered when a category is selected) ─────── */}
        {activeTab !== null && (activeTab === "additional" ? (
          <div className="space-y-6 pt-4">
            {/* Single-line Search, Filter Dropdowns & Sort bar */}
            <div className="flex flex-wrap items-center gap-2.5 mb-5">
              {/* Search Bar (reduced width, side by side on same line) */}
              <div className="w-44 sm:w-56 md:w-60 shrink-0">
                <SmartSearchBar
                  items={enrichedResources}
                  fieldWeights={[
                    { field: "title", weight: 3 },
                    { field: "body", weight: 1.5 },
                    { field: "subject", weight: 2 },
                    { field: "keywords", weight: 2 },
                    { field: "publisher_name", weight: 1 },
                    { field: "meme_name", weight: 2 },
                    { field: "_authorName", weight: 1 }
                  ]}
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  voiceEnabled={false}
                  size="sm"
                />
              </div>

              {/* Tool Category Filter Dropdown */}
              <select
                value={extSectionFilter}
                onChange={(e) => setExtSectionFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
              >
                <option value="">Category: All</option>
                {toolSections.map((sec) => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>

              {/* Audience / Classroom Friendly Filter Dropdown */}
              <select
                value={extClassroomFriendlyOnly ? "friendly" : "all"}
                onChange={(e) => setExtClassroomFriendlyOnly(e.target.value === "friendly")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
              >
                <option value="all">Audience: All</option>
                <option value="friendly">🏫 Classroom Friendly</option>
              </select>

              {/* Sort inline Dropdown */}
              <select
                value={extSortBy}
                onChange={(e) => setExtSortBy(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
              >
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Sort: Oldest</option>
                <option value="alpha">Sort: A-Z Title</option>
              </select>

              {/* Clear / Reset Filter Button */}
              {(extClassroomFriendlyOnly || extSectionFilter || searchQuery) && (
                <button
                  onClick={() => {
                    setExtClassroomFriendlyOnly(false);
                    setExtSectionFilter("");
                    setSearchQuery("");
                  }}
                  className="text-xs font-bold text-red-500 hover:underline px-2 py-1 shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Render Sections */}
            {toolSections
              .filter(secName => !extSectionFilter || secName === extSectionFilter)
              .map((secName) => {
                const secIcon =
                  secName === "Meme Related Tools" ? "🎭" :
                    secName === "Media Literacy" ? "📰" :
                      secName === "Other Open Educational Resources" ? "📚" : "🛠️";

                const q = searchQuery.toLowerCase().trim();

                // Find external links for this section matching classroom filter and search query
                let matchingLinks = externalLinks.filter(l => {
                  const linkSec = l.section || "Meme Related Tools";
                  const matchesSection = linkSec === secName;
                  const matchesClassroom = !extClassroomFriendlyOnly || l.is_classroom_friendly;
                  const matchesSearch = !q || (
                    l.title?.toLowerCase().includes(q) ||
                    l.description?.toLowerCase().includes(q) ||
                    l.section?.toLowerCase().includes(q) ||
                    l.destination_url?.toLowerCase().includes(q)
                  );
                  return matchesSection && matchesClassroom && matchesSearch;
                });

                if (extSortBy === "newest") {
                  matchingLinks.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                } else if (extSortBy === "oldest") {
                  matchingLinks.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
                } else if (extSortBy === "alpha") {
                  matchingLinks.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                }

                // Include tool / other type resources from resources DB collection as fallback
                let matchingOtherResources = resources.filter(r => {
                  const rSec = r.section || "Other Open Educational Resources";
                  const isToolOrOther = r.type === "tool" || r.type === "other";
                  if (!isToolOrOther) return false;
                  const matchesSection = rSec === secName || (secName === "Other Open Educational Resources" && !r.section);
                  if (!matchesSection) return false;
                  if (extClassroomFriendlyOnly && !r.is_classroom_friendly) return false;
                  if (!q) return true;
                  return (
                    r.title?.toLowerCase().includes(q) ||
                    r.body?.toLowerCase().includes(q) ||
                    r.subject?.toLowerCase().includes(q)
                  );
                });

                if (extSortBy === "newest") {
                  matchingOtherResources.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                } else if (extSortBy === "oldest") {
                  matchingOtherResources.sort((a, b) => (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0));
                } else if (extSortBy === "alpha") {
                  matchingOtherResources.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                }

                const totalItemsCount = matchingLinks.length + matchingOtherResources.length;

                return (
                  <div key={secName} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-2">
                      <h3 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{secIcon}</span> {secName}
                        <span className="text-xs font-normal text-gray-400">({totalItemsCount})</span>
                      </h3>
                    </div>

                    {totalItemsCount > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* External Links */}
                        {matchingLinks.map((link) => {
                          const contributorName = displayCache[link.contributor_id] || "Contributor";
                          return (
                            <div key={link.id} className="flex flex-col justify-between h-full bg-white dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  {!link.admin_approved && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" /> Pending Review
                                    </div>
                                  )}
                                  {link.is_classroom_friendly && (
                                    <div className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                                      <span>🏫</span> Classroom & Student Friendly
                                    </div>
                                  )}
                                </div>
                                <div className="cursor-pointer group" onClick={() => setDetailTool(link)}>
                                  <ExternalToolThumbnail
                                    src={link.image_url}
                                    title={link.title}
                                    destinationUrl={link.destination_url}
                                  />
                                  <h4 className="font-extrabold text-sm mb-1.5 line-clamp-1 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">{link.title}</h4>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2 leading-relaxed">{link.description}</p>
                                <button
                                  onClick={() => setDetailTool(link)}
                                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline mb-3 inline-flex items-center gap-1"
                                >
                                  More details →
                                </button>
                              </div>
                              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                                <a
                                  href={link.destination_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full py-2 rounded-xl text-xs text-center block transition shadow-sm"
                                >
                                  Visit Tool ↗
                                </a>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
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
                                      className="text-purple-600 dark:text-purple-400 hover:underline capitalize font-semibold"
                                    >
                                      By {contributorName}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Other / Fallback Tool Resources */}
                        {matchingOtherResources.map((res) => {
                          const isBookmarked = !!savedResourcesMap[res.id];
                          const contributorName = res.author_id === "admin" ? "Admin" : (displayCache[res.author_id] || "Contributor");
                          const canDelete = user && (res.author_id === user.uid || isAdmin);

                          return (
                            <div key={res.id} className="flex flex-col justify-between h-full bg-white dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 p-5">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                  {!res.admin_approved && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" /> Pending Review
                                    </div>
                                  )}
                                  {res.is_classroom_friendly && (
                                    <div className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full">
                                      <span>🏫</span> Classroom & Student Friendly
                                    </div>
                                  )}
                                </div>
                                <div className="cursor-pointer group" onClick={() => setDetailTool(res)}>
                                  <ExternalToolThumbnail
                                    src={res.thumbnail_url || (res.file_url && res.file_url.startsWith("http") ? res.file_url : "")}
                                    title={res.title}
                                    destinationUrl={res.file_url}
                                  />
                                  <h4 className="font-extrabold text-sm mb-1.5 line-clamp-1 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">{res.title}</h4>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2 leading-relaxed">{res.body}</p>
                                <button
                                  onClick={() => setDetailTool(res)}
                                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline mb-3 inline-flex items-center gap-1"
                                >
                                  More details →
                                </button>
                              </div>
                              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                                {res.file_url ? (
                                  <a
                                    href={res.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => handleIncrementViewCount(res.id)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold w-full py-2 rounded-xl text-xs text-center block transition shadow-sm"
                                  >
                                    Visit Tool ↗
                                  </a>
                                ) : (
                                  <button onClick={() => setDetailResource(res)} className="text-indigo-600 font-bold text-xs hover:underline block w-full text-center">
                                    View Details →
                                  </button>
                                )}
                                <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium">
                                  <span>Added: {res.created_at ? new Date(res.created_at.seconds * 1000).toLocaleDateString() : "Just now"}</span>
                                  <div className="flex items-center gap-2">
                                    {canDelete && (
                                      <button onClick={() => handleDeleteResource(res.id)} className="text-red-500 hover:text-red-700 font-bold transition">
                                        Delete
                                      </button>
                                    )}
                                    <button onClick={() => { if (res.author_id && res.author_id !== "admin") openUserModal(res.author_id); }} className="text-purple-600 dark:text-purple-400 hover:underline capitalize font-semibold">
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
                      <div className="p-6 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 text-center bg-gray-50/50 dark:bg-zinc-900/30">
                        <p className="text-xs text-gray-400 mb-2">No tools listed under "{secName}" yet.</p>
                        {user ? (
                          <button
                            onClick={() => { setExtSection(secName); setShowExternalModal(true); }}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            + Submit a tool for {secName}
                          </button>
                        ) : (
                          <a href="/auth" className="text-xs font-bold text-purple-600 hover:underline">Sign in to contribute</a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ) : activeTab === "literacy_tests" ? (
          <LiteracyTestsTabContent navigate={navigate} />
        ) : activeTab === "slang" ? (
          <SlangDecoderTabContent navigate={navigate} />
        ) : activeTab !== null ? (


          /* ── MAIN RESOURCES GRID ───────────────────────────────────────────── */
          <div>
            {/* ── Single-line Search, Filter Dropdowns & Sort Bar ─────────────────── */}
            <div className="flex flex-wrap items-center gap-2.5 mb-5 pt-4">
              {/* Search Bar (reduced width, side by side on same line) */}
              <div className="w-44 sm:w-56 md:w-60 shrink-0">
                <SmartSearchBar
                  items={enrichedResources}
                  fieldWeights={[
                    { field: "title", weight: 3 },
                    { field: "body", weight: 1.5 },
                    { field: "subject", weight: 2 },
                    { field: "keywords", weight: 2 },
                    { field: "publisher_name", weight: 1 },
                    { field: "meme_name", weight: 2 },
                    { field: "_authorName", weight: 1 }
                  ]}
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  voiceEnabled={false}
                  size="sm"
                />
              </div>

              {/* Subject Filter Dropdown */}
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
              >
                <option value="">Subject: All</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {/* Grade Level Filter Dropdown */}
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
              >
                <option value="">Grade Level: All</option>
                {gradeGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Strategy Filter Dropdown (for activity category) */}
              {activeTab === "activity" && strategyTags.length > 0 && (
                <select
                  value={activityTagFilter}
                  onChange={(e) => setActivityTagFilter(e.target.value)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
                >
                  <option value="">Strategy: All</option>
                  {strategyTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              )}

              {/* Sort inline Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition cursor-pointer"
              >
                <option value="newest">Sort: Newest</option>
                <option value="most_liked">Sort: Most Liked</option>
                <option value="most_viewed">Sort: Most Viewed</option>
                <option value="oldest">Sort: Oldest</option>
              </select>

              {/* Clear / Reset Filter Button */}
              {(subjectFilter || gradeFilter || activityTagFilter || searchQuery) && (
                <button
                  onClick={() => {
                    setSubjectFilter("");
                    setGradeFilter("");
                    setActivityTagFilter("");
                    setSearchQuery("");
                  }}
                  className="text-xs font-bold text-red-500 hover:underline px-2 py-1 shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* ── Resources Grid (3-column) ──────────────────────────────────────────── */}
            <div id="resources-viewer-area">
              {paginatedResources
                .filter(res => {
                  if (activeTab !== "activity" || !activityTagFilter) return true;
                  return (res.strategy_tags || []).includes(activityTagFilter);
                })
                .length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {paginatedResources.map((res) => {
                      const isBookmarked = !!savedResourcesMap[res.id];
                      const isLiked = !!savedResourceLikesMap[res.id];
                      const authorName = res.author_id === "admin" ? "Admin" : (displayCache[res.author_id] || "Contributor");
                      const canEdit = user && res.author_id === user.uid;
                      const canDelete = user && (res.author_id === user.uid || isAdmin);
                      const alreadyFlagged = !!userFlagsMap[res.id];

                      // ── Activity Card ────────────────────────────────────────
                      if (res.type === "activity") {
                        return <ActivityCard key={res.id} res={res} />;
                      }

                      // ── Story Card ─────────────────────────────────────────
                      if (res.type === "stories" || res.type === "story") {
                        return (
                          <div
                            key={res.id}
                            className="flex flex-col h-full bg-white/45 dark:bg-zinc-900/45 backdrop-blur-sm border border-amber-200/60 dark:border-amber-800/40 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                          >
                            {/* Header: author + badge */}
                            <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-amber-100/60 dark:border-amber-900/30">
                              <div
                                className="flex items-center gap-2 cursor-pointer group min-w-0"
                                onClick={() => { if (res.author_id !== "admin") openUserModal(res.author_id); }}
                              >
                                <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0 border border-amber-200/50 dark:border-amber-800/30 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                                  {authorName.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-[11px] font-extrabold text-gray-800 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition truncate">
                                  {authorName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {!res.admin_approved && (
                                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 px-1.5 py-0.5 rounded-full">
                                    <Clock className="w-2.5 h-2.5" /> Pending
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Image block */}
                            {(() => {
                              const previewUrl = res.thumbnail_url
                                || (res.template_id && templates.find(t => t.id === res.template_id)?.media_url)
                                || null;
                              return (
                                <div
                                  className="relative w-full bg-gradient-to-br from-amber-50 to-amber-100 dark:from-zinc-900 dark:to-zinc-950 flex items-center justify-center overflow-hidden group cursor-pointer flex-shrink-0"
                                  style={{ height: '170px' }}
                                  onClick={() => navigate(`/resources/story/${res.id}`)}
                                >
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                                    <span className="bg-white/90 dark:bg-zinc-900/90 text-gray-900 dark:text-white px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm">
                                      📖 Read Story
                                    </span>
                                  </div>
                                  {previewUrl ? (
                                    <img
                                      src={previewUrl}
                                      alt={res.title}
                                      className="w-full h-full object-contain"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center gap-1.5 text-amber-400 dark:text-amber-600">
                                      <BookOpen className="w-9 h-9 opacity-40" />
                                      {res.meme_name && (
                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 px-3 text-center opacity-70">
                                          🎭 {res.meme_name}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Card body */}
                            <div className="px-4 pt-3 pb-2 flex-grow flex flex-col">
                              {res.meme_name && (
                                <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full mb-1.5 border border-amber-200 dark:border-amber-700/50 self-start">
                                  <Image className="w-2.5 h-2.5" /> {res.meme_name}
                                </span>
                              )}
                              <button
                                onClick={() => navigate(`/resources/story/${res.id}`)}
                                className="font-extrabold text-sm mb-1.5 text-left hover:text-amber-600 dark:hover:text-amber-400 transition block w-full text-gray-900 dark:text-white leading-snug line-clamp-2"
                              >
                                {res.title}
                              </button>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed flex-grow">
                                {res.body}
                              </p>
                            </div>

                            {/* CTA — prominent */}
                            <div className="px-4 pb-3 pt-1">
                              <button
                                onClick={() => navigate(`/resources/story/${res.id}`)}
                                className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2 rounded-xl transition shadow-sm"
                              >
                                More details →
                              </button>
                            </div>

                            {/* Footer icon bar */}
                            <div className="px-4 pb-3 pt-2 border-t border-amber-100/60 dark:border-amber-900/30">
                              <div className="flex items-center justify-between text-gray-400 dark:text-gray-500">
                                <button
                                  onClick={() => handleResourceLikeToggle(res.id, res.author_id)}
                                  className={`flex items-center gap-0.5 hover:scale-110 active:scale-95 transition-all ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                                  title="Like"
                                >
                                  <Heart className={`w-[14px] h-[14px] ${isLiked ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                  <span className="text-[9px] font-bold tabular-nums ml-0.5">{res.likes_count || 0}</span>
                                </button>
                                {(res.view_count || 0) > 0 && (
                                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400">👁 {res.view_count}</span>
                                )}
                                <button onClick={() => handleShareResource(res.id)} className="hover:text-green-500 hover:scale-110 active:scale-95 transition-all" title="Share">
                                  <Share2 className="w-[14px] h-[14px]" strokeWidth={1.5} />
                                </button>
                                <button onClick={() => handleBookmarkToggle(res.id)} className={`hover:scale-110 active:scale-95 transition-all ${isBookmarked ? 'text-amber-500' : 'hover:text-amber-500'}`} title={isBookmarked ? "Remove from saved" : "Save"}>
                                  <Bookmark className={`w-[14px] h-[14px] ${isBookmarked ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                </button>
                                <button onClick={() => handleFlagResource(res.id)} className={`hover:scale-110 active:scale-95 transition-all ${alreadyFlagged ? 'text-orange-500' : 'hover:text-orange-400'}`} title={alreadyFlagged ? "Already reported" : "Report"}>
                                  <FlagIcon className="w-[14px] h-[14px]" strokeWidth={1.5} />
                                </button>
                                {(canEdit || canDelete) && (
                                  <div className="flex items-center gap-1.5">
                                    {canEdit && <button onClick={() => handleOpenEditModal(res)} className="text-gray-400 hover:text-blue-500 transition text-[10px]" title="Edit">✏️</button>}
                                    {canDelete && <button onClick={() => handleDeleteResource(res.id)} className="text-gray-400 hover:text-red-500 transition text-[10px]" title="Delete">🗑️</button>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ── Generic Resource Card ──────────────────────────────
                      return (
                        <div
                          key={res.id}
                          onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                          className="flex flex-col h-full bg-white dark:bg-zinc-900/80 border border-gray-200/80 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden cursor-pointer"
                        >
                          {/* Header: author + type badge */}
                          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-gray-100 dark:border-zinc-800/60">
                            <div
                              className="flex items-center gap-2 cursor-pointer group min-w-0"
                              onClick={() => { if (res.author_id !== "admin") openUserModal(res.author_id); }}
                            >
                              <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-extrabold text-[10px] flex-shrink-0">
                                {authorName ? authorName.charAt(0).toUpperCase() : "C"}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] font-extrabold text-gray-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition block truncate">
                                  {authorName}
                                </span>
                                {(res.type === "article" || res.type === "research_paper") && res.publisher_name && (
                                  <span className="text-[9px] text-gray-400 block truncate">{res.publisher_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!res.admin_approved && (
                                <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full">
                                  <Clock className="w-2.5 h-2.5" /> Pending
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Image block */}
                          {res.thumbnail_url && (
                            <div
                              onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                              className="w-full overflow-hidden bg-gray-100 dark:bg-zinc-800 cursor-pointer group flex-shrink-0"
                              style={{ height: '160px' }}
                            >
                              <img
                                src={res.thumbnail_url}
                                alt={res.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}
                          {res.type === "course" && res.file_url && !res.thumbnail_url && (
                            <div className="w-full bg-black flex-shrink-0" style={{ height: '160px' }}>
                              <iframe src={res.file_url} title={res.title} className="w-full h-full" allowFullScreen />
                            </div>
                          )}

                          {/* Card body */}
                          <div className="px-4 pt-3 pb-2 flex-grow flex flex-col">
                            <button
                              onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                              className="font-extrabold text-sm mb-1.5 text-left hover:text-purple-600 dark:hover:text-purple-400 transition block w-full text-gray-900 dark:text-white leading-snug line-clamp-2"
                            >
                              {res.title}
                            </button>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed flex-grow">
                              {res.body}
                            </p>
                          </div>

                          {/* CTA — prominent */}
                          <div className="px-4 pb-3 pt-1">
                            {res.file_url && res.type !== "course" ? (
                              <a
                                href={res.file_url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => handleIncrementViewCount(res.id)}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                              >
                                {res.file_url.includes("firebasestorage.googleapis.com") ? "Open PDF ↗" : "Visit ↗"}
                              </a>
                            ) : (
                              <button
                                onClick={() => { setDetailResource(res); handleIncrementViewCount(res.id); }}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                              >
                                More details →
                              </button>
                            )}
                          </div>

                          {/* Footer icon toolbar */}
                          <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800/60 flex items-center justify-between text-gray-400 dark:text-gray-500">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleResourceLikeToggle(res.id, res.author_id)}
                                className={`flex items-center gap-1 hover:scale-105 active:scale-95 transition ${isLiked ? 'text-red-500 font-bold' : 'hover:text-red-500'}`}
                                title="Like"
                              >
                                <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} strokeWidth={1.5} />
                                <span className="text-[10px] font-semibold tabular-nums">{res.likes_count || 0}</span>
                              </button>
                              {(res.view_count || 0) > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-medium">
                                  <Eye className="w-3.5 h-3.5" strokeWidth={1.5} /> {res.view_count}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleShareResource(res.id)} className="hover:text-green-500 hover:scale-105 active:scale-95 transition" title="Share">
                                <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>
                              <button onClick={() => handleBookmarkToggle(res.id)} className={`hover:scale-105 active:scale-95 transition ${isBookmarked ? 'text-amber-500' : 'hover:text-amber-500'}`} title={isBookmarked ? "Remove" : "Save"}>
                                <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} strokeWidth={1.5} />
                              </button>
                              <button onClick={() => handleFlagResource(res.id)} className={`hover:scale-105 active:scale-95 transition ${alreadyFlagged ? 'text-orange-500' : 'hover:text-orange-400'}`} title={alreadyFlagged ? "Already reported" : "Report"}>
                                <FlagIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </button>

                              {/* Edit / Delete (Owner / Admin) */}
                              {(canEdit || canDelete) && (
                                <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-zinc-800 pl-2.5">
                                  {canEdit && (
                                    <button
                                      onClick={() => handleOpenEditModal(res)}
                                      className="text-gray-400 hover:text-blue-500 transition text-[11px]"
                                      title="Edit"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteResource(res.id)}
                                      className="text-gray-400 hover:text-red-500 transition text-[11px]"
                                      title="Delete"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
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
                          className={`w-8 h-8 text-xs font-bold rounded-lg transition ${p === currentPage
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
                    {user ? (
                      <button
                        onClick={() => {
                          if (activeTab === "activity") {
                            setEditingActivity(null);
                            setShowActivityModal(true);
                          } else if (activeTab === "additional") {
                            setShowExternalModal(true);
                          } else {
                            setContributeDefaultType(activeTab !== "all" ? activeTab : null);
                            setEditingResource(null);
                            setShowContributeModal(true);
                          }
                        }}
                        className="border border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-bold px-4 py-2 rounded-xl transition"
                      >
                        Be the first to contribute →
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate("/auth")}
                        className="border border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-xs font-bold px-4 py-2 rounded-xl transition inline-block"
                      >
                        Be the first to contribute →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null)}
        {/* ── PENDING APPROVAL POPUP (Activity tab) ───────────────────────────── */}
        {showActivityPendingPopup && createPortal(
          <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4" onClick={() => setShowActivityPendingPopup(false)}>
            <div className="bg-white dark:bg-zinc-900 border border-yellow-200 dark:border-yellow-800 rounded-2xl shadow-2xl p-6 max-w-sm text-center space-y-3" onClick={e => e.stopPropagation()}>
              <div className="text-4xl">⏳</div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Pending Admin Approval</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                This activity was uploaded by a community member and is currently awaiting review by our admin team. The content has not yet been verified or approved.
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl px-3 py-2">
                You can still view and interact with this activity. It will receive a ✅ verified badge once approved.
              </p>
              <button onClick={() => setShowActivityPendingPopup(false)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition">
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}

        {/* ── ACTIVITY CONTRIBUTE MODAL ─────────────────────────────────────────── */}
        {showActivityModal && (
          <ActivityContributeModal
            activityToEdit={editingActivity}
            onClose={() => { setShowActivityModal(false); setEditingActivity(null); }}
            onSuccess={(res) => {
              showToast(editingActivity ? "Activity updated successfully! 🎯" : "Activity published! It's live and pending admin review. 🎯", "success");
              setEditingActivity(null);
            }}
            subjects={subjects}
            gradeGroups={gradeGroups}
            availableTags={strategyTags}
          />
        )}

        {/* ── UNIVERSAL CONTRIBUTE MODAL ────────────────────────────────────────── */}
        {showContributeModal && (
          <ContributeResourceModal
            defaultType={contributeDefaultType}
            editingResource={editingResource}
            onClose={() => { setShowContributeModal(false); setEditingResource(null); setContributeDefaultType(null); }}
            onSuccess={(msg) => showToast(msg || "Resource published! It's live and pending admin review. ✅", "success")}
            subjects={subjects}
            gradeGroups={gradeGroups}
            availableTags={strategyTags}
          />
        )}

        {/* ── ADD EXTERNAL LINK MODAL ───────────────────────────────────────────── */}



        {/* ── ADD EXTERNAL LINK MODAL ───────────────────────────────────────────── */}
        {showExternalModal && createPortal(
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className={`w-full max-w-md p-6 rounded-xl overflow-y-auto max-h-[90vh] ${containerClass}`}>
              <h2 className="text-lg font-bold mb-5">Add External Resource Link</h2>
              {extError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 text-red-600 rounded text-xs">{extError}</div>
              )}
              <form onSubmit={handleExternalSubmit} className="space-y-4 text-xs font-semibold">
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Section / Category *</label>
                  <select
                    value={extSection}
                    onChange={(e) => setExtSection(e.target.value)}
                    className={inputClass}
                  >
                    {toolSections.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Resource Title *</label>
                  <input type="text" value={extTitle} onChange={(e) => setExtTitle(e.target.value)} className={inputClass}
                    placeholder="e.g. Edutopia Meme Resources" required />
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Short Description *</label>
                  <RichTextArea value={extDescription} onChange={(e) => setExtDescription(e.target.value)}
                    rows={3} placeholder="A quick summary of the tool or platform..." required />
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Thumbnail Image (Upload File or Enter URL)</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      {extThumbnailPreview && (
                        <img src={extThumbnailPreview} alt="Preview" className="w-14 h-10 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 flex-shrink-0" />
                      )}
                      <label className="cursor-pointer bg-gray-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/20 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 text-xs font-bold px-3 py-2 rounded-xl transition inline-block">
                        📁 Choose Image File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setExtThumbnailFile(file);
                            setExtThumbnailPreview(file ? URL.createObjectURL(file) : "");
                          }}
                        />
                      </label>
                      {extThumbnailFile && (
                        <span className="text-[10px] text-gray-500 truncate max-w-[140px]">{extThumbnailFile.name}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium">OR enter Image URL directly:</div>
                    <input
                      type="url"
                      value={extImageUrl}
                      onChange={(e) => setExtImageUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://domain.com/thumbnail.png"
                    />
                    <p className="text-[10px] text-purple-600 dark:text-purple-400">
                      💡 If left blank, we'll automatically generate a website icon or stylized tool card.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-500 uppercase mb-1">Destination URL *</label>
                  <input type="url" value={extDestUrl} onChange={(e) => setExtDestUrl(e.target.value)} className={inputClass}
                    placeholder="https://example.com/pedagogy-reads" required />
                </div>
                <div className="flex items-start gap-2.5 p-3 bg-purple-50/50 dark:bg-zinc-800/60 border border-purple-100 dark:border-zinc-700/60 rounded-xl">
                  <input
                    type="checkbox"
                    id="extClassroomFriendlyCheck"
                    checked={extIsClassroomFriendly}
                    onChange={(e) => setExtIsClassroomFriendly(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
                  />
                  <label htmlFor="extClassroomFriendlyCheck" className="text-xs text-gray-800 dark:text-gray-200 font-bold cursor-pointer select-none">
                    Classroom & Student Friendly
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-normal leading-snug mt-0.5">
                      Check if this tool is designed for classroom learning and follows required student & child-friendly guidelines.
                    </span>
                  </label>
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
          </div>,
          document.body
        )}
        {/* Interactive First-Time Tour */}
        <TourOverlay
          isOpen={isTourOpen}
          currentStep={currentStep}
          totalSteps={totalSteps}
          stepData={currentStepData}
          pageTitle={pageTitle}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
        />

        {/* Floating Page Help Panel */}
        <PageHelpPanel
          pageKey="resources"
          onRestartTour={resetTour}
          hasSkippedTour={hasSkippedTour}
        />

      </div>
    </div>
  );
};

export default Resources;
