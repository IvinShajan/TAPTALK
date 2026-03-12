const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true
  },
});

// Map: userIdentifier -> socketId
const onlineUsers = new Map();
// Map: socketId -> userIdentifier
const socketToUser = new Map();

const { getOrCreateUser, addFriend, getFriends, getUserByContact, searchUsers } = require("./db");

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/login", (req, res) => {
  const { contactInfo, displayName } = req.body;
  if (!contactInfo) return res.status(400).json({ error: "Contact info required" });
  try {
    const user = getOrCreateUser(contactInfo, displayName);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/search", (req, res) => {
  const { q, uid } = req.query;
  try {
    const results = searchUsers(q, uid);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/friends/:uid", (req, res) => {
  const { uid } = req.params;
  try {
    const friends = getFriends(uid);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/friends", (req, res) => {
  const { uid, contactInfo } = req.body;
  if (!uid || !contactInfo) return res.status(400).json({ error: "Missing fields" });
  try {
    const friend = addFriend(uid, contactInfo);
    res.json(friend);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // User comes online
  socket.on("register", ({ phoneNumber, email }) => {
    const id = phoneNumber || email;
    onlineUsers.set(id, socket.id);
    socketToUser.set(socket.id, id);
    console.log(`Registered: ${id} -> ${socket.id}`);

    // Notify all friends that this user is online
    socket.broadcast.emit("friend-status", {
      phoneNumber,
      email,
      online: true,
    });
  });


  // Check if a friend is online
  socket.on("check-online", ({ phoneNumber, email }, callback) => {
    const id = phoneNumber || email;
    callback({ online: onlineUsers.has(id) });
  });


  // WebRTC signaling: offer
  socket.on("call-offer", ({ to, offer, from }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("incoming-call", { from, offer });
    } else {
      socket.emit("call-failed", { reason: "User is offline" });
    }
  });

  // WebRTC signaling: answer
  socket.on("call-answer", ({ to, answer }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("call-answered", { answer });
    }
  });

  // WebRTC signaling: ICE candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("ice-candidate", { candidate });
    }
  });

  // Call rejected
  socket.on("reject-call", ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("call-rejected");
    }
  });

  // Hang up
  socket.on("hang-up", ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("call-ended");
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    const id = socketToUser.get(socket.id);
    if (id) {
      onlineUsers.delete(id);
      socketToUser.delete(socket.id);
      console.log(`Disconnected: ${id}`);
      
      // We don't necessarily know if it was a phone or email here without more state,
      // but emitting the ID as both is a safe fallback for simple matching.
      socket.broadcast.emit("friend-status", {
        phoneNumber: id.includes("@") ? null : id,
        email: id.includes("@") ? id : null,
        online: false,
      });
    }
  });

});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));
