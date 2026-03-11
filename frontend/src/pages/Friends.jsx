import { useState, useEffect } from "react";
import { getFriends, addFriend } from "../services/firebase";
import { checkFriendOnline, getSocket } from "../services/socket";

export default function Friends({ user, onSelectFriend, onIncomingCall }) {
  const [friends, setFriends] = useState([]);
  const [onlineMap, setOnlineMap] = useState({});
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);


  // Load friends + online status
  const loadFriends = async () => {
    const list = await getFriends(user.uid);
    setFriends(list);
    const map = {};
    for (const f of list) {
      const id = f.phoneNumber || f.email;
      map[id] = await checkFriendOnline(id);
    }
    setOnlineMap(map);
  };


  useEffect(() => {
    loadFriends();

    const socket = getSocket();

    socket.on("friend-status", ({ phoneNumber, email, online }) => {
      const id = phoneNumber || email;
      setOnlineMap((prev) => ({ ...prev, [id]: online }));
    });


    socket.on("incoming-call", ({ from, offer }) => {
      onIncomingCall({ from, offer });
    });

    return () => {
      socket.off("friend-status");
      socket.off("incoming-call");
    };
  }, []);

  const handleAddFriend = async () => {
    setAddError("");
    if (!addInput.trim()) return;
    setAddLoading(true);
    try {
      // If it's not an email, format as a phone number
      const contact = addInput.includes("@") ? addInput : 
                      (addInput.startsWith("+") ? addInput : "+" + addInput);
      
      await addFriend(user.uid, contact.trim());
      setAddInput("");
      setShowAdd(false);
      await loadFriends();
    } catch (e) {
      setAddError(e.message);
    } finally {
      setAddLoading(false);
    }
  };


  const sortedFriends = [...friends].sort((a, b) => {
    const aid = a.phoneNumber || a.email;
    const bid = b.phoneNumber || b.email;
    const ao = onlineMap[aid] ? 1 : 0;
    const bo = onlineMap[bid] ? 1 : 0;
    return bo - ao;
  });


  return (
    <div className="friends-page">
      <header className="friends-header">
        <div className="header-left">
          <span className="header-logo">📻</span>
          <h2>WalkieTalk</h2>
        </div>
        <button className="btn-add" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "✕" : "+ Friend"}
        </button>
      </header>

      {showAdd && (
        <div className="add-friend-panel">
          <input
            type="text"
            inputMode="email"
            placeholder="+1 234 567 8900 or email@example.com"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddFriend()}
            autoFocus
          />



          <button className="btn-primary" onClick={handleAddFriend} disabled={addLoading}>
            {addLoading ? <span className="spinner small" /> : "Add"}
          </button>
          {addError && <p className="error">{addError}</p>}
        </div>
      )}

      <div className="online-count">
        {Object.values(onlineMap).filter(Boolean).length} online
      </div>

      {sortedFriends.length === 0 ? (
        <div className="empty-state">
          <span>🤙</span>
          <p>No friends yet. Add one above!</p>
        </div>
      ) : (
        <ul className="friends-list">
          {sortedFriends.map((f) => {
            const id = f.phoneNumber || f.email;
            const isOnline = onlineMap[id];
            
            return (
              <li
                key={f.uid}
                className={`friend-item ${isOnline ? "online" : "offline"}`}
                onClick={() => onSelectFriend(f)}
              >
                <div className="friend-avatar">
                  {(f.displayName || id).charAt(0).toUpperCase()}
                </div>
                <div className="friend-info">
                  <span className="friend-name">{f.displayName || id}</span>
                  <span className="friend-phone">{id}</span>
                </div>
                <div className="friend-status">
                  <span className={`dot ${isOnline ? "online" : ""}`} />
                  <span>{isOnline ? "Online" : "Offline"}</span>
                </div>
              </li>
            );
          })}
        </ul>

      )}
    </div>
  );
}
