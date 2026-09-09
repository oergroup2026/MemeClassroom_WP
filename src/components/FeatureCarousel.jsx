import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FlaskConical,
  BookOpenCheck,
  Eye,
  Award,
  MessageSquare,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
      "linear-gradient(to top, rgba(14,4,10,0.93) 0%, rgba(14,4,10,0.55) 42%, rgba(14,4,10,0.12) 70%, transparent 100%), linear-gradient(105deg, rgba(224,17,95,0.35) 0%, transparent 55%)",
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
      "linear-gradient(to top, rgba(8,8,24,0.95) 0%, rgba(8,8,24,0.58) 40%, rgba(8,8,24,0.15) 68%, transparent 100%), linear-gradient(105deg, rgba(79,70,229,0.30) 0%, transparent 55%)",
    accentHex: "#6366f1",
    badgeBg: "bg-indigo-500/20 border border-indigo-400/40 text-indigo-300",
    ctaBg:
      "bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white shadow-[0_4px_18px_rgba(99,102,241,0.4)]",
  },
  {
    id: "activities",
    category: "Activities",
    icon: FlaskConical,
    title: "Real Lessons.\nReal Engagement.",
    description:
      "Classroom activity guides built on meme pedagogy. From icebreakers to critical discussion starters.",
    cta: "Explore Activities",
    ctaLink: "/resources",
    image: "/slide-activities.jpg",
    imageAlt: "Students collaborating on meme creation activity on whiteboards",
    overlayGradient:
      "linear-gradient(to top, rgba(10,6,2,0.94) 0%, rgba(10,6,2,0.52) 42%, rgba(10,6,2,0.10) 68%, transparent 100%), linear-gradient(105deg, rgba(234,88,12,0.28) 0%, transparent 55%)",
    accentHex: "#f97316",
    badgeBg: "bg-orange-500/20 border border-orange-400/40 text-orange-300",
    ctaBg:
      "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white shadow-[0_4px_18px_rgba(249,115,22,0.4)]",
  },
  {
    id: "oer",
    category: "OER Resources",
    icon: BookOpenCheck,
    title: "Free. Open.\nResearch-Backed.",
    description:
      "Curriculum modules, lesson plans, case studies & peer-reviewed research. 100% free to use, remix & share.",
    cta: "Browse OER Library",
    ctaLink: "/resources",
    image: "/slide-oer.jpg",
    imageAlt: "Open educational resources books and laptop in a library",
    overlayGradient:
      "linear-gradient(to top, rgba(8,12,4,0.94) 0%, rgba(8,12,4,0.54) 42%, rgba(8,12,4,0.12) 68%, transparent 100%), linear-gradient(105deg, rgba(16,185,129,0.25) 0%, transparent 55%)",
    accentHex: "#10b981",
    badgeBg: "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300",
    ctaBg:
      "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-[0_4px_18px_rgba(16,185,129,0.4)]",
  },
  {
    id: "staffroom",
    category: "Community",
    icon: MessageSquare,
    title: "Share. Reflect.\nGrow Together.",
    description:
      "A dedicated space for educators to exchange classroom experiences, co-create and build on each other insights.",
    cta: "Join the Staffroom",
    ctaLink: "/staffroom",
    image: "/slide-staffroom.jpg",
    imageAlt: "Diverse group of teachers sharing memes and laughing together",
    overlayGradient:
      "linear-gradient(to top, rgba(4,12,10,0.95) 0%, rgba(4,12,10,0.56) 42%, rgba(4,12,10,0.12) 68%, transparent 100%), linear-gradient(105deg, rgba(20,184,166,0.28) 0%, transparent 55%)",
    accentHex: "#14b8a6",
    badgeBg: "bg-teal-500/20 border border-teal-400/40 text-teal-300",
    ctaBg:
      "bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-500 hover:to-cyan-600 text-white shadow-[0_4px_18px_rgba(20,184,166,0.4)]",
  },
];

