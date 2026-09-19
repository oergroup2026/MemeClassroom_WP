import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  X, CheckCircle2, ChevronRight, ChevronLeft,
  Upload, Mail, Shield, Building2, MapPin, Loader2, BadgeCheck
} from "lucide-react";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { checkUpload } from "../utils/uploadLimits";
import { db, storage } from "../firebase";

// Institution type options
const INSTITUTION_TYPES = [
  "School / High School",
  "University / College",
  "Coaching Institute",
  "Research Organization",
  "NGO / Non-Profit",
  "Corporate / Workplace",
  "Independent / Self-Learner",
  "Other",
];

// Personal email domains that are blocked for institution email verification
const PERSONAL_DOMAINS = [
  "gmail.com","yahoo.com","hotmail.com","outlook.com","icloud.com",
  "live.com","aol.com","protonmail.com","mail.com","yandex.com","rediffmail.com",
];

const isPersonalEmail = (email) => {
  if (!email || !email.includes("@")) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return PERSONAL_DOMAINS.includes(domain);
};

// Compute profile completion percentage (same 7-field logic as Profile.jsx)
const computeCompletion = (profile, user) => {
  const fields = [
    Boolean(profile?.name),
    Boolean(user?.email || profile?.email),
    Boolean(profile?.role),
    Boolean(user?.email || user?.uid),
    Boolean(profile?.institution),
    Boolean(profile?.place || profile?.state),
    Boolean(profile?.country),
  ];
  const done = fields.filter(Boolean).length;
  return { done, total: 7, pct: Math.round((done / 7) * 100) };
};

/**
 * DeferredSetupBanner
 * ─────────────────────────────────────────────────
 * Phase 1: Small bottom-right corner nudge card (Windows-update style).
 * Phase 2: 2-step centered wizard launched by clicking "Complete Now".
 *   Step 1 — Institution info (type, name, place) — NO ROLE (already set at signup)
 *   Step 2 — Optional verification (ID card upload OR institution email)
 */
