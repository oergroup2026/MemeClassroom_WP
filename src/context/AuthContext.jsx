import React, { createContext, useContext, useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithRedirect,
  getRedirectResult,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink as firebaseSignInWithEmailLink,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  onSnapshot
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { auth, db, storage } from "../firebase";

// DEV_MODE bypasses authentication for local sandbox testing.
// To enable: create a .env.local file and add VITE_DEV_MODE=true
// It will NEVER activate in production builds (import.meta.env.DEV is false there).
const DEV_MODE = import.meta.env.DEV === true && import.meta.env.VITE_DEV_MODE === "true";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEV_MODE ? { uid: "guest_dev", email: "guest@memeclassroom.dev" } : null);
  const [profile, setProfile] = useState(DEV_MODE ? { name: "Guest Developer", role: "admin", institution: "Sandbox", is_verified: true } : null);
  const [onboardingUser, setOnboardingUser] = useState(null);
  const [loading, setLoading] = useState(DEV_MODE ? false : true);

  // Helper function to upload ID Card to Firebase Storage
  const uploadIdCard = async (userId, file) => {
    if (!file) return null;
    const storageRef = ref(storage, `id_cards/${userId}_id`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  };

  // Helper function to create user profile & stats in Firestore
  const createUserProfile = async (uid, email, profileData, idCardFile) => {
    let id_card_url = null;
    if (idCardFile) {
      id_card_url = await uploadIdCard(uid, idCardFile);
    }

    const userDocRef = doc(db, "users", uid);
    const statsDocRef = doc(db, "user_stats", uid);

    // Write profile and user_stats documents inside a transaction
    await runTransaction(db, async (transaction) => {
      transaction.set(userDocRef, {
        id: uid,
        name: profileData.name || "Anonymous",
        email: email,
        role: profileData.role, // 'student' | 'teacher'
        institution: profileData.institution,
        place: profileData.place,
        state: profileData.state,
        country: profileData.country,
        id_card_url: id_card_url || "",
        is_verified: false,
        banned: false,
        created_at: serverTimestamp()
      });

      transaction.set(statsDocRef, {
        memes_created_count: 0,
        resources_contributed_count: 0,
        staffroom_posts_count: 0,
        ratings_provided_count: 0,
        total_likes_received: 0
      });
    });

    // Fetch the newly created profile
    const snap = await getDoc(userDocRef);
    return snap.data();
  };

  // Handle email/password sign up
  const signUpWithEmail = async (email, password, profileData, idCardFile) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userProfile = await createUserProfile(uid, email, profileData, idCardFile);
      setProfile(userProfile);
      setUser(userCredential.user);
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Handle email/password sign in
  // rememberMe=true → LOCAL persistence (survives browser restart)
  // rememberMe=false → SESSION persistence (cleared when tab closes)
  const signInWithEmail = async (email, password, rememberMe = true) => {
    const persistenceMode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // ── Magic Link Sign-In ──────────────────────────────────────────────────────

  // Send a passwordless sign-in link to email
  const sendMagicLink = async (email) => {
    const actionCodeSettings = {
      url: `${window.location.origin}/auth`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Persist email locally so we can complete sign-in on return
    window.localStorage.setItem("mcEmailForSignIn", email);
  };

  // Returns true if the given URL is a valid email sign-in link
  const isMagicLinkUrl = (url) => isSignInWithEmailLink(auth, url);

  // Complete the magic link sign-in flow (called after user clicks link in email)
  const completeMagicLinkSignIn = async (url, rememberMe = true) => {
    if (!isSignInWithEmailLink(auth, url)) {
      throw new Error("Not a valid sign-in link.");
    }
    const storedEmail = window.localStorage.getItem("mcEmailForSignIn");
    if (!storedEmail) {
      throw new Error("EMAIL_NEEDED");
    }
    const persistenceMode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);
    setLoading(true);
    try {
      const result = await firebaseSignInWithEmailLink(auth, storedEmail, url);
      window.localStorage.removeItem("mcEmailForSignIn");
      return result.user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Google Sign In with Intercept Onboarding Flow
  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Switch back to signInWithPopup since COOP/COEP are no longer needed
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Complete Google Onboarding
  const completeGoogleOnboarding = async (profileData, idCardFile) => {
    if (!onboardingUser) throw new Error("No onboarding user found.");
    setLoading(true);
    try {
      const uid = onboardingUser.uid;
      const email = onboardingUser.email;
      const userProfile = await createUserProfile(uid, email, profileData, idCardFile);
      setProfile(userProfile);
      setUser(onboardingUser);
      setOnboardingUser(null);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Log Out
  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setProfile(null);
      setUser(null);
      setOnboardingUser(null);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Listen to Auth state changes
  useEffect(() => {
    if (DEV_MODE) return;

    // Check redirect result to capture redirect sign-in errors
    getRedirectResult(auth)
      .then((result) => {
        // Redirect sign-in succeeded — no action needed here; onAuthStateChanged handles profile load
      })
      .catch((error) => {
        console.error("Firebase redirect sign-in error:", error);
      });

    let unsubProfile = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          unsubProfile = onSnapshot(userDocRef, (snap) => {
            if (snap.exists()) {
              const profileData = snap.data();
              if (profileData.banned) {
                if (unsubProfile) {
                  unsubProfile();
                  unsubProfile = null;
                }
                firebaseSignOut(auth).then(() => {
                  setProfile(null);
                  setUser(null);
                  setOnboardingUser(null);
                });
              } else {
                setProfile(profileData);
                setUser(currentUser);
                setOnboardingUser(null);
              }
            } else {
              // User profile doesn't exist in Firestore; trigger onboarding
              setOnboardingUser(currentUser);
              setUser(null);
              setProfile(null);
            }
            setLoading(false);
          }, (err) => {
            console.error("Profile snapshot subscription error", err);
            setLoading(false);
          });
        } catch (e) {
          console.error("Failed to load user profile", e);
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setOnboardingUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      onboardingUser,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      completeGoogleOnboarding,
      signOut,
      resetPassword,
      sendMagicLink,
      completeMagicLinkSignIn,
      isMagicLinkUrl,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
