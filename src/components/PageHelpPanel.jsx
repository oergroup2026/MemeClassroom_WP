import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { HELP_PANEL_CONTENT } from "../constants/helpPanelContent";
import { 
  HelpCircle, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Lightbulb, 
  Play, 
  ExternalLink,
  BookOpen
} from "lucide-react";

/**
 * Slide-out help drawer and floating '?' button available on every major page.
 * Displays page-specific instructions, tips, and allows replaying the interactive tour.
 */
const PageHelpPanel = ({ pageKey, onRestartTour, hasSkippedTour = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const content = HELP_PANEL_CONTENT[pageKey] || HELP_PANEL_CONTENT.home;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-24 right-5 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="relative group p-3 bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 hover:text-white hover:bg-purple-600 dark:hover:bg-purple-600 rounded-full shadow-lg border border-purple-200 dark:border-zinc-700 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Page Help & Step-by-Step Guide"
          aria-label="Open page help guide"
        >
          <HelpCircle className="w-5 h-5" />

          {/* Pulsing indicator dot if user skipped the tour */}
          {hasSkippedTour && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white dark:border-zinc-800" />
            </span>
          )}

          {/* Hover Tooltip */}
          <span className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-bold rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Page Guide & Tips
          </span>
        </button>
      </div>

      {/* Slide-out Drawer (Portal) */}
      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] overflow-hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div className="w-screen max-w-md bg-white dark:bg-zinc-900 shadow-2xl border-l border-gray-200 dark:border-zinc-800 flex flex-col justify-between animate-in slide-in-from-right duration-200">
                
                {/* Panel Header */}
                <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                        {content.title}
                      </h2>
                      <p className="text-xs text-gray-400">
                        Help, Features & Instructions
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
                    aria-label="Close help panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
                  {/* Summary */}
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100 uppercase text-[11px] tracking-wider text-purple-600 dark:text-purple-400">
                      Overview
                    </h3>
                    <p className="text-gray-600 dark:text-zinc-300 leading-relaxed">
                      {content.summary}
                    </p>
                  </div>

                  {/* Key Actions List */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-900 dark:text-zinc-100 uppercase text-[11px] tracking-wider text-purple-600 dark:text-purple-400">
                      What You Can Do Here
                    </h3>
                    <ul className="space-y-2.5">
                      {content.keyActions.map((action, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-gray-600 dark:text-zinc-300">
                          <CheckCircle2 className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Quick Tip Box */}
                  {content.quickTip && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span>Helpful Tip</span>
                      </div>
                      <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
                        {content.quickTip}
                      </p>
                    </div>
                  )}

                  {/* Action to Replay Tour */}
                  {onRestartTour && (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onRestartTour();
                        }}
                        className="w-full py-2.5 px-4 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl font-bold text-xs hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Replay Interactive Step-by-Step Tour</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Footer Links */}
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <Link
                    to="/about"
                    onClick={() => setIsOpen(false)}
                    className="text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Pedagogical Framework</span>
                  </Link>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 font-semibold"
                  >
                    Close
                  </button>
                </div>

              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default PageHelpPanel;
