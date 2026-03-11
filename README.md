# 📻 WalkieTalk — Low-Latency Walkie-Talkie Web App

> Push-to-talk voice over WebRTC. Phone login. $0 hosting.

---

## ✨ Features

| Feature | Stack |
|---|---|
| Phone number login + OTP | Firebase Auth |
| User profiles & friends | Firebase Firestore |
| WebRTC P2P audio (<100ms) | Browser WebRTC API |
| Push-to-talk (hold to speak) | `MediaStream.getAudioTracks()` |
| Online presence | Socket.io events |
| Signaling server | Node.js + Socket.io |
| Frontend hosting | Vercel (free) |
| Backend hosting | Render (free) |

---

## 🗂️ Project Structure

```
walkie-app/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Phone OTP login
│   │   │   ├── Friends.jsx      # Friends list + online status
│   │   │   └── Talk.jsx         # Call screen + PTT button
│   │   ├── services/
│   │   │   ├── firebase.js      # Auth + Firestore helpers
│   │   │   ├── socket.js        # Socket.io client
│   │   │   └── webrtc.js        # WebRTC peer connection
│   │   ├── App.jsx              # Router + auth state
│   │   └── App.css              # Full UI styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── backend/
    ├── server.js                # Signaling server
    └── package.json
```

---

## 🚀 Setup & Deploy

### 1. Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Authentication → Phone**
4. Enable **Firestore Database** (start in test mode for dev)
5. Register a **Web app** and copy the config
6. Add your production domain to **Auth → Authorized domains**

### 2. Backend (Render — free)

1. Push `backend/` to a GitHub repo
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, set:
   - **Build command**: `npm install`
   - **Start command**: `node server.js`
4. Deploy — note the URL (e.g. `https://walkie-backend.onrender.com`)

### 3. Frontend (Vercel — free)

1. Push `frontend/` to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the repo
4. Add **Environment Variables**:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_SOCKET_URL=https://your-backend.onrender.com
   ```
5. Deploy

### 4. Local Development

```bash
# Backend
cd backend
npm install
node server.js         # Runs on :4000

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local   # Fill in your Firebase config
npm run dev            # Runs on :5173
```

---

## 📡 How It Works

```
User A (Browser)
     │
     │  1. SDP Offer (via Socket.io)
     ▼
Signaling Server (Render)
     │
     │  2. Forward offer to User B
     ▼
User B (Browser)
     │
     │  3. SDP Answer + ICE candidates (via Socket.io)
     ▼
[P2P audio stream established — server no longer involved]

User A ◄──────── WebRTC Audio (<100ms) ────────► User B
```

**Server only sees:** SDP offer/answer + ICE candidates. Audio is fully P2P.

---

## 🔇 Push-to-Talk Logic

```js
// Hold button → enable mic track
localStream.getAudioTracks().forEach(t => t.enabled = true);

// Release button → mute mic track
localStream.getAudioTracks().forEach(t => t.enabled = false);
```

Mic is always captured (to avoid latency on press) but track is gated.

---

## 🔒 Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /friends/{friendId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

---

## 🌐 TURN Server (for production)

WebRTC requires a TURN server when users are behind symmetric NAT (corporate networks, some mobile). Free options:

- **[Metered.ca](https://www.metered.ca/)** — 50GB/month free TURN
- **[Cloudflare Calls](https://developers.cloudflare.com/calls/)** — Free tier available

Add credentials to `webrtc.js` in `RTC_CONFIG.iceServers`.

---

## 📱 PWA (Optional enhancement)

Add a `manifest.json` and service worker to make WalkieTalk installable on mobile home screens.
