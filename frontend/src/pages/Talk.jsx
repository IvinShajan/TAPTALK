import { useState, useEffect, useRef } from "react";
import {
  startCall,
  acceptCall,
  handleAnswer,
  handleIceCandidate,
  setMicActive,
  endCall,
  setCallEndedCallback,
} from "../services/webrtc";
import { hangUp, rejectCall, getSocket } from "../services/socket";

export default function Talk({ user, friend, incomingCall, onHangUp }) {
  const [callState, setCallState] = useState(
    incomingCall ? "incoming" : "connecting"
  );
  const [talking, setTalking] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);
  const holdRef = useRef(false);

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    setCallEndedCallback((reason) => {
      setCallState("ended");
      setTimeout(onHangUp, 1200);
    });

    const socket = getSocket();

    socket.on("call-answered", async ({ answer }) => {
      await handleAnswer(answer);
      setCallState("active");
      startTimer();
    });

    socket.on("call-rejected", () => {
      setCallState("rejected");
      setTimeout(onHangUp, 1200);
    });

    socket.on("call-ended", () => {
      setCallState("ended");
      setTimeout(onHangUp, 1200);
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      await handleIceCandidate(candidate);
    });

    // Initiate if outgoing
    if (!incomingCall) {
      const friendId = friend.phoneNumber || friend.email;
      const myId = user.phoneNumber || user.email;
      startCall(friendId, myId);
    }


    return () => {
      socket.off("call-answered");
      socket.off("call-rejected");
      socket.off("call-ended");
      socket.off("ice-candidate");
      clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(
      () => setCallDuration((d) => d + 1),
      1000
    );
  };

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    await acceptCall(
      incomingCall.from,
      incomingCall.offer,
      user.phoneNumber || user.email
    );
    setCallState("active");
    startTimer();
  };

  const handleReject = () => {
    rejectCall(incomingCall.from);
    endCall();
    onHangUp();
  };

  const handleHangUp = () => {
    hangUp(friend.phoneNumber || friend.email);
    endCall();

    clearInterval(timerRef.current);
    setCallState("ended");
    setTimeout(onHangUp, 800);
  };

  // Push-to-Talk
  const startTalking = () => {
    if (callState !== "active") return;
    holdRef.current = true;
    setTalking(true);
    setMicActive(true);
  };

  const stopTalking = () => {
    holdRef.current = false;
    setTalking(false);
    setMicActive(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="talk-page">
      <audio id="remote-audio" autoPlay playsInline />

      <div className="talk-card">
        <button className="back-btn" onClick={callState === "active" ? handleHangUp : onHangUp}>
          ←
        </button>

        <div className="friend-avatar large">
          {(friend.displayName || friend.phoneNumber || friend.email).charAt(0).toUpperCase()}
        </div>
        <h2 className="talk-name">{friend.displayName || friend.phoneNumber || friend.email}</h2>
        <p className="talk-phone">{friend.phoneNumber || friend.email}</p>


        {callState === "connecting" && (
          <div className="status-badge calling">
            <span className="pulse-ring" />
            Calling…
          </div>
        )}

        {callState === "incoming" && (
          <>
            <div className="status-badge incoming">Incoming Call</div>
            <div className="incoming-actions">
              <button className="btn-reject" onClick={handleReject}>✕ Decline</button>
              <button className="btn-accept" onClick={handleAccept}>✓ Accept</button>
            </div>
          </>
        )}

        {callState === "active" && (
          <>
            <div className="call-timer">{formatTime(callDuration)}</div>
            <div className="status-badge connected">Connected</div>

            <div
              className={`ptt-button ${talking ? "active" : ""}`}
              onMouseDown={startTalking}
              onMouseUp={stopTalking}
              onTouchStart={(e) => { e.preventDefault(); startTalking(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopTalking(); }}
            >
              <span className="ptt-icon">🎤</span>
              <span className="ptt-label">{talking ? "Talking…" : "Hold to Talk"}</span>
            </div>

            <button className="btn-hangup" onClick={handleHangUp}>
              ✕ End Call
            </button>
          </>
        )}

        {(callState === "ended" || callState === "rejected") && (
          <div className="status-badge ended">
            {callState === "rejected" ? "Call declined" : "Call ended"}
          </div>
        )}
      </div>
    </div>
  );
}
