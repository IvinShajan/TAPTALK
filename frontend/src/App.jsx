import { useState, useEffect } from "react";
import { getCurrentUser } from "./services/api";
import { registerUser, getSocket } from "./services/socket";
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
    const checkAuth = async () => {
      const u = getCurrentUser();
      setUser(u);
      setAuthLoading(false);
      if (u) {
        registerUser({ 
          phoneNumber: u.phoneNumber, 
          email: u.email 
        });
      }
    };
    checkAuth();
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    registerUser({ 
      phoneNumber: u.phoneNumber, 
      email: u.email 
    });
  };


  const handleSelectFriend = (friend) => {
    setSelectedFriend(friend);
    setIncomingCall(null);
    setView("talk");
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
