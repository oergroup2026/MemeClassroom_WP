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
// Deliberately styled as a flashcard (dashed border, dot-pattern, polaroid
// image corner) rather than a plain gradient banner, so it reads clearly as
// "browse a word" rather than a repeat of the quiz CTA banner above it.
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
      className="relative rounded-[28px] border-2 border-dashed border-fuchsia-300 dark:border-fuchsia-700 bg-white dark:bg-zinc-900 p-1.5 shadow-lg shadow-fuchsia-500/10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-fuchsia-600 via-pink-600 to-orange-500 text-white p-5 sm:p-7"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.18) 1.5px, transparent 0), linear-gradient(to bottom right, #c026d3, #db2777, #f97316)",
          backgroundSize: "20px 20px, 100% 100%",
        }}
      >
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Text column */}
          <div className="flex-1 min-w-0 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 bg-white text-fuchsia-700 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
              📖 Word of the Moment
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{slide.term}</h3>
              <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                {meta.emoji} {meta.label}
              </span>
            </div>
            <p className="text-sm text-white/90 leading-relaxed max-w-xl line-clamp-2">{slide.definition}</p>
            {slide.example_usage && (
              <p className="text-xs text-white/70 italic max-w-xl line-clamp-1">{slide.example_usage}</p>
            )}
            <button
              onClick={() => onLearnMore?.(slide.term)}
              className="mt-1 bg-white text-fuchsia-700 font-extrabold px-4 py-2 rounded-xl text-xs hover:bg-fuchsia-50 transition shadow-md"
            >
              Show me another word →
            </button>
          </div>

          {/* Decorative / meme image column */}
          <div className="hidden sm:flex flex-shrink-0 w-32 h-32 items-center justify-center">
            {memeUrl ? (
              <div className="bg-white p-1.5 rounded-lg shadow-xl -rotate-3">
                <img src={memeUrl} alt={`${slide.term} meme example`} className="w-28 h-24 object-cover rounded" />
                <p className="text-[8px] text-center text-gray-500 mt-0.5 font-semibold">used in memes 👆</p>
              </div>
            ) : (
              <div className="w-28 h-28 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center text-5xl rotate-3">
                {meta.emoji}
              </div>
            )}
          </div>
        </div>

        {/* Nav controls */}
        <div className="flex items-center justify-end gap-2 pt-4 relative z-10">
          <button
            onClick={goPrev}
            aria-label="Previous word"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/25 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="hidden sm:flex items-center gap-1.5 mx-1" role="tablist" aria-label="Slang slideshow">
            {slides.slice(0, 8).map((s, idx) => (
              <button
                key={s.id || s.term}
                role="tab"
                aria-selected={idx === activeIdx}
                aria-label={`Go to ${s.term}`}
                onClick={() => setActiveIdx(idx)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: idx === activeIdx ? "18px" : "6px",
                  height: "6px",
                  background: idx === activeIdx ? "#fff" : "rgba(255,255,255,0.35)",
                }}
              />
            ))}
          </div>
          <button
            onClick={goNext}
            aria-label="Next word"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/15 hover:bg-black/25 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlangSlideshow;
