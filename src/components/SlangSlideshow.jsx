import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { SLANG_STARTER_WORDS } from "../data/slangStarterWords";

const CATEGORY_LABELS = {
  genz: "Gen Z",
  genalpha: "Gen Alpha",
  abbreviation: "Abbreviation",
  internet: "Internet Slang",
  other: "Slang",
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

// ─── Live, auto-advancing slideshow teasing slang terms ─────────────────────
// Sources real (admin-approved) contributed words from Firestore, merged with
// a bundled starter set — never static placeholder copy, and it keeps
// growing as more words get approved.
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

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-700 to-teal-800 text-white p-6 sm:p-8 shadow-lg shadow-teal-500/10 min-h-[220px] flex flex-col justify-between"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative z-10 space-y-2.5">
        <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md text-teal-50 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
          <Sparkles className="w-3 h-3" /> {CATEGORY_LABELS[slide.category] || "Slang"}
        </span>
        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{slide.term}</h3>
        <p className="text-sm text-teal-50/90 leading-relaxed max-w-xl line-clamp-2">{slide.definition}</p>
        {slide.example_usage && (
          <p className="text-xs text-teal-100/70 italic max-w-xl line-clamp-1">{slide.example_usage}</p>
        )}
      </div>

      <div className="relative z-10 flex items-center justify-between pt-4">
        <button
          onClick={() => onLearnMore?.(slide.term)}
          className="bg-white text-teal-700 font-extrabold px-4 py-2 rounded-xl text-xs hover:bg-teal-50 transition shadow-md"
        >
          Learn more words like this →
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            aria-label="Previous word"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition"
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
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="absolute right-4 bottom-4 text-7xl sm:text-8xl opacity-10 pointer-events-none select-none">
        🗣️
      </div>
    </div>
  );
};

export default SlangSlideshow;
