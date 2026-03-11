import { sendOffer, sendAnswer, sendIceCandidate, getSocket } from "./socket";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};


let peerConnection = null;
let localStream = null;
let pendingCandidates = [];
let onCallEndedCb = null;
let onRemoteStreamCb = null;


function normalizeId(id) {
  if (!id) return null;
  const s = id.trim();
  if (s.includes("@")) return s.toLowerCase();
  return s.startsWith("+") ? "+" + s.replace(/\D/g, "") : s.replace(/\D/g, "");
}


// ── Setup ─────────────────────────────────────────────────────────────────────

export function setCallEndedCallback(cb) {
  onCallEndedCb = cb;
}

export function setRemoteStreamCallback(cb) {
  onRemoteStreamCb = cb;
}


async function getMicStream() {
  if (localStream && localStream.active) return localStream;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    // Ensure tracks start enabled but muted for PTT
    localStream.getAudioTracks().forEach(t => t.enabled = false);
    return localStream;
  } catch (e) {
    console.error("Mic error:", e);
    throw new Error("Microphone permission denied. Please allow mic access to talk.");
  }
}

export async function warmUpMedia() {
  try {
    await getMicStream();
    // Warm up AudioContext for mobile
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
    }
    return true;
  } catch (e) {
    return false;
  }
}


function createPeerConnection(friendPhone, myPhone) {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  remotePhoneNumber = friendPhone;

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sendIceCandidate(normalizeId(friendPhone), candidate);
  };


  pc.ontrack = ({ streams }) => {
    console.log("Remote track received:", streams[0]);
    onRemoteStreamCb?.(streams[0]);
  };



  pc.onconnectionstatechange = () => {
    if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
      onCallEndedCb?.("remote");
    }
  };

  peerConnection = pc;
  return pc;
}

// ── Caller ────────────────────────────────────────────────────────────────────

export async function startCall(friendPhone, myPhone) {
  const stream = await getMicStream();
  // IMPORTANT: Keep enabled=true during negotiation so SDP is active
  stream.getAudioTracks().forEach(t => t.enabled = true);
  
  const pc = createPeerConnection(friendPhone, myPhone);
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendOffer(normalizeId(friendPhone), offer, normalizeId(myPhone));

  // Now mute for PTT standby
  setTimeout(() => {
    stream.getAudioTracks().forEach(t => t.enabled = false);
  }, 100);
}



// ── Callee ────────────────────────────────────────────────────────────────────

export async function acceptCall(friendPhone, offer, myPhone) {
  const stream = await getMicStream();
  // IMPORTANT: Keep enabled=true during negotiation
  stream.getAudioTracks().forEach(t => t.enabled = true);

  const pc = createPeerConnection(friendPhone, myPhone);
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  
  // Process pending ICE candidates
  while (pendingCandidates.length > 0) {
    const cand = pendingCandidates.shift();
    await pc.addIceCandidate(new RTCIceCandidate(cand));
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendAnswer(normalizeId(friendPhone), answer);

  // Now mute for PTT standby
  setTimeout(() => {
    stream.getAudioTracks().forEach(t => t.enabled = false);
  }, 100);
}



// ── Common ────────────────────────────────────────────────────────────────────

export async function handleAnswer(answer) {
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  
  // Process pending ICE candidates
  while (pendingCandidates.length > 0) {
    const cand = pendingCandidates.shift();
    await peerConnection.addIceCandidate(new RTCIceCandidate(cand));
  }
}


export async function handleIceCandidate(candidate) {
  if (!peerConnection || !peerConnection.remoteDescription) {
    pendingCandidates.push(candidate);
    return;
  }
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error("ICE error", e);
  }
}


// Push-to-talk: mute/unmute local audio
export function setMicActive(active) {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((t) => (t.enabled = active));
}

export function endCall() {
  setMicActive(false);
  peerConnection?.close();
  peerConnection = null;
  pendingCandidates = [];
  // Keep stream alive for next call
}


export function releaseMedia() {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
}

export function isMicReady() {
  return !!(localStream && localStream.active);
}

