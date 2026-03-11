import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ["websocket"] });
  }
  return socket;
}

let currentUserData = null;

export function registerUser(userData) {
  currentUserData = userData;
  const s = getSocket();
  if (s.connected) {
    s.emit("register", userData);
  }
}

export function initSocket() {
  const s = getSocket();
  s.on("connect", () => {
    if (currentUserData) {
      s.emit("register", currentUserData);
    }
  });
}

export function searchUserViaSocket(identifier) {
  return new Promise((resolve) => {
    getSocket().emit("search-user", { identifier }, (response) => {
      resolve(response.found ? response.user : null);
    });
  });
}




export function checkFriendOnline(identifier) {
  return new Promise((resolve) => {
    // Backend expects { phoneNumber } but we'll send identifier for compatibility
    getSocket().emit("check-online", { phoneNumber: identifier }, ({ online }) => {
      resolve(online);
    });
  });
}


export function sendOffer(to, offer, from) {
  getSocket().emit("call-offer", { to, offer, from });
}

export function sendAnswer(to, answer) {
  getSocket().emit("call-answer", { to, answer });
}

export function sendIceCandidate(to, candidate) {
  getSocket().emit("ice-candidate", { to, candidate });
}

export function rejectCall(to) {
  getSocket().emit("reject-call", { to });
}

export function hangUp(to) {
  getSocket().emit("hang-up", { to });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
