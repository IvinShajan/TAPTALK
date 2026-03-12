const API_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "69420"
};

// ── Auth mock ─────────────────────────────────────────────────────────────────

// For the testing phase, we'll just mock OTP logic entirely and rely on backend
export function setupRecaptcha() {}

export async function sendOTP(phoneNumber) {
  // Mock sending OTP, just return a fake confirmation
  return { verificationId: 'testing123' };
}

export async function verifyOTP(phoneNumber, otp) { // Takes phone straight away instead
  // Mock login: directly request user from our local backend using phone
  const res = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ contactInfo: phoneNumber })
  });
  if (!res.ok) throw new Error("Local Login failed");
  const user = await res.json();
  // Save fake session to localStorage
  localStorage.setItem("local_user", JSON.stringify(user));
  return user;
}

export async function mockGoogleLogin(email, displayName) {
  const res = await fetch(`${API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ contactInfo: email, displayName })
  });
  if (!res.ok) throw new Error("Local Login failed");
  const user = await res.json();
  localStorage.setItem("local_user", JSON.stringify(user));
  return user;
}

export async function logout() {
  localStorage.removeItem("local_user");
  window.location.reload();
}

export function getCurrentUser() {
  const data = localStorage.getItem("local_user");
  return data ? JSON.parse(data) : null;
}

import { getSocket } from "./socket";

// ── Friends & DB mock ─────────────────────────────────────────────────────────

export async function addFriend(myUid, contactInfo) {
  return new Promise((resolve, reject) => {
    getSocket().emit("add-friend", { uid: myUid, contactInfo }, (res) => {
      if (res.success) resolve(res.friend);
      else reject(new Error(res.error || "Failed to add friend"));
    });
  });
}

export async function getFriends(myUid) {
  return new Promise((resolve, reject) => {
    getSocket().emit("get-friends", { uid: myUid }, (res) => {
      if (res.success) resolve(res.friends);
      else reject(new Error(res.error || "Failed to load friends"));
    });
  });
}

export async function searchUsers(query, excludeUid) {
  return new Promise((resolve, reject) => {
    getSocket().emit("search-users", { query, uid: excludeUid }, (res) => {
      if (res.success) resolve(res.results);
      else reject(new Error(res.error || "Search failed"));
    });
  });
}
