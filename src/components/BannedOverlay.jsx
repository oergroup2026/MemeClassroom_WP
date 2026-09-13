import React, { useState, useEffect } from "react";
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
import { ShieldAlert, Mail, LogOut, Send, CheckCircle2, Clock, Copy, Check, RefreshCw } from "lucide-react";

const SUPPORT_EMAIL = "support@memeclassroom.edu";

const BannedOverlay = () => {
  const { user, profile, signOut } = useAuth();
  const [appealMessage, setAppealMessage] = useState("");
  const [existingAppeal, setExistingAppeal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

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

  if (!user || !profile?.banned) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    showToast("Support email copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendUnbanRequest = async (e) => {
    e.preventDefault();
    if (!appealMessage.trim()) {
      showToast("Please enter a brief explanation for your appeal.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Save / Update document in unban_requests
      const reqRef = doc(db, "unban_requests", user.uid);
      await setDoc(reqRef, {
        user_id: user.uid,
        user_name: profile.name || user.displayName || "User",
        user_email: profile.email || user.email || "No email",
        institution: profile.institution || "",
        role: profile.role || "student",
        ban_reason: profile.ban_reason || "Violation of community rules",
        appeal_message: appealMessage.trim(),
        status: "pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }, { merge: true });

      // 2. Also log an alert entry in admin_notifications for instant visibility
      await addDoc(collection(db, "admin_notifications"), {
        type: "unban_request",
        user_id: user.uid,
        user_name: profile.name || "User",
        user_email: profile.email || user.email,
        title: "Unban Appeal Submitted",
        message: `User ${profile.name || user.email} requested account unban: "${appealMessage.trim().substring(0, 80)}..."`,
        created_at: serverTimestamp(),
        read: false
      }).catch(() => {});

      showToast("Your appeal has been submitted to admins!");
    } catch (err) {
      console.error("Failed to submit unban request", err);
      showToast("Error submitting request. Please try again or contact email support.");
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = existingAppeal?.status === "pending";
  const isRejected = existingAppeal?.status === "rejected";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100000] bg-purple-600 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" /> {toastMessage}
        </div>
      )}

      <div className="w-full max-w-lg bg-zinc-900 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6 relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Icon & Title */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center shadow-lg shadow-red-500/10 animate-pulse">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Account Suspended</h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
            Your MemeClassroom account has been restricted from accessing classroom activities, staffroom, and community features.
          </p>
        </div>

        {/* Ban Reason Box */}
        <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4 space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Reason for Suspension</span>
          <p className="text-xs font-medium text-red-200 leading-relaxed">
            {profile.ban_reason || "Violation of MemeClassroom community guidelines or safety policies."}
          </p>
        </div>

        {/* Appeal / Unban Request Section */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" /> Request Account Revive
            </h3>
            {isPending && (
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Clock className="w-3 h-3 animate-spin" /> Pending Review
              </span>
            )}
            {isRejected && (
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                Appeal Rejected
              </span>
            )}
          </div>

          {isPending ? (
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3.5 text-xs text-amber-200/90 leading-relaxed space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-amber-300">
                <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" /> Appeal Received
              </p>
              <p className="text-[11px] text-zinc-400">
                Your appeal is currently under review by administrators. You will be automatically unbanned once an admin reviews your request.
              </p>
              <div className="pt-2 border-t border-amber-900/30 text-[11px] text-zinc-300">
                <span className="font-bold text-amber-400">Your Appeal Message:</span>
                <p className="italic text-zinc-400 mt-0.5">"{existingAppeal.appeal_message}"</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendUnbanRequest} className="space-y-3">
              {isRejected && (
                <p className="text-[11px] text-red-300 bg-red-950/40 p-2.5 rounded-lg border border-red-900/40">
                  Your previous appeal was rejected. You can submit an updated explanation for review.
                </p>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                  Explain why your account should be restored:
                </label>
                <textarea
                  rows={3}
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  placeholder="Provide context or steps you have taken to resolve any issues..."
                  className="w-full bg-zinc-900 border border-zinc-700/80 focus:border-purple-500 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none transition resize-none"
                  disabled={submitting}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Revive Notice to Admins
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Contact Email Support Box */}
        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 block uppercase">Contact Admin Email</span>
              <span className="text-xs font-semibold text-white">{SUPPORT_EMAIL}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=MemeClassroom%20Account%20Revive%20Request%20(${encodeURIComponent(profile?.name || 'User')})`}
              className="flex-1 sm:flex-initial text-center bg-zinc-800 hover:bg-zinc-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition"
            >
              Send Mail ↗
            </a>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="Copy email address"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Footer: Sign Out button */}
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 px-5 py-2 rounded-xl transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out to Switch Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannedOverlay;
