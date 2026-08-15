/**
 * src/components/AiQuotaModal.jsx
 * 
 * Interactive modal that displays daily AI credit status, allows users to
 * watch a rewarded video advertisement simulation (+3 free credits),
 * or configure their own Gemini API key.
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Play, Key, CheckCircle2, AlertTriangle, X, ShieldCheck } from "lucide-react";
import { getAiQuota, addBonusAiCredits } from "../services/geminiClient";

export default function AiQuotaModal({ isOpen, onClose, onCreditsUpdated }) {
  const [quota, setQuota] = useState(getAiQuota());
  const [adPlaying, setAdPlaying] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem("memeclassroom_gemini_key") || "");
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuota(getAiQuota());
      setAdPlaying(false);
      setAdCountdown(5);
      setKeySaved(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer;
    if (adPlaying && adCountdown > 0) {
      timer = setTimeout(() => setAdCountdown(c => c - 1), 1000);
    } else if (adPlaying && adCountdown === 0) {
      setAdPlaying(false);
      const remaining = addBonusAiCredits(3);
      setQuota(getAiQuota());
      if (onCreditsUpdated) onCreditsUpdated(remaining);
    }
    return () => clearTimeout(timer);
  }, [adPlaying, adCountdown, onCreditsUpdated]);

  if (!isOpen) return null;

  const total = quota.totalLimit + (quota.bonusCredits || 0);
  const remaining = Math.max(0, total - quota.creditsUsed);
  const percentUsed = Math.min(100, Math.round((quota.creditsUsed / total) * 100));

  const handleStartAd = () => {
    setAdPlaying(true);
    setAdCountdown(5);
  };

  const handleSaveKey = (e) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      localStorage.setItem("memeclassroom_gemini_key", apiKeyInput.trim());
    } else {
      localStorage.removeItem("memeclassroom_gemini_key");
    }
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 z-[250] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">AI Credits & Quota</h3>
              <p className="text-[11px] text-gray-500">Free daily learning intelligence</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quota Progress Bar */}
        <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200/80 dark:border-zinc-700/60 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-600 dark:text-gray-300">Daily Free Allowance</span>
            <span className="text-purple-600 dark:text-purple-400">
              {remaining} / {total} credits remaining
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                remaining === 0 ? "bg-red-500" : remaining <= 2 ? "bg-amber-500" : "bg-purple-600"
              }`}
              style={{ width: `${100 - percentUsed}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            Resets automatically each midnight. Zero external cost for student learning.
          </p>
        </div>

        {/* Rewarded Ad / Bonus Tier */}
        <div className="border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Play className="w-3.5 h-3.5 fill-current" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-purple-950 dark:text-purple-200">
                Unlock +3 Bonus AI Credits
              </h4>
              <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 mt-0.5">
                Watch a short 5-second educational sponsor spotlight to restore credits instantly.
              </p>
            </div>
          </div>

          {adPlaying ? (
            <div className="bg-black text-white p-4 rounded-xl text-center space-y-2">
              <div className="animate-pulse flex items-center justify-center gap-2 text-xs font-bold text-amber-400">
                <span>📺 Playing Sponsor Spotlight…</span>
              </div>
              <p className="text-2xl font-black text-white">{adCountdown}s</p>
              <p className="text-[10px] text-gray-400">Thank you for supporting free education on MemeClassroom!</p>
            </div>
          ) : (
            <button
              onClick={handleStartAd}
              className="w-full py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs transition shadow flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Watch Sponsor Clip (+3 Credits)
            </button>
          )}
        </div>

        {/* Custom API Key Form */}
        <form onSubmit={handleSaveKey} className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300">
            <Key className="w-3.5 h-3.5 text-gray-400" />
            <span>Custom Gemini API Key (Optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl transition"
            >
              Save
            </button>
          </div>
          {keySaved && (
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Key saved successfully!
            </span>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
