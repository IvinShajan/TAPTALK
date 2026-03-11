const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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

    // Store full user object
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

  // Search Render's "live database" for a user
  socket.on("search-user", ({ identifier }, callback) => {
    const user = onlineUsers.get(identifier);
    if (user) {
      callback({ found: true, user });
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
