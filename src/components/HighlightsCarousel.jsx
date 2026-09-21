import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "../firebase";
import { highlightContentTypeMeta } from "../constants/contentHighlights";

// HighlightsCarousel — admin-curated cross-page highlights slideshow.
// Renders nothing until there's at least one active pick for `placement`, so
// pages that mount it never show an empty/placeholder section.
export default function HighlightsCarousel({ placement, title = "Highlights", className = "" }) {
  const navigate = useNavigate();
  const [highlights, setHighlights] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, "content_highlights"),
      where("placement", "==", placement),
      where("active", "==", true),
      orderBy("order", "asc")
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setHighlights(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => setHighlights([]));
    return () => unsubscribe();
  }, [placement]);

  useEffect(() => { setSlideIndex(0); }, [highlights.length]);

  useEffect(() => {
    if (highlights.length < 2) return;
    const timer = setInterval(() => {
      setSlideIndex((i) => (i + 1) % highlights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [highlights.length]);

  if (highlights.length === 0) return null;

  return (
    <div className={className}>
      <h2 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        <Sparkles className="w-3.5 h-3.5" /> {title}
      </h2>
      <div className="relative rounded-2xl overflow-hidden shadow-sm h-56 sm:h-72 md:h-80">
        {highlights.map((h, i) => {
          const meta = highlightContentTypeMeta(h.content_type);
          const displayImage = h.image_url || meta?.fallbackImage || "";
          const label = h.source_label || meta?.label || "";
          return (
            <div
              key={h.id}
              onClick={() => navigate(h.link)}
              className={`absolute inset-0 cursor-pointer bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-950/30 dark:to-purple-950/10 transition-opacity duration-700 ${i === slideIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
            >
              {displayImage ? (
                <>
                  {/* Blurred, scaled-up backdrop so the real image can be shown in full (object-contain)
                      without leaving bare letterbox bars on the sides. */}
                  <img
                    src={displayImage}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60"
                  />
                  <img src={displayImage} alt="" className="absolute inset-0 w-full h-full object-contain" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-12 h-12 opacity-60 text-purple-400" strokeWidth={1.25} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
              {label && (
                <span className="absolute top-3 left-3 text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-white/95 dark:bg-zinc-900/95 text-gray-800 dark:text-gray-100 shadow-sm">
                  {label}
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 pr-12">
                <h3 className="text-white font-extrabold text-base sm:text-lg leading-snug line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
                  {h.title}
                </h3>
              </div>
            </div>
          );
        })}

        {highlights.length > 1 && (
          <>
            <button
              onClick={() => setSlideIndex((i) => (i - 1 + highlights.length) % highlights.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition"
              aria-label="Previous highlight"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSlideIndex((i) => (i + 1) % highlights.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition"
              aria-label="Next highlight"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {highlights.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  aria-label={`Show highlight ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === slideIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