const DeferredSetupBanner = () => {
  const { user, profile, updateUserProfile } = useAuth();
  const location = useLocation();

  // ── Dismissed/session state ──────────────────────────────────────────────────
  const [dismissed, setDismissed] = useState(
    () => window.sessionStorage.getItem("mc_skip_setup") === "true"
  );

  // Open wizard from external event (profile page "Finish Setup" button)
  React.useEffect(() => {
    const handleOpen = () => {
      window.sessionStorage.removeItem("mc_skip_setup");
      setDismissed(false);
      setStep(1);
      setWizardOpen(true);
    };
    window.addEventListener("mc_open_account_setup", handleOpen);
    return () => window.removeEventListener("mc_open_account_setup", handleOpen);
  }, []);

  // ── Wizard state ─────────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = institution info, 2 = verification

  // Step 1 fields
  const [institutionType, setInstitutionType] = useState(profile?.institution_type || "");
  const [institutionName, setInstitutionName] = useState(profile?.institution || "");
  const [place, setPlace] = useState(profile?.place || "");
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 — verification method
  const [verifyMethod, setVerifyMethod] = useState(""); // "idcard" | "email" | ""
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardConsent, setIdCardConsent] = useState(false);
  const [institutionEmail, setInstitutionEmail] = useState(profile?.institution_email || "");
  const [emailError, setEmailError] = useState("");
  const [idCardError, setIdCardError] = useState("");
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState("");
  const idCardInputRef = useRef(null);

  const { pct } = computeCompletion(profile, user);
  const isFullySetup = Boolean(profile?.setup_completed) || pct >= 100 || (Boolean(profile?.name) && Boolean(profile?.institution) && Boolean(profile?.role));

  // Auto-sync setup_completed to Firestore if user has completed profile requirements
  React.useEffect(() => {
    if (user && profile && !profile.setup_completed && (pct >= 100 || (profile.name && profile.institution && profile.role))) {
      updateDoc(doc(db, "users", user.uid), { setup_completed: true }).catch(() => {});
    }
  }, [user, profile, pct]);

  // ── Guard conditions ─────────────────────────────────────────────────────────
  if (
    !user ||
    !profile ||
    isFullySetup ||
    dismissed ||
    location.pathname === "/lab"
  ) {
    return null;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleDismissCorner = () => {
    window.sessionStorage.setItem("mc_skip_setup", "true");
    setDismissed(true);
  };

  const openWizard = () => {
    setStep(1);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
  };

  // Save Step 1 → institution info
  const handleSaveStep1 = async (e) => {
    e.preventDefault();
    if (!institutionType || !institutionName.trim()) return;
    setStep1Loading(true);
    try {
      await updateUserProfile({
        institution_type: institutionType,
        institution: institutionName.trim(),
        place: place.trim(),
        setup_completed: true,
      });
      setStep(2);
    } catch (err) {
      console.error("Failed to save institution info", err);
    } finally {
      setStep1Loading(false);
    }
  };

  // ID Card upload → verification_status: "id_submitted"
  const handleIdCardUpload = async () => {
    if (!idCardFile || !idCardConsent) return;
    setStep2Loading(true);
    try {
      const ext = idCardFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const storageRef = ref(storage, `id_cards/${user.uid}/${Date.now()}_id.${ext}`);
      const snapshot = await uploadBytes(storageRef, idCardFile);
      const url = await getDownloadURL(snapshot.ref);

      // Save to private subcollection
      const verifRef = doc(db, "users", user.uid, "private", "verification");
      await setDoc(verifRef, {
        id_card_url: url,
        uploaded_at: serverTimestamp(),
        consent_given: true,
      }, { merge: true });

      // Update user's verification_status
      await updateDoc(doc(db, "users", user.uid), {
        verification_status: "id_submitted",
      });

      setVerifySuccess("ID card submitted! An admin will review and verify your account shortly.");
      setStep2Done(true);
    } catch (err) {
      console.error("Failed to upload ID card", err);
    } finally {
      setStep2Loading(false);
    }
  };

  // Institution email verification — blocks personal domains
  const handleEmailVerify = async () => {
    setEmailError("");
    if (!institutionEmail.trim()) { setEmailError("Please enter your institution email."); return; }
    if (isPersonalEmail(institutionEmail.trim())) {
      setEmailError("Please use an institution email address (not Gmail, Yahoo, etc.).");
      return;
    }
    setStep2Loading(true);
    try {
      // Save institution email and update verification_status
      await updateDoc(doc(db, "users", user.uid), {
        institution_email: institutionEmail.trim(),
        verification_status: "email_sent",
        is_verified: false,
      });

      // If institution email matches their Firebase login email → auto-verify
      if (user.emailVerified && user.email?.toLowerCase() === institutionEmail.trim().toLowerCase()) {
        await updateDoc(doc(db, "users", user.uid), {
          is_verified: true,
          verification_status: "verified",
        });
        setVerifySuccess("Your institution email matches your verified login email. You're now verified! ✓");
      } else {
        setVerifySuccess(
          `Verification request saved for ${institutionEmail.trim()}. An admin will cross-check and verify your account.`
        );
      }
      setStep2Done(true);
    } catch (err) {
      console.error("Failed to save institution email", err);
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setStep2Loading(false);
    }
  };

  // Skip verification
  const handleSkipVerification = async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        verification_status: "skipped",
      });
    } catch (e) {}
    handleDismissCorner();
    closeWizard();
  };

  // Finish after verification
  const handleFinish = () => {
    handleDismissCorner();
    closeWizard();
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return createPortal(
    <>
      {/* ── Corner Nudge Card (always visible unless wizard open or dismissed) ── */}
      {!wizardOpen && (
        <div
          className="fixed bottom-5 right-5 z-[9999] w-72 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-zinc-700 rounded-2xl shadow-2xl shadow-purple-500/10 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          {/* Close button */}
          <button
            onClick={handleDismissCorner}
            className="absolute top-2.5 right-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-extrabold text-gray-800 dark:text-zinc-100">
              Complete your profile
            </span>
          </div>

          {/* Progress bar */}
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold">
              {pct}% completed
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mb-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={openWizard}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              Complete Now <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={handleDismissCorner}
              className="py-2 px-2.5 text-[10px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* ── 2-Step Wizard Modal ── */}
      {wizardOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeWizard}
          />

          {/* Modal card */}
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-purple-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 fade-in duration-200">

            {/* Close */}
            <button
              onClick={closeWizard}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-2 mb-5">
              {[1, 2].map(s => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? "w-6 bg-purple-600 dark:bg-purple-400" : s < step ? "w-3 bg-purple-400 dark:bg-purple-600" : "w-2 bg-gray-200 dark:bg-zinc-700"}`}
                />
              ))}
            </div>

            {/* ── STEP 1: Institution Info ── */}
            {step === 1 && (
              <form onSubmit={handleSaveStep1} className="space-y-5">
                {/* Header */}
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-zinc-50">
                    Tell us about your institution
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                    Help us personalise your experience. Your role is already saved from signup.
                  </p>
                </div>

                {/* Institution Type */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                    Institution Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {INSTITUTION_TYPES.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setInstitutionType(type)}
                        className={`py-2 px-2.5 rounded-xl border text-[11px] font-semibold text-center leading-tight transition-all active:scale-[0.97] ${
                          institutionType === type
                            ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 font-bold ring-1 ring-purple-400/40"
                            : "border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-zinc-800"
                        }`}
                      >
                        {institutionType === type && <span className="text-purple-600 dark:text-purple-400 mr-1">✓</span>}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Institution Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
                    Institution Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. St. Xavier's College, IIT Delhi…"
                    value={institutionName}
                    onChange={e => setInstitutionName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Place / City */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Place / City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai, Delhi, Bangalore…"
                    value={place}
                    onChange={e => setPlace(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={closeWizard}
                    className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
                  >
                    I'll do it later
                  </button>
                  <button
                    type="submit"
                    disabled={step1Loading || !institutionType || !institutionName.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md transition-all inline-flex items-center gap-2 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {step1Loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 2: Optional Verification ── */}
            {step === 2 && (
              <div className="space-y-5">
                {/* Header */}
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center mx-auto mb-3">
                    <BadgeCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-zinc-50">
                    Verify your institution
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed max-w-sm mx-auto">
                    Verification is optional. A <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ tick</span> will appear on your profile once verified.
                  </p>
                </div>

                {/* Success state */}
                {step2Done ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      {verifySuccess}
                    </p>
                    <button
                      onClick={handleFinish}
                      className="mt-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition active:scale-95"
                    >
                      Done ✓
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Method selector */}
                    {!verifyMethod && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setVerifyMethod("idcard")}
                          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition group text-center"
                        >
                          <Upload className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition" />
                          <span className="text-[11px] font-bold text-gray-600 dark:text-zinc-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                            Upload ID Card
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                            Admin review required
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setVerifyMethod("email")}
                          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition group text-center"
                        >
                          <Mail className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition" />
                          <span className="text-[11px] font-bold text-gray-600 dark:text-zinc-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                            Institution Email
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                            No admin required
                          </span>
                        </button>
                      </div>
                    )}

                    {/* ID Card upload panel */}
                    {verifyMethod === "idcard" && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setVerifyMethod("")}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
                        >
                          <ChevronLeft className="w-3 h-3" /> Back
                        </button>

                        {/* Drop zone */}
                        <div
                          onClick={() => idCardInputRef.current?.click()}
                          className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-2xl p-5 text-center cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition"
                        >
                          <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                          {idCardFile ? (
                            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                              {idCardFile.name}
                            </p>
                          ) : (
                            <>
                              <p className="text-xs font-semibold text-gray-600 dark:text-zinc-300">
                                Click to upload your ID card
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                PNG, JPG, PDF · max 5 MB
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          ref={idCardInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            // Previously an oversized file was silently ignored:
                            // no error, and the user believed it had attached.
                            const problem = checkUpload(file, { as: "idCard" });
                            if (problem) { setIdCardError(problem); e.target.value = ""; setIdCardFile(null); return; }
                            setIdCardError("");
                            setIdCardFile(file);
                          }}
                        />

                        {idCardError && (
                          <p className="text-[10px] text-red-500 font-semibold" role="alert">{idCardError}</p>
                        )}

                        {/* Consent checkbox */}
                        <label className="flex items-start gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={idCardConsent}
                            onChange={e => setIdCardConsent(e.target.checked)}
                            className="mt-0.5 accent-purple-600 w-3.5 h-3.5 flex-shrink-0 cursor-pointer"
                          />
                          <span className="text-[11px] text-gray-500 dark:text-zinc-400 group-hover:text-gray-700 dark:group-hover:text-zinc-300 leading-relaxed transition">
                            I consent to sharing this document for institutional verification purposes only. It will not be shared with third parties.
                          </span>
                        </label>

                        <button
                          onClick={handleIdCardUpload}
                          disabled={!idCardFile || !idCardConsent || step2Loading}
                          className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow transition active:scale-95 inline-flex items-center justify-center gap-2"
                        >
                          {step2Loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Submit ID Card
                        </button>
                      </div>
                    )}

                    {/* Institution email panel */}
                    {verifyMethod === "email" && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => { setVerifyMethod(""); setEmailError(""); }}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
                        >
                          <ChevronLeft className="w-3 h-3" /> Back
                        </button>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300">
                            Institution Email Address
                          </label>
                          <input
                            type="email"
                            placeholder="yourname@university.edu"
                            value={institutionEmail}
                            onChange={e => { setInstitutionEmail(e.target.value); setEmailError(""); }}
                            className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {emailError && (
                            <p className="text-[10px] text-red-500 font-semibold mt-1">{emailError}</p>
                          )}
                          <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                            Must be an institutional email (not Gmail, Yahoo, etc.)
                          </p>
                        </div>

                        <button
                          onClick={handleEmailVerify}
                          disabled={!institutionEmail.trim() || step2Loading}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow transition active:scale-95 inline-flex items-center justify-center gap-2"
                        >
                          {step2Loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                          Verify with Institution Email
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Skip / Back row */}
                {!step2Done && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipVerification}
                      className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition"
                    >
                      I'll verify later
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
};

export default DeferredSetupBanner;
