import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  BookOpenCheck,
  Eye,
  MessageSquare,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Shared brand treatment across every slide (was a different accent color
// per slide before — unified to ruby so the carousel reads as one brand,
// with images/copy carrying the visual variety instead of clashing hues).
const RUBY_BADGE = "bg-white/10 border border-white/25 text-white backdrop-blur-sm";
const RUBY_CTA =
  "bg-gradient-to-r from-[#E0115F] to-[#b00742] hover:from-[#f55b8b] hover:to-[#c7094e] text-white shadow-[0_4px_18px_rgba(224,17,95,0.45)]";
const RUBY_HEX = "#E0115F";

// ─── Slide Data — why memes matter pedagogically, and how this platform
// helps, rather than promoting individual app pages one by one. ───────────
const SLIDES = [
  {
    id: "teaching-tools",
    category: "Why Memes Work",
    icon: Brain,
    title: "Memes as\nTeaching Tools",
    description:
      "Familiar and easy to grasp — memes turn a hard concept into something that sticks.",
    cta: "Explore Classroom Use Cases",
    ctaLink: "/resources",
    secondaryCta: "Also see: Meme Lab",
    secondaryLink: "/lab",
    image: "/slide-lab.jpg",
    imageAlt: "Students and teacher laughing at memes on a classroom screen",
    overlayGradient:
      "linear-gradient(to top, rgba(14,4,10,0.96) 0%, rgba(14,4,10,0.65) 35%, rgba(14,4,10,0.30) 60%, rgba(14,4,10,0.15) 100%)",
    accentHex: RUBY_HEX,
    badgeBg: RUBY_BADGE,
    ctaBg: RUBY_CTA,
  },
  {
    id: "critical-objects",
    category: "Critical Meme Literacy",
    icon: Eye,
    title: "Memes as\nCritical Objects",
    description:
      "Memes shape how people think fast — learn to spot the bias and tell satire from real misinformation.",
    cta: "Take the Meme Literacy Test",
    ctaLink: "/meme-literacy-test",
    secondaryCta: "Also see: The Newspaper",
    secondaryLink: "/newspaper",
    image: "/slide-literacy.jpg",
    imageAlt: "Student analysing memes with annotations on a screen",
    overlayGradient:
      "linear-gradient(to top, rgba(8,8,24,0.97) 0%, rgba(8,8,24,0.68) 35%, rgba(8,8,24,0.30) 60%, rgba(8,8,24,0.15) 100%)",
    accentHex: RUBY_HEX,
    badgeBg: RUBY_BADGE,
    ctaBg: RUBY_CTA,
  },
  {
    id: "learn-about",
    category: "Learn About Memes",
    icon: BookOpenCheck,
    title: "Learn With, On\n& About Memes",
    description:
      "See how memes communicate, and learn to read the ideas hidden inside them.",
    cta: "Browse the Newspaper",
    ctaLink: "/newspaper",
    secondaryCta: "Also see: Meme Literacy Test",
    secondaryLink: "/meme-literacy-test",
    image: "/slide-oer.jpg",
    imageAlt: "Open educational resources books and laptop in a library",
    overlayGradient:
      "linear-gradient(to top, rgba(8,12,4,0.97) 0%, rgba(8,12,4,0.65) 35%, rgba(8,12,4,0.28) 60%, rgba(8,12,4,0.12) 100%)",
    accentHex: RUBY_HEX,
    badgeBg: RUBY_BADGE,
    ctaBg: RUBY_CTA,
  },
  {
    id: "pedagogical-integration",
    category: "Pedagogical Integration",
    icon: Layers,
    title: "Grounded in Real\nClassroom Practice",
    description:
      "Courses, real classroom examples, activity guides, and research — all in one place.",
    cta: "Browse Teaching Resources",
    ctaLink: "/resources",
    image: "/slide-activities.jpg",
    imageAlt: "Students collaborating on meme creation activity on whiteboards",
    overlayGradient:
      "linear-gradient(to top, rgba(10,6,2,0.97) 0%, rgba(10,6,2,0.65) 35%, rgba(10,6,2,0.28) 60%, rgba(10,6,2,0.12) 100%)",
    accentHex: RUBY_HEX,
    badgeBg: RUBY_BADGE,
    ctaBg: RUBY_CTA,
  },
  {
    id: "share-reflect",
    category: "Educator Community",
    icon: MessageSquare,
    title: "Share Experiences\n& Reflect",
    description:
      "Swap what worked in class, remix templates in the Lab, and grow with other educators.",
    cta: "Join the Staffroom",
    ctaLink: "/staffroom",
    secondaryCta: "Also see: Meme Lab",
    secondaryLink: "/lab",
    image: "/slide-staffroom.jpg",
    imageAlt: "Diverse group of teachers sharing memes and laughing together",
    overlayGradient:
      "linear-gradient(to top, rgba(4,12,10,0.97) 0%, rgba(4,12,10,0.65) 35%, rgba(4,12,10,0.28) 60%, rgba(4,12,10,0.12) 100%)",
    accentHex: RUBY_HEX,
    badgeBg: RUBY_BADGE,
    ctaBg: RUBY_CTA,
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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label="Feature discovery carousel"
    >
      {/* ── Brand block (Badge + Title + Tagline) ─────────────────────────────
          Sits above the image on a solid theme-matching background so the
          title stays readable in both light and dark mode. The top padding
          leaves room for the floating Navbar icons. */}
      <div className="relative z-10 flex flex-col items-center justify-center pt-14 sm:pt-16 pb-4 sm:pb-6 px-4 text-center bg-[#FAFAF9] dark:bg-[#18181b]">
        {/* Badge */}
        <div className="inline-flex items-center px-3 sm:px-4 py-1 rounded-full bg-slate-900/5 dark:bg-white/10 backdrop-blur-sm border border-slate-300 dark:border-white/30 text-slate-700 dark:text-white text-[9px] sm:text-xs font-black uppercase tracking-[0.18em] mb-3 sm:mb-4">
          Open Pedagogical Resources for Memes
        </div>

        {/* Main title */}
        <h1 className="text-[clamp(2rem,6vw,4.25rem)] font-black tracking-[-0.03em] text-slate-900 dark:text-white leading-[1.02]">
          Meme
          <span className="text-ruby-600">Classroom</span>
        </h1>

        {/* Tagline */}
        <p className="mt-2 sm:mt-3 text-xs sm:text-sm lg:text-base font-semibold text-slate-600 dark:text-white/85 max-w-[300px] sm:max-w-md lg:max-w-lg leading-snug sm:leading-relaxed">
          MemeClassroom isn't a content silo — it's your space to learn, teach, and think critically with memes.
        </p>
      </div>

      {/* ── Hero card: the carousel sits in a large rounded card rather than
          spanning the full width, on the same solid background as the brand
          block. ─────────────────────────────────────────────────────────────── */}
      <div className="px-3 sm:px-6 lg:px-8 pb-2 bg-[#FAFAF9] dark:bg-[#18181b]">
      <div
        className="relative w-full max-w-6xl mx-auto overflow-hidden rounded-3xl sm:rounded-[2rem] shadow-[0_12px_40px_rgba(15,23,42,0.18)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        style={{ height: "clamp(340px, min(32vw, 100svh - 360px), 440px)" }}
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

        {/* ── Slide content (badge + title + description + CTA) ─────────────── */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end px-6 sm:px-12 md:px-16 pb-11 sm:pb-12"
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
            className="text-2xl sm:text-4xl lg:text-[2.3rem] font-black text-white leading-[1.1] tracking-tight mb-3 whitespace-pre-line"
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

          {/* CTA button + optional secondary link — stacks vertically on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Link
              to={slide.ctaLink}
              className={`inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-sm font-black transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${slide.ctaBg}`}
            >
              {slide.cta}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {slide.secondaryCta && slide.secondaryLink && (
              <Link
                to={slide.secondaryLink}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-white/85 hover:text-white underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors"
              >
                {slide.secondaryCta}
              </Link>
            )}
          </div>
        </div>

        {/* ── Prev / Next arrows (inside the image) ────────────────────────── */}
        <button
          onClick={goPrev}
          className="absolute left-3 sm:left-5 bottom-0.5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-20 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white hover:bg-black/50 hover:scale-110 transition-all duration-200 active:scale-95"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={goNext}
          className="absolute right-3 sm:right-5 bottom-0.5 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-20 flex items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white hover:bg-black/50 hover:scale-110 transition-all duration-200 active:scale-95"
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
      </div>
      </div>

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
