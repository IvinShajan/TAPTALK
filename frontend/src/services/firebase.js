import { initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();


// ── Auth ──────────────────────────────────────────────────────────────────────

export function setupRecaptcha(containerId) {
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {},
  });
  return window.recaptchaVerifier;
}

export async function sendOTP(phoneNumber) {
  const verifier = setupRecaptcha("recaptcha-container");
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  window.confirmationResult = confirmationResult;
  return confirmationResult;
}

export async function verifyOTP(otp) {
  const result = await window.confirmationResult.confirm(otp);
  return result.user;
}

export async function logout() {
  await signOut(auth);
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}


// ── Firestore ─────────────────────────────────────────────────────────────────

export async function saveUserProfile(uid, phoneNumber, displayName, email) {
  const data = {
    uid,
    displayName: displayName || phoneNumber || email || "User",
    createdAt: Date.now(),
  };
  if (phoneNumber) data.phoneNumber = phoneNumber;
  if (email) data.email = email;

  await setDoc(doc(db, "users", uid), data, { merge: true });
}


export async function getUserByPhone(phoneNumber) {
  const q = query(collection(db, "users"), where("phoneNumber", "==", phoneNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function getUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}


export async function addFriend(myUid, contactInfo) {
  let friend = null;
  // Simple check for email vs phone
  if (contactInfo.includes("@")) {
    friend = await getUserByEmail(contactInfo);
  } else {
    friend = await getUserByPhone(contactInfo);
  }
  
  if (!friend) throw new Error("No user found with that phone or email.");
  
  await setDoc(doc(db, "users", myUid, "friends", friend.uid), {
    uid: friend.uid,
    phoneNumber: friend.phoneNumber || null,
    email: friend.email || null,
    displayName: friend.displayName,
    addedAt: Date.now(),
  });
  return friend;
}


export async function getFriends(myUid) {
  const snap = await getDocs(collection(db, "users", myUid, "friends"));
  return snap.docs.map((d) => d.data());
}
