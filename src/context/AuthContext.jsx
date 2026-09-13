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
  setPersistence,
  updateProfile
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  collection,
  updateDoc,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { auth, db, storage } from "../firebase";

// DEV_MODE bypasses authentication for local sandbox testing.
// Set to false for production authentication.
const DEV_MODE = false;

const AuthContext = createContext(null);

// Helper function to award Contributor Badge to user (idempotent)
export const awardLoginBadge = async (uid) => {
  if (!uid) return;
  try {
    const q = query(
      collection(db, "badges"),
      where("user_id", "==", uid),
      where("badge_name", "==", "Contributor")
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return; // Already awarded
    }
  } catch (err) {
    console.error("Failed checking existing contributor badge", err);
  }

  const badgeDetails = {
    title: "you earned a badge",
    badgeName: "Contributor",
    description: "Earned for completing registration & account setup!"
  };
  try {
    await addDoc(collection(db, "badges"), {
      user_id: uid,
      category: "account_setup",
      level: 1,
      badge_name: "Contributor",
      badge_icon: "award",
      description: "Earned for completing registration & account setup!",
      awarded_at: serverTimestamp()
    });
    sessionStorage.setItem("mc_pending_badge_popup", JSON.stringify(badgeDetails));
    window.dispatchEvent(new CustomEvent("mc_badge_earned", { detail: badgeDetails }));
  } catch (err) {
    console.error("Failed to write login badge to firestore", err);
  }
};

