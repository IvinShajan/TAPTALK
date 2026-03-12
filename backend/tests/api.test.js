const request = require('supertest');
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const ioClient = require("socket.io-client");
const fs = require('fs');

// Create test app instances avoiding global ports
let app, server, io;

beforeAll((done) => {
  // Setup isolated Express server
  app = express();
  app.use(express.json());

  // Require db methods directly to mock/test
  const dbPath = require('path').join(__dirname, '..', 'db.json');
  // Clean db before testing
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  
  const { getOrCreateUser, addFriend, getFriends } = require('../db');

  app.post("/api/login", (req, res) => {
    try {
      res.json(getOrCreateUser(req.body.contactInfo));
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/friends", (req, res) => {
    try {
      res.json(addFriend(req.body.uid, req.body.contactInfo));
    } catch(e) { res.status(404).json({ error: e.message }); }
  });

  app.get("/api/friends/:uid", (req, res) => {
    try { res.json(getFriends(req.params.uid)); } 
    catch(e) { res.status(500).json({ error: e.message }); }
  });

  server = http.createServer(app);
  io = new Server(server);

  io.on("connection", (socket) => {
    socket.on("register", ({ phoneNumber }) => {
      socket.broadcast.emit("friend-status", { phoneNumber, online: true });
    });
    // Add logic here to mock your WebRTC candidate/answer flow
  });

  server.listen(0, done); // Choose random port
});

afterAll((done) => {
  io.close();
  server.close(done);
});


describe("Full Backend Testing", () => {
  let userA, userB;
  let clientSocket;

  // 1. Database & Authentication Test
  test("Should mock-login and create a user local database record", async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ contactInfo: "+91 9048853201" });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.phoneNumber).toBe("+91 9048853201");
    expect(res.body.uid).toBeDefined();
    userA = res.body; 
  });

  // 2. Friend Management (Adding mutual users)
  test("Should allow user to add a mock friend", async () => {
    // Create User B
    const resB = await request(app).post('/api/login').send({ contactInfo: "+1 555-0101" });
    userB = resB.body;

    // Add User B to User A's list
    const resAdd = await request(app)
      .post('/api/friends')
      .send({ uid: userA.uid, contactInfo: "+1 555-0101" });

    expect(resAdd.statusCode).toBe(200);
    expect(resAdd.body.uid).toBe(userB.uid);
  });

  test("Should fetch a users friend list", async () => {
    const res = await request(app).get(`/api/friends/${userA.uid}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].phoneNumber).toBe("+1 555-0101");
  });

  // 3. Socket Testing
  test("Socket connection and register broadcast", (done) => {
    const port = server.address().port;
    clientSocket = ioClient(`http://localhost:${port}`);
    
    // Connect user B as a secondary client socket to listen for A
    const clientB = ioClient(`http://localhost:${port}`);

    clientB.on("connect", () => {
      clientB.on("friend-status", (data) => {
        expect(data.phoneNumber).toBe("+91 9048853201");
        expect(data.online).toBe(true);
        clientSocket.close();
        clientB.close();
        done();
      });

      // User A signs in and emits presence via socket
      clientSocket.emit("register", { phoneNumber: "+91 9048853201" });
    });
  });
});
