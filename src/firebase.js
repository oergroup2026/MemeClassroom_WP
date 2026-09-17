import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCPj6kt9a1eud75ViungkGmRMnX6FiRSM0",
  authDomain: "memeclassroom-98d2b.firebaseapp.com",
  projectId: "memeclassroom-98d2b",
  storageBucket: "memeclassroom-98d2b.firebasestorage.app",
  messagingSenderId: "981337458392",
  appId: "1:981337458392:web:23c34f7ac50a5b3dc8b9ad",
  measurementId: "G-TQ545HKP94"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
