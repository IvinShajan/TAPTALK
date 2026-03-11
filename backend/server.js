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
