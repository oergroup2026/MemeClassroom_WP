import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { SLANG_STARTER_WORDS } from "../data/slangStarterWords";

const CATEGORY_META = {
  genz: { label: "Gen Z", emoji: "🔥" },
  genalpha: { label: "Gen Alpha", emoji: "🎮" },
  internet: { label: "Internet Slang", emoji: "💬" },
  abbreviation: { label: "Abbreviation", emoji: "⌨️" },
  other: { label: "Slang", emoji: "✨" },
};

// Small deterministic shuffle so slide order still varies between page loads
// without needing extra state.
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Live, auto-advancing "flashcard" slideshow teasing slang terms ─────────
// Sources real (admin-approved) contributed words — and any meme images
// attached to them — from Firestore, merged with a bundled starter set.
// Styled as a white card with ruby accents (matching the app's brand) but
// kept visually distinct from the quiz-prompt card next to it via a dashed
// border and dot-pattern texture, so it still reads as "browse a word"
// rather than a duplicate call-to-action.
const SlangSlideshow = ({ onLearnMore }) => {
  const [liveTerms, setLiveTerms] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "slang_terms"), where("status", "==", "approved"));
    const unsub = onSnapshot(
      q,
      (snap) => setLiveTerms(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("Failed to load live slang terms for slideshow:", err);
        setLiveTerms([]);
      }
    );
    return () => unsub();
  }, []);

  const slides = useMemo(() => {
    const byTermLower = new Map();
    // Live, admin-approved contributions take priority over the starter set
    // when the same word appears in both.
    [...liveTerms, ...SLANG_STARTER_WORDS].forEach((t) => {
      const key = (t.term || "").trim().toLowerCase();
      if (key && !byTermLower.has(key)) byTermLower.set(key, t);
    });
    return shuffle(Array.from(byTermLower.values()));
  }, [liveTerms]);

  // Re-clamp the active index whenever the (possibly reshuffled) slide list changes size
  useEffect(() => {
    setActiveIdx((i) => (slides.length > 0 ? i % slides.length : 0));
  }, [slides.length]);

  const goNext = useCallback(() => {
    setActiveIdx((i) => (slides.length > 0 ? (i + 1) % slides.length : 0));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setActiveIdx((i) => (slides.length > 0 ? (i - 1 + slides.length) % slides.length : 0));
  }, [slides.length]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const id = setInterval(goNext, 5000);
    return () => clearInterval(id);
  }, [isPaused, slides.length, goNext]);

  if (slides.length === 0) return null;

  const slide = slides[activeIdx];
  const meta = CATEGORY_META[slide.category] || CATEGORY_META.other;
  const memeUrl = Array.isArray(slide.meme_image_urls) ? slide.meme_image_urls[0] : null;

  return (
    <div
      className="relative rounded-2xl border-2 border-dashed border-[#fcccdb] dark:border-[#7d0831] bg-white dark:bg-zinc-900 shadow-sm p-5 sm:p-6 flex flex-col justify-between"
      style={{
        backgroundImage: "radial-gradient(circle at 1.5px 1.5px, rgba(224,17,95,0.08) 1.5px, transparent 0)",
        backgroundSize: "20px 20px",
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-start gap-4">
        {/* Text column */}
        <div className="flex-1 min-w-0 space-y-2">
          <span className="inline-flex items-center gap-1.5 bg-[#fff1f5] dark:bg-[#3d0116] text-[#E0115F] dark:text-[#f55b8b] text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            📖 Word of the Moment
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">{slide.term}</h3>
            <span className="text-[10px] font-bold bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-2 py-0.5 rounded-full whitespace-nowrap">
              {meta.emoji} {meta.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed line-clamp-2">{slide.definition}</p>
          {slide.example_usage && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 italic line-clamp-1">{slide.example_usage}</p>
          )}
        </div>

        {/* Decorative / meme image column */}
        <div className="hidden md:flex flex-shrink-0 w-20 h-20 items-center justify-center">
          {memeUrl ? (
            <div className="bg-white p-1 rounded-lg shadow-md border border-gray-100 -rotate-3">
              <img src={memeUrl} alt={`${slide.term} meme example`} className="w-16 h-14 object-cover rounded" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#fff1f5] dark:bg-[#3d0116] border-2 border-[#fcccdb] dark:border-[#7d0831] flex items-center justify-center text-3xl rotate-3">
              {meta.emoji}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-4">
        <button
          onClick={() => onLearnMore?.(slide.term)}
          className="bg-[#E0115F] hover:bg-[#b00742] text-white font-extrabold px-4 py-2 rounded-xl text-xs transition shadow-sm"
        >
          Show me another word →
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            aria-label="Previous word"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 mx-0.5" role="tablist" aria-label="Slang slideshow">
            {slides.slice(0, 8).map((s, idx) => (
              <button
                key={s.id || s.term}
                role="tab"
                aria-selected={idx === activeIdx}
                aria-label={`Go to ${s.term}`}
                onClick={() => setActiveIdx(idx)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: idx === activeIdx ? "16px" : "6px",
                  height: "6px",
                  background: idx === activeIdx ? "#E0115F" : "#fcccdb",
                }}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            aria-label="Next word"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-zinc-400 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlangSlideshow;
