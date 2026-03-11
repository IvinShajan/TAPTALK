import { sendOffer, sendAnswer, sendIceCandidate, getSocket } from "./socket";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Add free TURN server for production (e.g., Metered.ca free tier)
    // { urls: "turn:...", username: "...", credential: "..." },
  ],
};

let peerConnection = null;
let localStream = null;
let pendingCandidates = [];
let onCallEndedCb = null;

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

async function getMicStream() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  return localStream;
}

function createPeerConnection(friendPhone, myPhone) {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  remotePhoneNumber = friendPhone;

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) sendIceCandidate(normalizeId(friendPhone), candidate);
  };


  pc.ontrack = ({ streams }) => {
    const audio = document.getElementById("remote-audio");
    if (audio) audio.srcObject = streams[0];
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
  // Ensure mic starts muted for PTT
  stream.getAudioTracks().forEach(t => t.enabled = false);
  
  const pc = createPeerConnection(friendPhone, myPhone);

  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendOffer(normalizeId(friendPhone), offer, normalizeId(myPhone));
}


// ── Callee ────────────────────────────────────────────────────────────────────

export async function acceptCall(friendPhone, offer, myPhone) {
  const stream = await getMicStream();
  // Ensure mic starts muted for PTT
  stream.getAudioTracks().forEach(t => t.enabled = false);

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
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
}
