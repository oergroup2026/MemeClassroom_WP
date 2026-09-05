import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";

/**
 * Lightweight, non-intrusive spotlight tooltip component for first-time user guidance.
 * Automatically tracks target element positions and provides smooth navigation.
 */
const TourOverlay = ({
  isOpen,
  currentStep,
  totalSteps,
  stepData,
  pageTitle,
  onNext,
  onPrev,
  onSkip,
}) => {
  const [targetRect, setTargetRect] = useState(null);
  const cardRef = useRef(null);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onSkip();
      } else if (e.key === "ArrowRight") {
        onNext();
      } else if (e.key === "ArrowLeft") {
        onPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onNext, onPrev, onSkip]);

  // Target element bounding box tracker
  useEffect(() => {
    if (!isOpen || !stepData?.targetId) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.getElementById(stepData.targetId);
      if (el) {
        // Smooth scroll element into view if not visible
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        const r = el.getBoundingClientRect();
        setTargetRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          bottom: r.bottom,
          right: r.right,
        });
      } else {
        setTargetRect(null);
      }
    };

    // Give a brief delay for scroll & render
    const t = setTimeout(updateRect, 150);
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [isOpen, stepData]);

  if (!isOpen || !stepData || typeof document === 'undefined' || !document.body) return null;

  const isLastStep = currentStep === totalSteps - 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dimmed backdrop with cutout / focus */}
      <div 
        className="fixed inset-0 bg-black/45 dark:bg-black/60 transition-opacity duration-300 pointer-events-auto"
        onClick={onSkip}
      />

      {/* Target Element Highlight Outline */}
      {targetRect && (
        <div
          className="fixed rounded-xl border-2 border-purple-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] dark:shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all duration-300 pointer-events-none animate-pulse"
          style={{
            top: `${Math.max(8, targetRect.top - 6)}px`,
            left: `${Math.max(8, targetRect.left - 6)}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`,
            animationDuration: "3s",
          }}
        />
      )}

      {/* Tour Step Card (Positioned centered or near element) */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          ref={cardRef}
          className="w-full max-w-md bg-white dark:bg-zinc-900 border border-purple-200 dark:border-zinc-700 rounded-2xl shadow-2xl p-6 pointer-events-auto space-y-4 animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header with Step Indicator and Close Button */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                {pageTitle} · Quick Guide
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 tabular-nums">
                {currentStep + 1} of {totalSteps}
              </span>
              <button
                onClick={onSkip}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Skip tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="space-y-2">
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              {stepData.title}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
              {stepData.content}
            </p>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-zinc-800">
            {/* Step Dots */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep
                      ? "w-5 bg-purple-600 dark:bg-purple-400"
                      : "w-1.5 bg-gray-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={onPrev}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
              )}

              <button
                onClick={onNext}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-md transition-all duration-150 inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95"
              >
                <span>{isLastStep ? "Got it!" : "Next"}</span>
                {isLastStep ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TourOverlay;
