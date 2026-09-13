import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FlaskConical,
  BookOpenCheck,
  Eye,
  MessageSquare,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ─── Slide Data (source of truth: homepage_content.md Section 1) ───────────
const SLIDES = [
  {
    id: "lab",
    category: "Meme Lab",
    icon: FlaskConical,
    title: "Create. Remix.\nTeach Visually.",
    description:
      "Multi-format editor for images, GIFs, video & audio. Craft pedagogical memes with auto-captions.",
    cta: "Open Meme Lab",
    ctaLink: "/lab",
    image: "/slide-lab.jpg",
    imageAlt: "Students and teacher laughing at memes on a classroom screen",
    overlayGradient:
      "linear-gradient(to top, rgba(14,4,10,0.96) 0%, rgba(14,4,10,0.65) 35%, rgba(14,4,10,0.30) 60%, rgba(14,4,10,0.15) 100%)",
    accentHex: "#E0115F",
    badgeBg: "bg-rose-500/20 border border-rose-400/40 text-rose-300",
    ctaBg:
      "bg-gradient-to-r from-[#E0115F] to-[#b00742] hover:from-[#f55b8b] hover:to-[#c7094e] text-white shadow-[0_4px_18px_rgba(224,17,95,0.45)]",
  },
  {
    id: "literacy",
    category: "Media Literacy",
    icon: Eye,
    title: "Decode Bias.\nThink Critically.",
    description:
      "Evaluate visual rhetoric, subtext & satire across 6 key dimensions. Earn a shareable digital literacy badge.",
    cta: "Take Literacy Test",
    ctaLink: "/meme-literacy-test",
    image: "/slide-literacy.jpg",
    imageAlt: "Student analysing memes with annotations on a screen",
    overlayGradient:
      "linear-gradient(to top, rgba(8,8,24,0.97) 0%, rgba(8,8,24,0.68) 35%, rgba(8,8,24,0.30) 60%, rgba(8,8,24,0.15) 100%)",
    accentHex: "#6366f1",
    badgeBg: "bg-indigo-500/20 border border-indigo-400/40 text-indigo-300",
    ctaBg:
      "bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white shadow-[0_4px_18px_rgba(99,102,241,0.4)]",
  },
  {
    id: "activities",
    category: "Activities",
    icon: Layers,
    title: "Real Lessons.\nReal Engagement.",
    description:
      "Classroom activity guides built on meme pedagogy. From icebreakers to critical discussion starters.",
    cta: "Explore Activities",
    ctaLink: "/resources",
    image: "/slide-activities.jpg",
    imageAlt: "Students collaborating on meme creation activity on whiteboards",
    overlayGradient:
      "linear-gradient(to top, rgba(10,6,2,0.97) 0%, rgba(10,6,2,0.65) 35%, rgba(10,6,2,0.28) 60%, rgba(10,6,2,0.12) 100%)",
    accentHex: "#f97316",
    badgeBg: "bg-orange-500/20 border border-orange-400/40 text-orange-300",
    ctaBg:
      "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white shadow-[0_4px_18px_rgba(249,115,22,0.4)]",
  },
  {
    id: "oer",
    category: "OER Resources",
    icon: BookOpenCheck,
    title: "Open Materials.\nFree Forever.",
    description:
      "Peer-rated memes, classroom use cases, syllabus modules & open courseware. Adapt, remix & use freely.",
    cta: "Browse Resources",
    ctaLink: "/resources",
    image: "/slide-oer.jpg",
    imageAlt: "Open educational resources books and laptop in a library",
    overlayGradient:
      "linear-gradient(to top, rgba(8,12,4,0.97) 0%, rgba(8,12,4,0.65) 35%, rgba(8,12,4,0.28) 60%, rgba(8,12,4,0.12) 100%)",
    accentHex: "#10b981",
    badgeBg: "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300",
    ctaBg:
      "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-[0_4px_18px_rgba(16,185,129,0.4)]",
  },
  {
    id: "staffroom",
    category: "Staffroom",
    icon: MessageSquare,
    title: "Connect. Reflect.\nGrow Together.",
    description:
      "Join a community of educators sharing classroom experiments, reflections, and best practices.",
    cta: "Join Staffroom",
    ctaLink: "/staffroom",
    image: "/slide-staffroom.jpg",
    imageAlt: "Diverse group of teachers sharing memes and laughing together",
    overlayGradient:
      "linear-gradient(to top, rgba(4,12,10,0.97) 0%, rgba(4,12,10,0.65) 35%, rgba(4,12,10,0.28) 60%, rgba(4,12,10,0.12) 100%)",
    accentHex: "#14b8a6",
    badgeBg: "bg-teal-500/20 border border-teal-400/40 text-teal-300",
    ctaBg:
      "bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-500 hover:to-cyan-600 text-white shadow-[0_4px_18px_rgba(20,184,166,0.4)]",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const FeatureCarousel = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [direction, setDirection] = useState("right");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [textVisible, setTextVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // Auto-advance
  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      navigateTo((activeIdx + 1) % SLIDES.length, "right");
    }, 6500);
    return () => clearInterval(id);
  }, [activeIdx, isPaused]);

  const navigateTo = useCallback(
    (newIdx, dir = "right") => {
      if (isTransitioning || newIdx === activeIdx) return;
      setDirection(dir);
      setTextVisible(false);
      setIsTransitioning(true);

      setTimeout(() => {
        setActiveIdx(newIdx);
      }, 260);

      setTimeout(() => {
        setTextVisible(true);
        setIsTransitioning(false);
      }, 520);
    },
    [activeIdx, isTransitioning]
  );

  const goNext = useCallback(
    () => navigateTo((activeIdx + 1) % SLIDES.length, "right"),
    [activeIdx, navigateTo]
  );

  const goPrev = useCallback(
    () => navigateTo((activeIdx - 1 + SLIDES.length) % SLIDES.length, "left"),
    [activeIdx, navigateTo]
  );

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 50 && dy < 60) {
      if (dx < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
    setTimeout(() => setIsPaused(false), 3000);
  };

  const slide = SLIDES[activeIdx];
  const SlideIcon = slide.icon;

  return (
    <section
      className="relative w-full select-none"
      style={{ minHeight: "clamp(480px, 85vw, 680px)" }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Feature discovery carousel"
    >
      {/* ── Background image layers (cross-fade) ─────────────────────────── */}
      {SLIDES.map((s, idx) => (
        <div
          key={s.id}
          className="absolute inset-0"
          style={{
            opacity: idx === activeIdx ? 1 : 0,
            transform: idx === activeIdx ? "scale(1.0)" : "scale(1.04)",
            transition:
              "opacity 0.6s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1)",
            willChange: "opacity, transform",
          }}
          aria-hidden={idx !== activeIdx}
        >
          <img
            src={s.image}
            alt={s.imageAlt}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
            loading={idx === 0 ? "eager" : "lazy"}
          />
          {/* Per-slide gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: s.overlayGradient }}
          />
        </div>
      ))}

      {/* ── Top header overlay (logo + nav icons) ────────────────────────── */}
      {/* NOTE: The actual Navbar renders above this in the DOM.
               This spacer keeps content from hiding under it. */}

      {/* ── Hero branding block (Badge + Title + Tagline) ────────────────── */}
      <div className="absolute inset-x-0 top-0 z-10 flex flex-col items-center justify-center pt-12 sm:pt-16 px-4 text-center pointer-events-none">
        {/* Badge */}
        <div className="inline-flex items-center px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/25 text-white/90 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-4">
          Open Pedagogical Resources for Memes
        </div>

        {/* Main title */}
        <h1
          className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.7)" }}
        >
          Meme
          <span className="text-[#E0115F]">Classroom</span>
        </h1>

        {/* Tagline */}
        <p
          className="mt-3 text-sm sm:text-base font-semibold text-white/80 max-w-lg leading-snug"
          style={{ textShadow: "0 1px 10px rgba(0,0,0,0.6)" }}
        >
          A collaborative space to learn, co-create and share meme pedagogy.
        </p>
      </div>

      {/* ── Slide content (badge + title + description + CTA) ─────────────── */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end px-5 sm:px-10 md:px-16 pb-12 sm:pb-16"
        style={{
          opacity: textVisible ? 1 : 0,
          transform: textVisible
            ? "translateY(0)"
            : direction === "right"
            ? "translateY(14px)"
            : "translateY(-14px)",
          transition:
            "opacity 0.32s cubic-bezier(0.4,0,0.2,1), transform 0.32s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Slide badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm ${slide.badgeBg}`}
          >
            <SlideIcon className="w-3 h-3" />
            {slide.category}
          </span>
        </div>

        {/* Slide title */}
        <h2
          className="text-2xl sm:text-4xl lg:text-[2.6rem] font-black text-white leading-[1.1] tracking-tight mb-3 whitespace-pre-line"
          style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7)" }}
        >
          {slide.title}
        </h2>

        {/* Slide description */}
        <p
          className="text-sm sm:text-base text-white/80 font-medium leading-snug mb-5 max-w-md"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}
        >
          {slide.description}
        </p>

        {/* CTA button */}
        <div>
          <Link
            to={slide.ctaLink}
            className={`inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-sm font-black transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${slide.ctaBg}`}
          >
            {slide.cta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── Prev / Next arrows (inside the image) ────────────────────────── */}
      <button
        onClick={goPrev}
        className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white hover:bg-black/50 hover:scale-110 transition-all duration-200 active:scale-95"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={goNext}
        className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white hover:bg-black/50 hover:scale-110 transition-all duration-200 active:scale-95"
        aria-label="Next slide"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* ── Dot indicators (bottom-center, above CTA area) ────────────────── */}
      <div
        className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
        role="tablist"
        aria-label="Carousel slides"
      >
        {SLIDES.map((s, idx) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={idx === activeIdx}
            aria-label={`Go to ${s.category}`}
            onClick={() =>
              navigateTo(idx, idx > activeIdx ? "right" : "left")
            }
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 transition-all duration-300"
            style={{
              width: idx === activeIdx ? "24px" : "8px",
              height: "8px",
              borderRadius: "4px",
              background:
                idx === activeIdx
                  ? slide.accentHex
                  : idx < activeIdx
                  ? "rgba(255,255,255,0.55)"
                  : "rgba(255,255,255,0.25)",
              boxShadow:
                idx === activeIdx
                  ? `0 0 8px ${slide.accentHex}88`
                  : "none",
            }}
          />
        ))}
      </div>

      {/* ── Subtle inner border vignette ─────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
      />

      <style>{`
        @keyframes featureCarouselFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </section>
  );
};

export default FeatureCarousel;
