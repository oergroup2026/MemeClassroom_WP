import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { Sparkles, ArrowRight, Check, X, GraduationCap, Users, Compass, HelpCircle } from "lucide-react";

/**
 * 3-Slide First-Time User Welcome Modal.
 * Tailored to the user's role without requiring repetitive questions.
 */
const WelcomeModal = () => {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  const storageKey = "memeclassroom_welcomed_v1";

  useEffect(() => {
    // Only show if user is authenticated and hasn't seen the welcome modal yet
    if (user) {
      try {
        const hasWelcomed = localStorage.getItem(storageKey);
        if (!hasWelcomed) {
          // Open modal with short delay
          const t = setTimeout(() => setIsOpen(true), 800);
          return () => clearTimeout(t);
        }
      } catch (e) {}
    }
  }, [user]);

  const handleClose = () => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch (e) {}
    setIsOpen(false);
  };

  if (!isOpen || !user) return null;

  const role = profile?.role || "teacher";
  const displayName = profile?.name || user?.displayName || "Educator";

  // Slide content based on persona
  const slides = [
    // Slide 1: Welcome & Persona Role
    {
      badge: role === "student" ? "Learner Space" : role === "expert" ? "Academic & Research" : "Educator Space",
      title: `Welcome, ${displayName}!`,
      description:
        role === "student"
          ? "MemeClassroom is your space to learn subjects through humor, build creative meme projects, and sharpen your critical media literacy."
          : role === "expert"
          ? "Welcome to our open pedagogical community! Discover research papers, publish lesson frameworks, and collaborate with educators worldwide."
          : "Welcome! MemeClassroom helps you turn digital culture into engaging classroom lessons, with peer-rated memes, multi-format tools, and shared teaching strategies.",
      icon:
        role === "student" ? (
          <Users className="w-8 h-8 text-indigo-500" />
        ) : role === "expert" ? (
          <Compass className="w-8 h-8 text-teal-500" />
        ) : (
          <GraduationCap className="w-8 h-8 text-purple-500" />
        ),
    },

    // Slide 2: Tailored Power Tip
    {
      badge: "Quick Recommendation",
      title: "Where to start?",
      description:
        role === "student"
          ? "Browse the Meme Library by your grade and subject. Don't get a reference? Click 'AI Explain' on any meme to deconstruct its meaning!"
          : role === "expert"
          ? "Visit Meme Reads to access scholarly publications, or contribute your own tested lesson plans and activity matrices to the community."
          : "Explore the Meme Library for peer-rated memes matched to your syllabus, or open the Meme Lab to generate custom visual prompts for your class.",
      icon: <Sparkles className="w-8 h-8 text-amber-500" />,
    },

    // Slide 3: Always-on Help & Confidence
    {
      badge: "You're All Set",
      title: "Guidance is always available",
      description:
        "Every page includes an interactive step-by-step tour on your first visit. You can also click the '?' Help button at the bottom-right anytime for quick instructions.",
      icon: <HelpCircle className="w-8 h-8 text-emerald-500" />,
    },
  ];

  const current = slides[slide];

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={handleClose} 
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-purple-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top bar with close button */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-full">
            {current.badge}
          </span>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            aria-label="Skip welcome"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Center Icon & Title */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-zinc-800/80 border border-gray-100 dark:border-zinc-700/60 flex items-center justify-center mx-auto shadow-sm">
            {current.icon}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">
            {current.title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed max-w-sm mx-auto">
            {current.description}
          </p>
        </div>

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-800">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === slide
                    ? "w-6 bg-purple-600 dark:bg-purple-400"
                    : "w-1.5 bg-gray-200 dark:bg-zinc-700"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {slide < slides.length - 1 ? (
              <button
                onClick={() => setSlide((prev) => prev + 1)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md transition-all inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition-all inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95"
              >
                <span>Let's Explore!</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default WelcomeModal;