// Helper function to award Authorized Badge to user when profile reaches 100% (idempotent)
export const awardAuthorisedUserBadge = async (uid) => {
  if (!uid) return;
  try {
    const q = query(collection(db, "badges"), where("user_id", "==", uid));
    const snap = await getDocs(q);
    const existing = snap.docs.some(d => {
      const bName = d.data()?.badge_name;
      return bName === "Authorized" || bName === "Authorised User" || bName === "authorized";
    });
    if (existing) {
      return; // Already awarded
    }
  } catch (err) {
    console.error("Failed checking existing authorized badge", err);
  }

  const badgeDetails = {
    title: "you earned a badge",
    badgeName: "Authorized",
    description: "Earned for completing 100% of your profile setup!"
  };
  try {
    await addDoc(collection(db, "badges"), {
      user_id: uid,
      category: "account_setup",
      level: 2,
      badge_name: "Authorized",
      badge_icon: "shield-check",
      description: "Earned for completing 100% of your profile setup!",
      awarded_at: serverTimestamp()
    });
    sessionStorage.setItem("mc_pending_badge_popup", JSON.stringify(badgeDetails));
    window.dispatchEvent(new CustomEvent("mc_badge_earned", { detail: badgeDetails }));
  } catch (err) {
    console.error("Failed to write authorized user badge to firestore", err);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(DEV_MODE ? { name: "Guest Developer", role: "admin", institution: "Sandbox", is_verified: true, setup_completed: true } : null);
  const [loading, setLoading] = useState(!DEV_MODE);
  const [onboardingUser, setOnboardingUser] = useState(null);

  // Helper function to create Firestore profile & user_stats for a new user
  const createUserProfile = async (uid, email, profileData, idCardFile) => {
    let id_card_url = null;
    if (idCardFile) {
      const storageRef = ref(storage, `id_cards/${uid}/${Date.now()}_${idCardFile.name}`);
      await uploadBytes(storageRef, idCardFile);
      id_card_url = await getDownloadURL(storageRef);
    }

    const userDocRef = doc(db, "users", uid);
    const statsDocRef = doc(db, "user_stats", uid);
    const verificationDocRef = doc(db, "users", uid, "private", "verification");

    // Sanitize role: support all requested registration roles
    const allowedRoles = ["student", "teacher", "research", "parent", "other"];
    const sanitizedRole = allowedRoles.includes(profileData?.role) ? profileData.role : "student";
    const setupCompleted = profileData?.setup_completed !== undefined
      ? profileData.setup_completed
      : Boolean(profileData?.institution || (profileData?.role && profileData.role !== "student"));

    // Write profile and user_stats documents inside a transaction
    await runTransaction(db, async (transaction) => {
      transaction.set(userDocRef, {
        id: uid,
        name: profileData?.name || "Anonymous",
        email: email,
        role: sanitizedRole,
        institution: profileData?.institution || "",
        place: profileData?.place || "",
        state: profileData?.state || "",
        country: profileData?.country || "",
        setup_completed: setupCompleted,
        is_verified: false,
        banned: false,
        created_at: serverTimestamp()
      });

      if (id_card_url) {
        transaction.set(verificationDocRef, {
          id_card_url: id_card_url,
          uploaded_at: serverTimestamp()
        });
      }

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
    const data = snap.data();
    if (id_card_url) {
      data.id_card_url = id_card_url;
    }
    return data;
  };

  // Helper function to update user profile in Firestore & local state
  const updateUserProfile = async (updates) => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    await updateDoc(userDocRef, updates);
    setProfile(prev => (prev ? { ...prev, ...updates } : updates));
  };

  // Handle email/password sign up
  const signUpWithEmail = async (email, password, profileData, idCardFile, rememberMe = true) => {
    const persistenceMode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceMode);
    setLoading(true);
    let userCredential = null;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      const userProfile = await createUserProfile(uid, email, profileData, idCardFile);
      setProfile(userProfile);
      setUser(userCredential.user);
      await awardLoginBadge(uid);
      setLoading(false);
      return userCredential.user;
    } catch (error) {
      // Rollback: if Firebase Auth user was created but profile/storage failed, cleanup the Auth user so email is not stranded
      if (userCredential && userCredential.user) {
        try {
          await userCredential.user.delete();
        } catch (cleanupErr) {
          console.error("Failed to rollback user creation after profile error", cleanupErr);
        }
      }
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
  const completeMagicLinkSignIn = async (url, explicitEmail = null, rememberMe = true) => {
    if (!isSignInWithEmailLink(auth, url)) {
      throw new Error("Not a valid sign-in link.");
    }
    const storedEmail = explicitEmail || window.localStorage.getItem("mcEmailForSignIn");
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
      await awardLoginBadge(uid);
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
          const verifDocRef = doc(db, "users", currentUser.uid, "private", "verification");
          unsubProfile = onSnapshot(userDocRef, async (snap) => {
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
                try {
                  const verifSnap = await getDoc(verifDocRef);
                  if (verifSnap.exists() && verifSnap.data().id_card_url) {
                    profileData.id_card_url = verifSnap.data().id_card_url;
                  }
                } catch (e) {
                  // Ignore if private verification doc does not exist
                }
                setProfile(profileData);
                setUser(currentUser);
                setOnboardingUser(null);
                // Ensure Contributor badge is awarded on account registration / sign-in (idempotent)
                if (currentUser.uid) {
                  awardLoginBadge(currentUser.uid);
                }
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

  // Helper to update user avatar both locally and in Firestore / Auth
  const updateUserAvatar = async (avatarUrl) => {
    // 1. Update local state immediately
    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : { avatar_url: avatarUrl }));

    // 2. Persist in localStorage for instant offline & reload hydration
    try {
      if (user?.uid) {
        localStorage.setItem(`mc_avatar_${user.uid}`, avatarUrl);
      }
      localStorage.setItem("mc_avatar_latest", avatarUrl);
    } catch (e) {
      console.warn("Could not save avatar to localStorage", e);
    }

    // 3. Update Firebase Auth user photoURL if available
    if (auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { photoURL: avatarUrl });
      } catch (e) {
        console.warn("Could not update auth photoURL", e);
      }
    }

    // 4. Update Firestore users collection if user has a valid UID
    if (user?.uid && user.uid !== "guest_dev") {
      const userRef = doc(db, "users", user.uid);
      try {
        await updateDoc(userRef, { avatar_url: avatarUrl });
      } catch (err) {
        try {
          // If doc doesn't exist yet, create with merge
          await setDoc(userRef, {
            id: user.uid,
            name: profile?.name || user.displayName || "User",
            email: user.email || "",
            role: profile?.role || "student",
            avatar_url: avatarUrl,
            created_at: serverTimestamp()
          }, { merge: true });
        } catch (setErr) {
          console.warn("Firestore setDoc avatar merge warning:", setErr);
        }
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      setProfile,
      updateUserAvatar,
      onboardingUser,
      loading,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      completeGoogleOnboarding,
      updateUserProfile,
      signOut,
      resetPassword,
      sendMagicLink,
      completeMagicLinkSignIn,
      isMagicLinkUrl,
      awardLoginBadge,
      awardAuthorisedUserBadge,
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
