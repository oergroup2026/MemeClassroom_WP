import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  addDoc,
  collection
} from "firebase/firestore";
import { ShieldAlert, Mail, LogOut, Send, CheckCircle2, Clock, Copy, Check, RefreshCw, AlertCircle } from "lucide-react";

const SUPPORT_EMAIL = "oer2026@gmail.com";

const IsBanned = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [appealMessage, setAppealMessage] = useState("");
  const [existingAppeal, setExistingAppeal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  // If user is not logged in or not banned, redirect to home page
  useEffect(() => {
    if (profile && !profile.banned) {
      navigate("/", { replace: true });
    }
  }, [profile, navigate]);

  // Listen to user's unban request status in real-time
  useEffect(() => {
    if (!user || !profile?.banned) return;
    const unsub = onSnapshot(doc(db, "unban_requests", user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setExistingAppeal(data);
        if (data.appeal_message && !appealMessage) {
          setAppealMessage(data.appeal_message);
        }
      } else {
        setExistingAppeal(null);
      }
    }, (err) => console.error("Unban request listener error:", err));

    return () => unsub();
  }, [user, profile?.banned]);

  const showStatus = (msg) => {
    setStatusNotice(msg);
    setErrorNotice(null);
    setTimeout(() => setStatusNotice(null), 4000);
  };

  const showError = (msg) => {
    setErrorNotice(msg);
    setStatusNotice(null);
    setTimeout(() => setErrorNotice(null), 5000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    showStatus("Support email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendUnbanRequest = async (e) => {
    e.preventDefault();
    if (!appealMessage.trim()) {
      showError("Please enter a brief explanation for your appeal.");
      return;
    }
    setSubmitting(true);
    setErrorNotice(null);
    try {
      // 1. Save or update document in unban_requests
      const reqRef = doc(db, "unban_requests", user.uid);
      await setDoc(reqRef, {
        user_id: user.uid,
        user_name: profile?.name || user.displayName || "User",
        user_email: profile?.email || user.email || "No email",
        institution: profile?.institution || "",
        role: profile?.role || "student",
        ban_reason: profile?.ban_reason || "Violation of community rules",
        appeal_message: appealMessage.trim(),
        status: "pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }, { merge: true });

      // 2. Optionally log to admin_notifications if permitted
      addDoc(collection(db, "admin_notifications"), {
        type: "unban_request",
        user_id: user.uid,
        user_name: profile?.name || "User",
        user_email: profile?.email || user.email,
        title: "Unban Appeal Submitted",
        message: `User ${profile?.name || user.email} requested account unban: "${appealMessage.trim().substring(0, 80)}..."`,
        created_at: serverTimestamp(),
        read: false
      }).catch(() => { });

      showStatus("Your appeal has been submitted successfully to administrators!");
    } catch (err) {
      console.error("Failed to submit unban request", err);
      showError(err.message || "Failed to submit request. Please try again or use the email contact option below.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user || !profile?.banned) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin dark:border-purple-900/50 dark:border-t-purple-400" />
        <span className="text-xs font-semibold text-gray-500">Checking account status…</span>
      </div>
    );
  }

  const isPending = existingAppeal?.status === "pending";
  const isRejected = existingAppeal?.status === "rejected";

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6 my-4">
      <div className="w-full max-w-xl bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/40 rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-rose-500 to-amber-500" />

        {/* Alert Notifications */}
        {statusNotice && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {errorNotice && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Header Section */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Account Suspended</h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            Your MemeClassroom account has been restricted from accessing classroom activities, staffroom posts, and community features.
          </p>
        </div>

        {/* Suspension Reason Box */}
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Reason for Suspension</span>
          <p className="text-xs font-medium text-red-900 dark:text-red-200 leading-relaxed">
            {profile.ban_reason || "Violation of MemeClassroom community guidelines or safety policies."}
          </p>
        </div>

        {/* Appeal / Revive Form Section */}
        <div className="bg-gray-50 dark:bg-zinc-950/80 border border-gray-200 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Request Account Revive
            </h2>
            {isPending && (
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" /> Pending Review
              </span>
            )}
            {isRejected && (
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                Appeal Rejected
              </span>
            )}
          </div>

          {isPending ? (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200/90 leading-relaxed space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" /> Appeal Submitted & Pending Review
              </p>
              <p className="text-[11px] text-gray-600 dark:text-zinc-400">
                Your appeal message is currently queued for administrator review. Your account will automatically reactivate as soon as an admin approves your request.
              </p>
              <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/30 text-[11px]">
                <span className="font-bold text-amber-800 dark:text-amber-400">Your Submitted Appeal:</span>
                <p className="italic text-gray-600 dark:text-zinc-400 mt-0.5">"{existingAppeal.appeal_message}"</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendUnbanRequest} className="space-y-3">
              {isRejected && (
                <p className="text-[11px] text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-900/40">
                  Your previous appeal was reviewed and rejected. You may submit an updated explanation below for re-evaluation.
                </p>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-zinc-400 mb-1.5">
                  Explain why your account should be unbanned:
                </label>
                <textarea
                  rows={3}
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  placeholder="Provide context or actions taken to ensure compliance with community standards..."
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700/80 focus:border-purple-500 rounded-xl p-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none transition resize-none"
                  disabled={submitting}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-3 px-4 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Revive Request to Admins
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Contact Email Support Box */}
        <div className="bg-gray-50 dark:bg-zinc-950/60 border border-gray-200 dark:border-zinc-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 block uppercase">Contact Admin Email</span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">{SUPPORT_EMAIL}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=MemeClassroom%20Account%20Revive%20Request%20(${encodeURIComponent(profile?.name || 'User')})`}
              className="flex-1 sm:flex-initial text-center bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-white text-[11px] font-bold px-3.5 py-2 rounded-lg transition"
            >
              Send Mail ↗
            </a>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white text-[11px] font-bold px-3 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Copy email address"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Footer: Sign Out Button */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-zinc-800/80 hover:bg-gray-200 dark:hover:bg-zinc-800 px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out to Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default IsBanned;
