import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const EyeIcon = ({ open }) =>
  open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

const Auth = () => {
  const { 
    user, 
    onboardingUser, 
    signUpWithEmail, 
    signInWithEmail, 
    signInWithGoogle, 
    completeGoogleOnboarding,
    resetPassword
  } = useAuth();
  const { highContrastMode } = useUdl();
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode: "login" | "register" | "onboarding" | "forgot"
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Password visibility toggle
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [institution, setInstitution] = useState("");
  const [idCardFile, setIdCardFile] = useState(null);
  // Forgot password email
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    const defaultMode = searchParams.get("mode") === "register" ? "register" : "login";
    setMode(defaultMode);
  }, [searchParams]);

  useEffect(() => {
    if (onboardingUser) {
      setMode("onboarding");
    }
  }, [onboardingUser]);

  useEffect(() => {
    if (user && !onboardingUser) {
      navigate("/profile");
    }
  }, [user, onboardingUser, navigate]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setIdCardFile(e.target.files[0]);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      navigate("/profile");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // place/state/country deferred to profile settings
      const profileData = { name, role, institution, place: "", state: "", country: "" };
      await signUpWithEmail(email, password, profileData, idCardFile);
      navigate("/profile");
    } catch (err) {
      setError(err.message || "Failed to create an account.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profileData = { 
        name: onboardingUser?.displayName || name || "Google User", 
        role, 
        institution,
        place: "",
        state: "",
        country: ""
      };
      await completeGoogleOnboarding(profileData, idCardFile);
      navigate("/profile");
    } catch (err) {
      setError(err.message || "Onboarding setup failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!resetEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setSuccessMsg("Password reset email sent! Check your inbox (and spam folder).");
    } catch (err) {
      setError(err.message || "Failed to send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  // UDL style classes
  const boxBgClass = highContrastMode 
    ? "bg-black border-2 border-yellow-400 text-yellow-400" 
    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 shadow-xl";

  const buttonClass = highContrastMode
    ? "bg-black text-yellow-400 border-2 border-yellow-400 hover:bg-yellow-400 hover:text-black font-extrabold w-full py-2.5 px-4 rounded-lg transition"
    : "w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow transition duration-200";

  const inputClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400 focus:ring-0 placeholder-yellow-600 w-full px-3 py-2 rounded-lg"
    : "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";

  const labelClass = "block text-xs font-semibold uppercase tracking-wider mb-1 text-gray-600 dark:text-gray-400";

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className={`w-full max-w-md p-8 rounded-xl ${boxBgClass}`}>
        
        {/* Error / Success banners */}
        {error && (
          <div className="mb-5 p-3.5 text-sm rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-5 p-3.5 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
            {successMsg}
          </div>
        )}

        {/* ── ONBOARDING VIEW ─────────────────────────────────────────────── */}
        {mode === "onboarding" ? (
          <div>
            <div className="mb-6 text-center">
              <span className="text-3xl">🎉</span>
              <h2 className="text-xl font-bold mt-2">Almost there!</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Welcome, {onboardingUser?.displayName || "new member"}! Complete your profile to get started.
              </p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>I am a…</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} required>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher / Educator</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Admin and Expert roles require manual verification.</p>
              </div>

              <div>
                <label className={labelClass}>Institution Name</label>
                <input
                  type="text"
                  placeholder="e.g. Oakridge High School"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Upload ID Card <span className="font-normal normal-case text-gray-400">(optional — helps verification)</span></label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Setting up your profile…" : "Complete Registration →"}
              </button>
            </form>
          </div>

        ) : mode === "forgot" ? (
          /* ── FORGOT PASSWORD VIEW ──────────────────────────────────────── */
          <div>
            <button
              onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }}
              className="mb-4 flex items-center gap-1 text-xs text-gray-400 hover:text-purple-600 transition"
            >
              ← Back to Sign In
            </button>
            <h2 className="text-xl font-bold mb-1">Reset your password</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Enter your account email and we'll send you a reset link.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  placeholder="you@school.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className={buttonClass}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          </div>

        ) : (
          /* ── LOGIN / REGISTER VIEWS ─────────────────────────────────────── */
          <div>
            {/* Tab switcher */}
            <div className="flex justify-center space-x-6 mb-7 border-b border-gray-200 dark:border-gray-700 pb-4">
              {["login", "register"].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); setSuccessMsg(""); }}
                  className={`pb-1 text-sm font-bold tracking-wider uppercase border-b-2 transition ${
                    mode === m
                      ? "border-purple-600 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            <h2 className="text-xl font-bold text-center mb-5">
              {mode === "login" ? "Welcome back 👋" : "Create your account"}
            </h2>

            {mode === "login" ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-10`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                {/* Forgot Password link */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); setResetEmail(email); }}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={loading} className={buttonClass}>
                  {loading ? "Signing In…" : "Sign In"}
                </button>
              </form>
            ) : (
              /* REGISTER FORM — simplified, defers location to profile */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@school.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-10`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>I am a…</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} required>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher / Educator</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Admin and Expert roles require manual verification.</p>
                </div>

                <div>
                  <label className={labelClass}>Institution Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Oakridge High School"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Upload ID Card <span className="font-normal normal-case text-gray-400">(optional)</span></label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">You can also complete your location details later from your profile.</p>
                </div>

                <button type="submit" disabled={loading} className={buttonClass}>
                  {loading ? "Creating Account…" : "Create Account"}
                </button>
              </form>
            )}

            {/* Google separator */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 border py-2.5 rounded-lg transition duration-200 ${
                highContrastMode 
                  ? 'border-yellow-400 bg-black text-yellow-400 hover:bg-yellow-400 hover:text-black font-bold' 
                  : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850'
              }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.386-2.876-6.386-6.386 0-3.51 2.876-6.386 6.386-6.386 1.63 0 3.09.617 4.2 1.638l3.125-3.125C18.6 1.848 15.683 1 12.24 1 6.032 1 1 6.032 1 12.24s5.032 11.24 11.24 11.24c6.478 0 11.24-4.558 11.24-11.24 0-.79-.085-1.543-.243-1.954H12.24z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
