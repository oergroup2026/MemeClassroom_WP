import { useState, useEffect, useMemo, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ExternalLink, Plus, Clock } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import SmartSearchBar from "./SmartSearchBar";
import SlangSlideshow from "./SlangSlideshow";
import ContributeSlangModal from "./ContributeSlangModal";
import { fuzzySearch } from "../utils/searchUtils";
import { SLANG_STARTER_WORDS } from "../data/slangStarterWords";

const CATEGORY_META = {
  genz: { label: "Gen Z", pill: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  genalpha: { label: "Gen Alpha", pill: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" },
  internet: { label: "Internet Slang", pill: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" },
  abbreviation: { label: "Abbreviation", pill: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300" },
  other: { label: "Other", pill: "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300" },
};

const SEARCH_FIELD_WEIGHTS = [
  { field: "term", weight: 3 },
  { field: "definition", weight: 1.5 },
  { field: "example_usage", weight: 1 },
  { field: "category", weight: 1 },
];

// ─── "Slang Decoder" tab content ─────────────────────────────────────────────
// Lightweight teaser + full dictionary experience embedded directly in the
// Resources tab (same shape as LiteracyTestsTabContent), deep-linking out to
// the full quiz page for the heavy interactive part.
const SlangDecoderTabContent = ({ navigate }) => {
  const { user } = useAuth();
  const [approvedTerms, setApprovedTerms] = useState([]);
  const [pendingOwnTerms, setPendingOwnTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showContributeModal, setShowContributeModal] = useState(false);
  const gridRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "slang_terms"), where("status", "==", "approved"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setApprovedTerms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load slang terms:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) { setPendingOwnTerms([]); return; }
    const q = query(
      collection(db, "slang_terms"),
      where("status", "==", "pending"),
      where("contributor_id", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPendingOwnTerms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Failed to load your pending words:", err));
    return () => unsub();
  }, [user]);

  // Merge live approved contributions with the bundled starter set, live entries win on name clash
  const dictionary = useMemo(() => {
    const byTermLower = new Map();
    [...approvedTerms, ...SLANG_STARTER_WORDS].forEach((t) => {
      const key = (t.term || "").trim().toLowerCase();
      if (key && !byTermLower.has(key)) byTermLower.set(key, t);
    });
    return Array.from(byTermLower.values()).sort((a, b) => (a.term || "").localeCompare(b.term || ""));
  }, [approvedTerms]);

  const filteredDictionary = useMemo(() => {
    let list = fuzzySearch(dictionary, searchQuery, SEARCH_FIELD_WEIGHTS);
    if (categoryFilter) list = list.filter((t) => t.category === categoryFilter);
    return list;
  }, [dictionary, searchQuery, categoryFilter]);

  const handleLearnMore = (term) => {
    setSearchQuery(term);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleContributeClick = () => {
    if (!user) { navigate("/auth"); return; }
    setShowContributeModal(true);
  };

  return (
    <div className="space-y-6 pt-2 pb-12">
      {showContributeModal && (
        <ContributeSlangModal onClose={() => setShowContributeModal(false)} />
      )}

      {/* Featured Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-lg shadow-purple-500/10">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-block bg-white/20 backdrop-blur-md text-purple-100 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            Gen Z · Gen Alpha · Internet Slang
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Decode the Slang Your Students Are Using
          </h2>
          <p className="text-sm text-purple-100/90 leading-relaxed">
            Search any word for a plain-language definition, then put your knowledge to the test with a rotating quiz and earn the Slang Sensei badge.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => navigate("/slang-quiz")}
              className="bg-white text-purple-700 font-extrabold px-5 py-2.5 rounded-xl text-xs hover:bg-purple-50 transition shadow-md flex items-center gap-2"
            >
              🧪 Take the Slang Quiz
            </button>
          </div>
        </div>
        <div className="absolute right-4 bottom-4 text-7xl sm:text-8xl opacity-15 pointer-events-none select-none">
          🗣️
        </div>
      </div>

      {/* Live, auto-updating slideshow */}
      <SlangSlideshow onLearnMore={handleLearnMore} />

      {/* Search + filter + contribute row */}
      <div ref={gridRef} className="flex flex-wrap items-center gap-2.5 scroll-mt-24">
        <div className="w-full sm:w-64 shrink-0">
          <SmartSearchBar
            items={dictionary}
            fieldWeights={SEARCH_FIELD_WEIGHTS}
            placeholder="Search a slang word..."
            value={searchQuery}
            onChange={setSearchQuery}
            voiceEnabled={false}
            size="sm"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
        >
          <option value="">Category: All</option>
          {Object.entries(CATEGORY_META).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </select>

        <button
          onClick={handleContributeClick}
          className="ml-auto flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Contribute a Word
        </button>
      </div>

      {/* Contributor's own pending words */}
      {pendingOwnTerms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Your pending words:
          </span>
          {pendingOwnTerms.map((t) => (
            <span key={t.id} className="text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full">
              {t.term} — awaiting review
            </span>
          ))}
        </div>
      )}

      {/* Dictionary Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 rounded-full border-4 border-teal-500/30 border-t-teal-500 animate-spin" />
        </div>
      ) : filteredDictionary.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-8">
          <span className="text-5xl">🔎</span>
          <h3 className="text-lg font-bold text-gray-800 dark:text-zinc-200 mt-3">No words found</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Try a different search term, or be the first to contribute this word!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDictionary.map((t) => {
            const meta = CATEGORY_META[t.category] || CATEGORY_META.other;
            return (
              <div
                key={t.id || t.term}
                className="bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-2xl p-5 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-base leading-snug">{t.term}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${meta.pill}`}>
                    {meta.label}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">{t.definition}</p>

                {t.example_usage && (
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500 italic">{t.example_usage}</p>
                )}

                {Array.isArray(t.meme_image_urls) && t.meme_image_urls.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {t.meme_image_urls.slice(0, 3).map((url, i) => (
                      <img key={i} src={url} alt={`${t.term} meme example`} className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-zinc-700" />
                    ))}
                  </div>
                )}

                {Array.isArray(t.related_links) && t.related_links.length > 0 && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-gray-100 dark:border-zinc-800">
                    {t.related_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> {link.title || link.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SlangDecoderTabContent;