const FeatureCarousel = () => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [direction, setDirection] = useState("right");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [textVisible, setTextVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const carouselRef = useRef(null);

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

  const goNext = useCallback(() => {
    navigateTo((activeIdx + 1) % SLIDES.length, "right");
  }, [activeIdx, navigateTo]);

  const goPrev = useCallback(() => {
    navigateTo((activeIdx - 1 + SLIDES.length) % SLIDES.length, "left");
  }, [activeIdx, navigateTo]);

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
      className="relative w-full max-w-5xl mx-auto px-4 select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Feature discovery carousel"
    >
      <div
        ref={carouselRef}
        className="relative w-full mx-auto overflow-hidden rounded-3xl shadow-xl border border-gray-200/40 dark:border-zinc-800/40"
        style={{ height: "clamp(320px, 45vw, 490px)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {SLIDES.map((s, idx) => {
          const SIcon = s.icon;
          return (
            <div
              key={s.id}
              className="absolute inset-0"
              style={{
                opacity: idx === activeIdx ? 1 : 0,
                transform: idx === activeIdx ? "scale(1.0)" : "scale(1.04)",
                transition:
                  "opacity 0.55s cubic-bezier(0.4,0,0.2,1), transform 0.7s cubic-bezier(0.4,0,0.2,1)",
                willChange: "opacity, transform",
              }}
            >
              <img
                src={s.image}
                alt={s.imageAlt}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
                loading={idx === 0 ? "eager" : "lazy"}
              />
              <div
                className="absolute inset-0"
                style={{ background: s.overlayGradient }}
              />
            </div>
          );
        })}

        <div
          className="absolute inset-0 flex flex-col justify-end px-6 sm:px-10 pb-8 sm:pb-12 z-10"
          style={{
            opacity: textVisible ? 1 : 0,
            transform: textVisible
              ? "translateY(0)"
              : direction === "right"
              ? "translateY(10px)"
              : "translateY(-10px)",
            transition:
              "opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm ${slide.badgeBg}`}
            >
              <SlideIcon className="w-3 h-3" />
              {slide.category}
            </span>
          </div>

          <h2
            className="text-2xl sm:text-4xl lg:text-[2.75rem] font-black text-white leading-[1.1] tracking-tight mb-3 whitespace-pre-line"
            style={{ textShadow: "0 2px 16px rgba(0,0,0,0.6)" }}
          >
            {slide.title}
          </h2>

          <p
            className="text-sm sm:text-base text-white/80 font-medium leading-snug mb-5 max-w-lg"
            style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
          >
            {slide.description}
          </p>

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

        <button
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white hover:bg-black/50 hover:scale-110 transition-all duration-200 active:scale-95"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 hidden sm:flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md border border-white/15 text-white hover:bg-black/50 hover:scale-110 transition-all duration-200 active:scale-95"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="absolute top-5 right-5 z-20 hidden sm:flex items-center gap-1 bg-black/30 backdrop-blur-md rounded-full px-3 py-1 text-[11px] font-black text-white/70 border border-white/10">
          <span className="text-white">{activeIdx + 1}</span>
          <span className="opacity-40 mx-0.5">/</span>
          <span>{SLIDES.length}</span>
        </div>

        <div
          className="absolute inset-0 rounded-3xl pointer-events-none z-20"
          style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        />
      </div>

      <div
        className="flex items-center gap-2 mt-4 px-1"
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
            className="relative flex-1 h-[5px] rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-700 transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1"
            style={{
              flexGrow: idx === activeIdx ? 2.5 : 1,
            }}
          >
            {idx === activeIdx && (
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: slide.accentHex,
                  animation: isPaused
                    ? "none"
                    : "featureCarouselFill 6.5s linear forwards",
                  width: isPaused ? "40%" : undefined,
                }}
              />
            )}
            {idx < activeIdx && (
              <span
                className="absolute inset-0 rounded-full"
                style={{ background: "rgba(224,17,95,0.45)" }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2.5 sm:hidden px-1">
        <span
          className="text-[11px] font-black uppercase tracking-widest"
          style={{ color: slide.accentHex }}
        >
          {slide.category}
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-semibold">
          {activeIdx + 1} / {SLIDES.length}
        </span>
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
