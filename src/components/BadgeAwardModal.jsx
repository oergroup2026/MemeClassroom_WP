import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Clean Badge Award Modal Popup
 * Displays verified badge image from /badge-verify.png, badge title "Contributor",
 * profile completion progress bar (55%), and "Finish Setup Now" / "I'll Do Later" actions.
 */
const BadgeAwardModal = () => {
  const [badgeData, setBadgeData] = useState(null);

  useEffect(() => {
    // Check for pending badge popup in session storage on mount
    try {
      const stored = sessionStorage.getItem("mc_pending_badge_popup");
      if (stored) {
        setBadgeData(JSON.parse(stored));
        sessionStorage.removeItem("mc_pending_badge_popup");
      }
    } catch (e) {
      console.error("Error reading pending badge popup", e);
    }

    // Listen for real-time badge earned events
    const handleBadgeEarned = (event) => {
      if (event.detail) {
        setBadgeData(event.detail);
      }
    };

    window.addEventListener("mc_badge_earned", handleBadgeEarned);
    return () => {
      window.removeEventListener("mc_badge_earned", handleBadgeEarned);
    };
  }, []);

  if (!badgeData) return null;

  const handleClose = () => {
    setBadgeData(null);
  };

  const handleFinishSetupNow = () => {
    setBadgeData(null);
    try {
      window.sessionStorage.removeItem("mc_skip_setup");
      window.dispatchEvent(new CustomEvent("mc_open_account_setup"));
    } catch (e) {
      console.error("Failed to open setup modal", e);
    }
  };

  const badgeTitle = badgeData.badgeName || "Contributor";
  const isAuthorized = badgeTitle === "Authorized" || badgeTitle === "Authorised User" || badgeTitle === "authorized" || Boolean(profile?.setup_completed);
  const completionPercentage = isAuthorized ? 100 : (badgeData.progress || 55);

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center p-4">
      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Simple Dialog Card */}
      <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-5 text-center animate-in zoom-in-95 fade-in duration-200">

        {/* Star Medal Badge Image from /star-medal.png */}
        <div className="flex justify-center">
          <img
            src="/star-medal.png"
            alt="Star Medal Badge"
            className="w-20 h-20 object-contain drop-shadow-md"
          />
        </div>

        {/* Text Section */}
        <div className="space-y-1">
          <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
            you earned a badge
          </p>

          <h3 className="text-3xl font-extrabold text-pink-600 dark:text-pink-400 tracking-tight">
            {badgeTitle}
          </h3>
        </div>

        {/* Progress Bar Section (Only for Contributor / incomplete setup badges) */}
        {!isAuthorized && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-xs font-semibold text-gray-600 dark:text-zinc-300">
              <span>Profile Completion</span>
              <span className="font-extrabold text-pink-600 dark:text-pink-400">{completionPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-pink-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons: Authorized gets 'Continue', Contributor gets 'Finish Now' / 'I'll Do Later' */}
        {isAuthorized ? (
          <div className="pt-2">
            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-500/20 transition active:scale-95 cursor-pointer"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
            <button
              onClick={handleFinishSetupNow}
              className="w-full py-2.5 px-4 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-500/20 transition active:scale-95 cursor-pointer"
            >
              Finish Now
            </button>
            <button
              onClick={handleClose}
              className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 font-semibold text-xs rounded-xl transition active:scale-95 cursor-pointer"
            >
              I'll Do Later
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
};

export default BadgeAwardModal;
