import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  runTransaction
} from "firebase/firestore";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import { auth, db, storage } from "../firebase";

const DEV_MODE = false;

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
  const signInWithEmail = async (email, password) => {
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

  // Google Sign In with Intercept Onboarding Flow
  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      // Check if user has a document in Firestore
      const userDocRef = doc(db, "users", googleUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const profileData = userDocSnap.data();
        if (profileData.banned) {
          await firebaseSignOut(auth);
          throw new Error("This account has been banned.");
        }
        setProfile(profileData);
        setUser(googleUser);
      } else {
        // Intercept loading, set onboarding user so the UI renders the onboarding form
        setOnboardingUser(googleUser);
      }
      setLoading(false);
      return googleUser;
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

  // Listen to Auth state changes
  useEffect(() => {
    if (DEV_MODE) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data();
            if (profileData.banned) {
              await firebaseSignOut(auth);
              setProfile(null);
              setUser(null);
            } else {
              setProfile(profileData);
              setUser(currentUser);
            }
          } else {
            // Google user who hasn't finished onboarding yet
            const isGoogle = currentUser.providerData.some(p => p.providerId === "google.com");
            if (isGoogle) {
              setOnboardingUser(currentUser);
              setUser(null);
              setProfile(null);
            }
          }
        } catch (e) {
          console.error("Failed to load user profile", e);
        }
      } else {
        setUser(null);
        setProfile(null);
        setOnboardingUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
      signOut
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
