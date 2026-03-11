const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");


const USERS_FILE = path.join(__dirname, "users.json");

// Load existing users from JSON file
let userRegistry = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    userRegistry = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (e) {
    console.error("Error loading users.json:", e);
  }
}

function saveRegistry() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(userRegistry, null, 2));
  } catch (e) {
    console.error("Error saving users.json:", e);
  }
}


const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Map: userIdentifier -> socketId
const onlineUsers = new Map();
// Map: socketId -> userIdentifier
const socketToUser = new Map();


app.get("/health", (req, res) => res.json({ status: "ok" }));

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // User comes online
  socket.on("register", (userData) => {
    const { phoneNumber, email, displayName, uid } = userData;
    const id = phoneNumber || email;
    
    if (!id) return;

    // 1. Save to JSON File Registry
    if (!userRegistry[id]) {
      userRegistry[id] = { ...userData, registeredAt: new Date().toISOString() };
      saveRegistry();
      console.log(`New user saved to registry: ${id}`);
    }

    // 2. Add to Online Map
    onlineUsers.set(id, { 
      socketId: socket.id, 
      ...userData 
    });
    
    socketToUser.set(socket.id, id);
    console.log(`Registered: ${id} [${displayName || 'No Name'}]`);

    // Notify all friends that this user is online
    socket.broadcast.emit("friend-status", {
      phoneNumber,
      email,
      online: true,
    });
  });

  // Search Render's JSON + Live database
  socket.on("search-user", ({ identifier }, callback) => {
    // Check live first, then registry
    const liveUser = onlineUsers.get(identifier);
    const registeredUser = userRegistry[identifier];

    if (liveUser) {
      callback({ found: true, user: liveUser });
    } else if (registeredUser) {
      callback({ found: true, user: registeredUser });
    } else {
      callback({ found: false });
    }
  });




  // Check if a friend is online
  socket.on("check-online", ({ phoneNumber, email }, callback) => {
    const id = phoneNumber || email;
    callback({ online: onlineUsers.has(id) });
  });


  // WebRTC signaling: offer
  socket.on("call-offer", ({ to, offer, from }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit("incoming-call", { from, offer });
    } else {
      socket.emit("call-failed", { reason: "User is offline" });
    }
  });


  // WebRTC signaling: answer
  socket.on("call-answer", ({ to, answer }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit("call-answered", { answer });
    }
  });


  // WebRTC signaling: ICE candidates
  socket.on("ice-candidate", ({ to, candidate }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit("ice-candidate", { candidate });
    }
  });


  // Call rejected
  socket.on("reject-call", ({ to }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit("call-rejected");
    }
  });


  // Hang up
  socket.on("hang-up", ({ to }) => {
    const target = onlineUsers.get(to);
    if (target) {
      io.to(target.socketId).emit("call-ended");
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
