import { useState, useEffect } from "react";
import { getFriends, addFriend, logout, searchUsers } from "../services/api";
import { checkFriendOnline, getSocket, disconnectSocket } from "../services/socket";

export default function Friends({ user, onSelectFriend, onIncomingCall }) {
  const [friends, setFriends] = useState([]);
  const [onlineMap, setOnlineMap] = useState({});
  const [addInput, setAddInput] = useState("");
  const [searchResults, setSearchResults] = useState([]);
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

  const handleSearch = async (query) => {
    setAddInput(query);
    setAddError("");
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await searchUsers(query, user.uid);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFriend = async (contactInfo) => {
    setAddError("");
    setAddLoading(true);
    try {
      await addFriend(user.uid, contactInfo);
      setAddInput("");
      setSearchResults([]);
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
        <div className="header-right">
          <button className="btn-add" onClick={() => { disconnectSocket(); logout(); }} style={{ marginRight: 8, background: '#444' }}>
            Logout
          </button>
          <button className="btn-add" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "✕" : "+ Friend"}
          </button>
        </div>
      </header>

      {showAdd && (
        <div className="add-friend-panel" style={{ paddingBottom: searchResults.length ? '8px' : '16px' }}>
          <input
            type="text"
            placeholder="Search users by name, email or phone..."
            value={addInput}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={addLoading}
            autoFocus
          />

          {addError && <p className="error">{addError}</p>}
          
          {searchResults.length > 0 && (
            <div className="search-results" style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
              {searchResults.map((su) => (
                 <div 
                   key={su.uid} 
                   className="friend-item" 
                   style={{ background: 'var(--bg-card)', marginBottom: '8px', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                   onClick={() => handleAddFriend(su.phoneNumber || su.email)}
                 >
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <div className="friend-avatar" style={{ width: '32px', height: '32px', fontSize: '14px' }}>
                       {(su.displayName || su.phoneNumber || su.email).charAt(0).toUpperCase()}
                     </div>
                     <div className="friend-info">
                       <span className="friend-name" style={{ fontSize: '14px' }}>{su.displayName}</span>
                       <span className="friend-phone" style={{ fontSize: '12px' }}>{su.phoneNumber || su.email}</span>
                     </div>
                   </div>
                   <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', minWidth: 'auto' }}>
                     + Add
                   </button>
                 </div>
              ))}
            </div>
          )}
          
          {addInput.trim() && searchResults.length === 0 && !addLoading && (
            <p style={{ marginTop: '10px', fontSize: '14px', color: '#999', textAlign: 'center' }}>No users found.</p>
          )}
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
