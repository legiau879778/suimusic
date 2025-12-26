"use client";

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAC-SHpPX7J5nFBXJRZzBAytlecpfGeHTY",
  authDomain: "suimusic.firebaseapp.com",
  projectId: "suimusic",
  storageBucket: "suimusic.firebasestorage.app",
  messagingSenderId: "201229745308",
  appId: "1:201229745308:web:b9683cf16858063e618159",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();