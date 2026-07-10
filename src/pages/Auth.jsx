import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUdl } from "../context/UdlContext";

const Auth = () => {
  const {
    user,
    onboardingUser,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    completeGoogleOnboarding
  } = useAuth();
  const { highContrastMode } = useUdl();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Mode: "login" | "register" | "onboarding"
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form Fields State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student"); // Guardrails enforced (dropdown only has student/teacher)
  const [institution, setInstitution] = useState("");
  const [place, setPlace] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [idCardFile, setIdCardFile] = useState(null);

  useEffect(() => {
    const defaultMode = searchParams.get("mode") === "register" ? "register" : "login";
    setMode(defaultMode);
  }, [searchParams]);

  // Adjust mode to onboarding if AuthContext intercepts onboardingUser
  useEffect(() => {
    if (onboardingUser) {
      setMode("onboarding");
    }
  }, [onboardingUser]);

  // Redirect if fully logged in
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

  const formatFirebaseError = (err, defaultMsg) => {
    const code = err?.code || "";
    const message = err?.message || "";

    // Check if network/internet issue
    if (
      code === "auth/network-request-failed" ||
      !navigator.onLine ||
      message.toLowerCase().includes("network") ||
      message.toLowerCase().includes("internet")
    ) {
      return "Internet issue: Please check your connection and try again.";
    }

    // Check if credentials wrong
    if (
      code === "auth/invalid-credential" ||
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/invalid-email"
    ) {
      return "Opps! Invalid Username or Password. Please cross-verify and try again....";
    }

    return message || defaultMsg;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      navigate("/profile");
    } catch (err) {
      setError(formatFirebaseError(err, "Failed to sign in. Please verify your credentials."));
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
      const profileData = { name, role, institution, place, state, country };
      await signUpWithEmail(email, password, profileData, idCardFile);
      navigate("/profile");
    } catch (err) {
      setError(formatFirebaseError(err, "Failed to create an account."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const loggedUser = await signInWithGoogle();
      // Google AuthContext checks if user exists. If yes, AuthContext logs in.
      // If no, AuthContext populates onboardingUser and triggers the intercept.
    } catch (err) {
      setError(formatFirebaseError(err, "Google Sign-In failed."));
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
        place,
        state,
        country
      };
      await completeGoogleOnboarding(profileData, idCardFile);
      navigate("/profile");
    } catch (err) {
      setError(formatFirebaseError(err, "Onboarding setup failed."));
    } finally {
      setLoading(false);
    }
  };

  // Base background theme selectors based on UDL setting
  const boxBgClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400"
    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 shadow-xl";

  const buttonClass = highContrastMode
    ? "bg-black text-yellow-400 border-2 border-yellow-400 hover:bg-yellow-400 hover:text-black font-extrabold"
    : "w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition duration-200";

  const inputClass = highContrastMode
    ? "bg-black border-2 border-yellow-400 text-yellow-400 focus:ring-0 placeholder-yellow-600"
    : "w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500";

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className={`w-full max-w-lg p-8 rounded-xl ${boxBgClass}`}>

        {error && (
          <div className="mb-6 p-4 text-sm rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-650">
            {error}
          </div>
        )}

        {/* ONBOARDING INTERCEPT MODAL VIEW */}
        {mode === "onboarding" ? (
          <div>
            <h2 className="text-2xl font-bold text-center mb-2">Onboarding Intercept</h2>
            <p className="text-xs text-center text-gray-500 mb-6">
              Welcome {onboardingUser?.displayName || "Member"}! Please complete your school details to finish registration.
            </p>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Select Starting Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Admin and Expert roles require verification and cannot be self-selected.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Institution Name</label>
                <input
                  type="text"
                  placeholder="e.g. Oakridge High School"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Place / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Boston"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">State / Province</label>
                  <input
                    type="text"
                    placeholder="e.g. MA"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Country</label>
                <input
                  type="text"
                  placeholder="e.g. United States"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Upload ID Card (Optional)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={buttonClass}
              >
                {loading ? "Completing Profile..." : "Complete Registration"}
              </button>
            </form>
          </div>
        ) : (
          /* REGULAR LOGIN / REGISTER VIEWS */
          <div>
            <div className="flex justify-center space-x-4 mb-8 border-b border-gray-250 dark:border-gray-700 pb-4">
              <button
                onClick={() => { setMode("login"); setError(""); }}
                className={`pb-2 text-sm font-bold tracking-wider uppercase border-b-2 transition ${mode === "login"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-400 hover:text-gray-500"
                  }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode("register"); setError(""); }}
                className={`pb-2 text-sm font-bold tracking-wider uppercase border-b-2 transition ${mode === "register"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-gray-400 hover:text-gray-500"
                  }`}
              >
                Register
              </button>
            </div>

            <h2 className="text-xl font-bold text-center mb-6">
              {mode === "login" ? "Welcome back!" : "Create your account"}
            </h2>

            {mode === "login" ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Email Address</label>
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
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={buttonClass}
                >
                  {loading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            ) : (
              /* REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Name</label>
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
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Email Address</label>
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
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Role Selection</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={inputClass}
                    required
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Admin and Expert roles require verification and cannot be self-selected.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Institution Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Oakridge High School"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Place / City</label>
                    <input
                      type="text"
                      placeholder="e.g. Boston"
                      value={place}
                      onChange={(e) => setPlace(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1">State</label>
                    <input
                      type="text"
                      placeholder="e.g. MA"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Country</label>
                  <input
                    type="text"
                    placeholder="e.g. United States"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1">Upload ID Card (Optional)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={buttonClass}
                >
                  {loading ? "Registering Account..." : "Create Account"}
                </button>
              </form>
            )}

            {/* Google Login Separator */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-250 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-800 px-2 text-gray-400">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`w-full flex items-center justify-center space-x-2 border py-2.5 rounded-lg transition duration-200 ${highContrastMode
                ? 'border-yellow-400 bg-black text-yellow-400 hover:bg-yellow-400 hover:text-black font-bold'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850'
                }`}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.386-2.876-6.386-6.386 0-3.51 2.876-6.386 6.386-6.386 1.63 0 3.09.617 4.2 1.638l3.125-3.125C18.6 1.848 15.683 1 12.24 1 6.032 1 1 6.032 1 12.24s5.032 11.24 11.24 11.24c6.478 0 11.24-4.558 11.24-11.24 0-.79-.085-1.543-.243-1.954H12.24z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;