import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const EyeIcon = ({ open }) =>
  open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

const GoogleIcon = () => (
  <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Toggle = ({ checked, onChange }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${checked ? "bg-purple-600" : "bg-gray-200 dark:bg-zinc-600"}`}
  >
    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-4" : "translate-x-0"}`} />
  </button>
);

const StepDots = ({ current, total }) => (
  <div className="flex items-center justify-center gap-2 mb-7">
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i + 1 < current ? "w-2 bg-purple-600" : i + 1 === current ? "w-6 bg-purple-600" : "w-2 bg-gray-200 dark:bg-zinc-700"}`} />
    ))}
  </div>
);

const HeroPanel = () => (
  <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 flex-col justify-between p-12 bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-950 relative overflow-hidden">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="absolute bottom-0 -left-24 w-72 h-72 rounded-full bg-indigo-600/20 blur-3xl" />
    </div>
    <span className="absolute top-[12%] left-[8%] text-4xl opacity-[0.15] select-none" style={{transform:"rotate(-15deg)"}}>😂</span>
    <span className="absolute top-[28%] right-[12%] text-3xl opacity-[0.12] select-none" style={{transform:"rotate(10deg)"}}>📚</span>
    <span className="absolute top-[52%] left-[16%] text-4xl opacity-[0.15] select-none" style={{transform:"rotate(5deg)"}}>🎓</span>
    <span className="absolute top-[72%] right-[8%] text-4xl opacity-[0.12] select-none" style={{transform:"rotate(-8deg)"}}>🤣</span>
    <span className="absolute top-[8%] right-[28%] text-3xl opacity-[0.15] select-none" style={{transform:"rotate(20deg)"}}>✏️</span>
    <div className="relative z-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl shadow-lg">🎭</div>
        <span className="text-white font-bold text-xl tracking-tight">MemeClassroom</span>
      </div>
    </div>
    <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
      <div className="relative mx-auto w-72">
        <div className="absolute top-5 left-5 right-5 h-36 bg-white/[0.08] border border-white/15 rounded-2xl" style={{transform:"rotate(4deg)"}} />
        <div className="absolute top-2 left-2 right-2 h-36 bg-white/[0.12] border border-white/20 rounded-2xl" style={{transform:"rotate(-1.5deg)"}} />
        <div className="relative bg-white/[0.18] backdrop-blur-md border border-white/25 rounded-2xl p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none mt-0.5">😂</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-snug mb-1">Physics — Newton's 3rd Law</p>
              <p className="text-white/65 text-xs leading-relaxed">When you push the wall but the wall pushes back with the same energy…</p>
              <div className="mt-2.5 flex gap-1.5 flex-wrap">
                <span className="bg-purple-500/35 text-purple-200 text-[10px] px-2 py-0.5 rounded-full">Grade 10</span>
                <span className="bg-white/10 text-white/55 text-[10px] px-2 py-0.5 rounded-full">Physics</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/40">❤️ 142  💬 28</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Verified Educator ✓</span>
          </div>
        </div>
      </div>
      <div className="mt-10 grid grid-cols-3 gap-3 text-center">
        {[["500+","Resources"],["2K+","Educators"],["10K+","Students"]].map(([num,label])=>(
          <div key={label}><p className="text-white font-bold text-xl leading-none">{num}</p><p className="text-purple-300 text-[11px] mt-1">{label}</p></div>
        ))}
      </div>
    </div>
    <div className="relative z-10">
      <p className="text-white/45 text-sm italic leading-relaxed">"The best teachers don't take learning too seriously."</p>
    </div>
  </div>
);

const ROLES = [
  { id:"teacher", icon:"👩‍🏫", label:"Teacher / Educator", desc:"Share resources & lesson plans" },
  { id:"student", icon:"🎓", label:"Student / Learner", desc:"Discover memes that explain concepts" },
];
const CHIPS_TEACHER = ["School / High School","University / College","Independent Educator","Coaching Center"];
const CHIPS_STUDENT = ["School / High School","University / College","Self Learner","Coaching Student"];

const Auth = () => {
  const { user, onboardingUser, signUpWithEmail, signInWithEmail, signInWithGoogle, completeGoogleOnboarding, resetPassword, sendMagicLink, completeMagicLinkSignIn, isMagicLinkUrl } = useAuth();
  const { highContrastMode } = useUdl();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState("hub");
  const [step, setStep] = useState(1);
  const [animKey, setAnimKey] = useState(0);
  const [animDir, setAnimDir] = useState("right");
  const [hubEmail, setHubEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [institution, setInstitution] = useState("");
  const [idCardFile, setIdCardFile] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [magicEmailSent, setMagicEmailSent] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isMagicLinkUrl && isMagicLinkUrl(window.location.href)) {
      const stored = window.localStorage.getItem("mcEmailForSignIn");
      if (stored) { handleMagicLinkComplete(window.location.href); }
      else { setMode("login"); setError("Please enter your email address to complete sign-in."); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const paramMode = searchParams.get("mode");
    const paramEmail = searchParams.get("email");
    if (paramEmail) { setEmail(paramEmail); setHubEmail(paramEmail); }
    if (paramMode === "register") { setMode("register"); setStep(1); }
    else if (paramMode === "login") setMode("login");
  }, [searchParams]);

  useEffect(() => { if (onboardingUser) { setMode("onboarding"); setStep(1); } }, [onboardingUser]);
  useEffect(() => { if (user && !onboardingUser) navigate("/profile"); }, [user, onboardingUser, navigate]);

  const goTo = (newMode, dir = "right") => { setAnimDir(dir); setAnimKey(k => k+1); setError(""); setSuccessMsg(""); setMode(newMode); setStep(1); };
  const nextStep = () => { setAnimDir("right"); setAnimKey(k => k+1); setStep(s => s+1); };
  const prevStep = () => { setAnimDir("left");  setAnimKey(k => k+1); setStep(s => s-1); };

  const fmtErr = (err, def) => {
    const c = err?.code || ""; const m = err?.message || "";
    if (c === "auth/network-request-failed" || !navigator.onLine) return "Internet issue: please check your connection and try again.";
    if (c === "auth/operation-not-allowed") return "This sign-in method is not enabled. Please contact support.";
    if (["auth/invalid-credential","auth/wrong-password","auth/user-not-found","auth/invalid-email"].includes(c)) return "Invalid email or password. Please double-check and try again.";
    if (c === "auth/email-already-in-use") return "An account with this email already exists. Try signing in instead.";
    if (c === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
    return m || def;
  };

  const handleLogin = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { await signInWithEmail(email, password, rememberMe); navigate("/profile"); } catch (err) { setError(fmtErr(err, "Failed to sign in.")); } finally { setLoading(false); } };
  const handleRegister = async (e) => { e.preventDefault(); setError(""); if (password.length < 6) { setError("Password must be at least 6 characters."); return; } setLoading(true); try { await signUpWithEmail(email, password, { name, role, institution, place: "", state: "", country: "" }, idCardFile); navigate("/profile"); } catch (err) { setError(fmtErr(err, "Failed to create an account.")); } finally { setLoading(false); } };
  const handleGoogleSignIn = async () => { setError(""); setLoading(true); try { await signInWithGoogle(); } catch (err) { setError(fmtErr(err, "Google Sign-In failed.")); } finally { setLoading(false); } };
  const handleOnboardingSubmit = async (e) => { e.preventDefault(); setError(""); setLoading(true); try { await completeGoogleOnboarding({ name: onboardingUser?.displayName || name || "Google User", role, institution, place: "", state: "", country: "" }, idCardFile); navigate("/profile"); } catch (err) { setError(fmtErr(err, "Onboarding setup failed.")); } finally { setLoading(false); } };
  const handleForgotPassword = async (e) => { e.preventDefault(); setError(""); setSuccessMsg(""); if (!resetEmail.trim()) { setError("Please enter your email address."); return; } setLoading(true); try { await resetPassword(resetEmail.trim()); setSuccessMsg("Reset link sent! Check your inbox (and spam folder)."); } catch (err) { setError(err.message || "Failed to send reset email."); } finally { setLoading(false); } };
  const handleSendMagicLink = async (emailToSend) => { const t = (emailToSend || "").trim(); if (!t) { setError("Please enter your email address first."); return; } setError(""); setLoading(true); try { await sendMagicLink(t); setMagicEmailSent(t); goTo("magic-sent"); } catch (err) { setError(fmtErr(err, "Failed to send sign-in link.")); } finally { setLoading(false); } };
  const handleMagicLinkComplete = async (url) => { setLoading(true); try { await completeMagicLinkSignIn(url, rememberMe); navigate("/profile"); } catch (err) { if (err.message === "EMAIL_NEEDED") { setMode("login"); setError("Please enter your email address to complete sign-in."); } else setError(fmtErr(err, "Sign-in link expired or invalid. Please try again.")); } finally { setLoading(false); } };
  const handleFileChange = (e) => { if (e.target.files?.[0]) setIdCardFile(e.target.files[0]); };
  const handleHubContinue = (e) => { e.preventDefault(); setEmail(hubEmail); goTo("login"); };

  const ic = "w-full px-4 py-3 border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800/80 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm";
  const pb = "w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-semibold py-3 px-5 rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm";
  const sb = "w-full border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-zinc-200 font-medium py-3 px-5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 text-sm";
  const bk = "flex items-center gap-1.5 text-sm text-gray-400 dark:text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors mb-5";
  const chips = role === "teacher" ? CHIPS_TEACHER : CHIPS_STUDENT;
  const animClass = animDir === "right" ? "auth-slide-in-right" : "auth-slide-in-left";

  const Divider = ({ label = "or" }) => (
    <div className="relative my-5"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-zinc-700" /></div><div className="relative flex justify-center text-[11px]"><span className="bg-gray-50 dark:bg-zinc-950 px-3 text-gray-400 dark:text-zinc-500 uppercase tracking-widest">{label}</span></div></div>
  );

  const RoleCards = ({ onSelect }) => (
    <div className="space-y-3">
      {ROLES.map(r => (
        <button key={r.id} id={`role-${r.id}`} type="button"
          onClick={() => { setRole(r.id); setTimeout(() => onSelect(), 160); }}
          className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 active:scale-[0.98] ${role === r.id ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40" : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/30 dark:hover:bg-purple-950/20"}`}>
          <span className="text-3xl leading-none flex-shrink-0">{r.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${role === r.id ? "text-purple-900 dark:text-purple-200" : "text-gray-800 dark:text-zinc-200"}`}>{r.label}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{r.desc}</p>
          </div>
          <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${role === r.id ? "border-purple-600 bg-purple-600" : "border-gray-300 dark:border-zinc-600"}`}>
            {role === r.id && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
          </div>
        </button>
      ))}
    </div>
  );

  const InstitutionPicker = () => (
    <>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {chips.map(chip => (
          <button key={chip} type="button" id={`chip-${chip.replace(/\W+/g, "-").toLowerCase()}`}
            onClick={() => setInstitution(chip)}
            className={`py-3 px-3 rounded-xl border-2 text-xs font-semibold transition-all duration-200 text-center leading-tight active:scale-[0.97] ${institution === chip ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200" : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 text-gray-600 dark:text-zinc-400 hover:border-purple-300 dark:hover:border-purple-700"}`}>
            {institution === chip && <span className="text-purple-600 dark:text-purple-400 mr-1">✓</span>}
            {chip}
          </button>
        ))}
      </div>
      <input id="institution-input" type="text" placeholder="Or type your school name (e.g. St. Xavier's)" value={institution} onChange={e => setInstitution(e.target.value)} className={ic} />
    </>
  );

  const TeacherIdUpload = () => role === "teacher" ? (
    <div className="mt-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
      <div className="flex items-start gap-2 mb-2"><span className="text-lg leading-none mt-0.5">🆔</span><div><p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">Faculty / School ID Card (Optional)</p><p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">Upload to apply for Verified Educator status.</p></div></div>
      <input id="id-card-upload" type="file" accept="image/*,.pdf" onChange={handleFileChange} className="text-xs text-gray-600 dark:text-zinc-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer w-full" />
      <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2 flex items-center gap-1"><span>🔒</span><span>Secure storage — admins only. Never public.</span></p>
    </div>
  ) : null;

  const LegalConsent = () => (
    <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed">
      By creating an account, you agree to our{" "}<a href="/terms" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Terms of Service</a>{" "}and{" "}<a href="/privacy" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Privacy Policy</a>.
    </p>
  );

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-zinc-950">
      <HeroPanel />
      <div className="w-full flex flex-col justify-center items-center p-6 sm:p-10 min-h-screen overflow-y-auto">
        <div className="lg:hidden flex items-center gap-2 mb-8 self-start"><span className="text-2xl">🎭</span><span className="font-bold text-lg text-gray-900 dark:text-zinc-100 tracking-tight">MemeClassroom</span></div>
        <div className="w-full max-w-[420px]">
          {error && (<div className="mb-5 p-3.5 text-sm rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 flex items-start gap-2"><span className="mt-0.5 flex-shrink-0">⚠️</span><span>{error}</span></div>)}
          {successMsg && (<div className="mb-5 p-3.5 text-sm rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 flex items-start gap-2"><span className="mt-0.5 flex-shrink-0">✅</span><span>{successMsg}</span></div>)}
          <div key={animKey} className={animClass}>

            {mode === "hub" && (
              <div>
                <div className="mb-8"><h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight leading-snug">Join MemeClassroom</h1><p className="mt-2 text-gray-500 dark:text-zinc-400 text-sm">Education meets humor. Free forever for students.</p></div>
                <button id="hub-google-btn" onClick={handleGoogleSignIn} disabled={loading} className={`${sb} shadow-sm mb-4`}><GoogleIcon /><span>Continue with Google</span></button>
                <Divider />
                <form onSubmit={handleHubContinue} className="space-y-3">
                  <input id="hub-email" type="email" placeholder="Enter your email address" value={hubEmail} onChange={e => setHubEmail(e.target.value)} className={ic} required autoComplete="email" />
                  <button id="hub-continue-btn" type="submit" disabled={loading} className={pb}><span>Continue with Email</span><span aria-hidden>→</span></button>
                </form>
                <p className="mt-6 text-center text-xs text-gray-400 dark:text-zinc-500">Already have an account?{" "}<button id="hub-signin-link" onClick={() => goTo("login")} className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Sign in</button></p>
              </div>
            )}

            {mode === "login" && (
              <div>
                <button id="login-back-btn" onClick={() => goTo("hub", "left")} className={bk}>← Back</button>
                <div className="mb-7"><h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight">Welcome back 👋</h1><p className="mt-1 text-gray-500 dark:text-zinc-400 text-sm">Sign in to continue to your classroom.</p></div>
                <button id="login-google-btn" onClick={handleGoogleSignIn} disabled={loading} className={`${sb} shadow-sm mb-4`}><GoogleIcon /><span>Continue with Google</span></button>
                <Divider label="or with email" />
                <form onSubmit={handleLogin} className="space-y-4">
                  <input id="login-email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} className={ic} required autoComplete="email" />
                  <div className="relative">
                    <input id="login-password" type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={`${ic} pr-12`} required autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition" aria-label={showPassword ? "Hide password" : "Show password"}><EyeIcon open={showPassword} /></button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none"><Toggle checked={rememberMe} onChange={setRememberMe} /><span className="text-sm text-gray-600 dark:text-zinc-400">Keep me signed in</span></label>
                    <button type="button" id="login-forgot-btn" onClick={() => { goTo("forgot"); setResetEmail(email); }} className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium flex-shrink-0">Forgot password?</button>
                  </div>
                  <button id="login-submit-btn" type="submit" disabled={loading} className={pb}>{loading ? "Signing in…" : "Sign In"}</button>
                </form>
                <div className="mt-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                  <p className="text-[12px] text-gray-600 dark:text-zinc-400 mb-2 leading-relaxed"><span className="font-semibold text-purple-700 dark:text-purple-300">No password?</span>{" "}We'll email you a one-click sign-in link instead.</p>
                  <button id="login-magic-link-btn" type="button" disabled={loading} onClick={() => handleSendMagicLink(email)} className="text-[12px] text-purple-600 dark:text-purple-400 font-semibold hover:underline">Send me a sign-in link →</button>
                </div>
                <p className="mt-5 text-center text-xs text-gray-400 dark:text-zinc-500">New here?{" "}<button id="login-to-register-btn" onClick={() => goTo("register")} className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Create a free account →</button></p>
              </div>
            )}

            {mode === "magic-sent" && (
              <div className="text-center">
                <div className="text-6xl mb-5">📬</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 mb-2 tracking-tight">Check your inbox!</h2>
                <p className="text-gray-500 dark:text-zinc-400 text-sm mb-1">We sent a sign-in link to:</p>
                <p className="font-semibold text-gray-800 dark:text-zinc-200 mb-6 text-sm break-all">{magicEmailSent}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-7 leading-relaxed">Click the link to sign in instantly — no password needed.<br/>The link expires in <strong className="text-gray-600 dark:text-zinc-400">15 minutes</strong>.</p>
                <div className="flex gap-3 justify-center mb-6">
                  <a href="https://mail.google.com" target="_blank" rel="noreferrer" id="magic-open-gmail" className="flex items-center gap-2 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl font-medium text-gray-700 dark:text-zinc-200 shadow-sm hover:shadow-md transition"><GoogleIcon />Gmail</a>
                  <a href="https://outlook.live.com/mail/0/" target="_blank" rel="noreferrer" id="magic-open-outlook" className="flex items-center gap-2 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl font-medium text-gray-700 dark:text-zinc-200 shadow-sm hover:shadow-md transition">📧 Outlook</a>
                </div>
                <button id="magic-resend-btn" type="button" disabled={loading} onClick={() => handleSendMagicLink(magicEmailSent)} className="text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium">{loading ? "Resending…" : "Resend link"}</button>
                <div className="mt-4"><button id="magic-back-btn" onClick={() => goTo("login", "left")} className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition">← Back to sign in</button></div>
              </div>
            )}

            {mode === "register" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <button id="register-back-btn" onClick={() => step === 1 ? goTo("hub", "left") : prevStep()} className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">← {step === 1 ? "Back" : "Previous"}</button>
                  <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium">Step {step} of 3</span>
                </div>
                <StepDots current={step} total={3} />
                {step === 1 && (<div><div className="mb-7"><h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight">Who are you joining as?</h2><p className="mt-1 text-gray-500 dark:text-zinc-400 text-sm">Pick your role — we'll tailor your experience.</p></div><RoleCards onSelect={nextStep} /></div>)}
                {step === 2 && (
                  <div>
                    <div className="mb-6"><h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight">Your school setup?</h2><p className="mt-1 text-gray-500 dark:text-zinc-400 text-sm">This helps us tailor your content feed.</p></div>
                    <InstitutionPicker />
                    <TeacherIdUpload />
                    <button id="institution-continue-btn" type="button" disabled={!institution.trim() || loading} onClick={nextStep} className={`${pb} mt-5`}>Continue →</button>
                  </div>
                )}
                {step === 3 && (
                  <form id="register-form" onSubmit={handleRegister} className="space-y-4">
                    <div><h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight mb-1">Almost there! 🎉</h2><p className="text-gray-500 dark:text-zinc-400 text-sm">Create your login credentials.</p></div>
                    <input id="register-name" type="text" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} className={ic} required autoComplete="name" />
                    <input id="register-email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} className={ic} required autoComplete="email" />
                    <div className="relative"><input id="register-password" type={showPassword ? "text" : "password"} placeholder="Create a password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} className={`${ic} pr-12`} required autoComplete="new-password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 transition" aria-label={showPassword ? "Hide password" : "Show password"}><EyeIcon open={showPassword} /></button></div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none"><Toggle checked={rememberMe} onChange={setRememberMe} /><span className="text-sm text-gray-600 dark:text-zinc-400">Keep me signed in on this device</span></label>
                    <LegalConsent />
                    <button id="register-submit-btn" type="submit" disabled={loading} className={pb}>{loading ? "Creating your account…" : "Create Free Account 🎉"}</button>
                    <p className="text-center text-xs text-gray-400 dark:text-zinc-500">Already have an account?{" "}<button type="button" id="register-to-login-btn" onClick={() => goTo("login", "left")} className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Sign in</button></p>
                  </form>
                )}
              </div>
            )}

            {mode === "onboarding" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  {step > 1 && (<button id="onboarding-back-btn" onClick={prevStep} className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">← Previous</button>)}
                  <span className="ml-auto text-xs text-gray-400 dark:text-zinc-500 font-medium">Step {step} of 2</span>
                </div>
                <StepDots current={step} total={2} />
                <div className="mb-7 text-center">
                  <span className="text-4xl">{step === 1 ? "🎉" : "🏫"}</span>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 mt-2 tracking-tight">{step === 1 ? "Welcome aboard!" : "Your school setup?"}</h2>
                  <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">{step === 1 ? `Hi ${onboardingUser?.displayName?.split(" ")[0] || "there"}! Two quick questions to set up your profile.` : "This helps us curate the right meme resources for you."}</p>
                </div>
                {step === 1 && <RoleCards onSelect={nextStep} />}
                {step === 2 && (
                  <form id="onboarding-form" onSubmit={handleOnboardingSubmit} className="space-y-4">
                    <InstitutionPicker />
                    <TeacherIdUpload />
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500 text-center leading-relaxed">By completing registration, you agree to our{" "}<a href="/terms" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Terms</a>{" "}and{" "}<a href="/privacy" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">Privacy Policy</a>.</p>
                    <button id="onboarding-submit-btn" type="submit" disabled={loading} className={pb}>{loading ? "Setting up your profile…" : "Complete Registration →"}</button>
                  </form>
                )}
              </div>
            )}

            {mode === "forgot" && (
              <div>
                <button id="forgot-back-btn" onClick={() => goTo("login", "left")} className={bk}>← Back to Sign In</button>
                <div className="mb-7"><h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 tracking-tight">Reset your password</h2><p className="mt-1 text-gray-500 dark:text-zinc-400 text-sm">Enter your email and we'll send a reset link.</p></div>
                <form id="forgot-form" onSubmit={handleForgotPassword} className="space-y-4">
                  <input id="forgot-email" type="email" placeholder="your@email.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className={ic} required autoFocus />
                  <button id="forgot-submit-btn" type="submit" disabled={loading} className={pb}>{loading ? "Sending…" : "Send Reset Link"}</button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;