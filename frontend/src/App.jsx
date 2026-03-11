import { useState, useEffect } from "react";
import { auth } from "./services/firebase";
import { registerUser, getSocket, initSocket } from "./services/socket";
import Login from "./pages/Login";
import Friends from "./pages/Friends";
import Talk from "./pages/Talk";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("friends"); // friends | talk
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncoming, setShowIncoming] = useState(false);

  useEffect(() => {
    initSocket();
    const unsub = auth.onAuthStateChanged((u) => {

      setUser(u);
      setAuthLoading(false);
      if (u) {
        registerUser({ 
          uid: u.uid,
          phoneNumber: u.phoneNumber, 
          email: u.email,
          displayName: u.displayName
        });
      }


    });
    return unsub;
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    registerUser({ 
      uid: u.uid,
      phoneNumber: u.phoneNumber, 
      email: u.email,
      displayName: u.displayName
    });
  };



  const handleSelectFriend = async (friend) => {
    // Request mic permission on user click (required by mobile browsers)
    const { warmUpMedia } = await import("./services/webrtc");
    const ready = await warmUpMedia();
    
    if (ready) {
      setSelectedFriend(friend);
      setIncomingCall(null);
      setView("talk");
    } else {
      alert("Please allow microphone access to use the WalkieTalkie.");
    }
  };


  const handleIncomingCall = ({ from, offer }) => {
    // Find friend from contacts or create placeholder
    setSelectedFriend({ phoneNumber: from, displayName: from });
    setIncomingCall({ from, offer });
    setView("talk");
  };

  const handleHangUp = () => {
    setView("friends");
    setSelectedFriend(null);
    setIncomingCall(null);
  };

  if (authLoading) {
    return (
      <div className="splash">
        <span className="logo-icon">📻</span>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (view === "talk" && selectedFriend) {
    return (
      <Talk
        user={user}
        friend={selectedFriend}
        incomingCall={incomingCall}
        onHangUp={handleHangUp}
      />
    );
  }

  return (
    <Friends
      user={user}
      onSelectFriend={handleSelectFriend}
      onIncomingCall={handleIncomingCall}
    />
  );
}
