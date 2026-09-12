import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { X, Sparkles, Check, GraduationCap, Users, Compass, BookOpen, UserCheck } from "lucide-react";

const ROLES_LIST = [
  { id: "student", label: "Student", desc: "Discover memes that explain concepts" },
  { id: "teacher", label: "Teacher", desc: "Share resources & lesson plans" },
  { id: "research", label: "Research", desc: "Explore academic & multimodal research" },
  { id: "parent", label: "Parent", desc: "Guide student learning & digital literacy" },
  { id: "other", label: "Other", desc: "Explore MemeClassroom community" },
];

const CHIPS_TEACHER = ["School / High School", "University / College", "Independent Educator", "Coaching Center"];
const CHIPS_STUDENT = ["School / High School", "University / College", "Self Learner", "Coaching Student"];

/**
 * Centered Account Setup Modal Popup (matching guide overlays like WelcomeModal & TourOverlay).
 * Appears for authenticated users who haven't completed profile setup.
 */
const DeferredSetupBanner = () => {
  const { user, profile, updateUserProfile } = useAuth();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(
    () => window.sessionStorage.getItem("mc_skip_setup") === "true"
  );
  const [role, setRole] = useState(profile?.role || "student");
  const [institution, setInstitution] = useState(profile?.institution || "");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const handleOpen = () => {
      setDismissed(false);
    };
    window.addEventListener("mc_open_account_setup", handleOpen);
    return () => window.removeEventListener("mc_open_account_setup", handleOpen);
  }, []);

  // Never render on Meme Lab creation route or if user/profile is completed/dismissed
  if (
    !user ||
    !profile ||
    profile.setup_completed ||
    dismissed ||
    location.pathname === "/lab"
  ) {
    return null;
  }

  const handleDismiss = () => {
    window.sessionStorage.setItem("mc_skip_setup", "true");
    setDismissed(true);
  };

  const handleSaveSetup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateUserProfile({
        role,
        institution,
        setup_completed: true
      });
    } catch (err) {
      console.error("Failed to complete profile setup", err);
    } finally {
      setLoading(false);
    }
  };

  const chips = role === "teacher" ? CHIPS_TEACHER : CHIPS_STUDENT;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200" 
        onClick={handleDismiss} 
      />

      {/* Centered Guide-style Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl border border-purple-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 animate-in zoom-in-95 fade-in duration-300">
        
        {/* Top bar with Badge indicator & Close */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Account Setup Guide
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            aria-label="Skip setup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center mx-auto shadow-sm">
            <GraduationCap className="w-7 h-7 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-zinc-50 tracking-tight">
            Complete your classroom profile
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-zinc-400 max-w-sm mx-auto">
            Tell us your role and institution to personalize your feed and earn your setup badge!
          </p>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSaveSetup} className="space-y-5">
          {/* Role Selection Buttons (Compact dark buttons that turn pink on click) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
              Select your role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLES_LIST.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 ${
                    role === r.id
                      ? "bg-pink-600 hover:bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-500/30 ring-2 ring-pink-400/50 scale-[1.02]"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700"
                  }`}
                >
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* School / Institution Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
              School or Institution
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setInstitution(chip)}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-semibold text-center leading-tight transition active:scale-[0.97] ${
                    institution === chip
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 font-bold"
                      : "border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-purple-300 dark:hover:border-purple-700"
                  }`}
                >
                  {institution === chip && <span className="text-purple-600 dark:text-purple-400 mr-1">✓</span>}
                  {chip}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type school name (e.g. St. Xavier's)"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
            >
              Skip for now
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
            >
              <span>{loading ? "Saving Setup…" : "Save Setup"}</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};

export default DeferredSetupBanner;
