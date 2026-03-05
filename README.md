# SecureCall — Client

Frontend for SecureCall — a privacy-first P2P encrypted video calling app.

## Tech Stack
- React 18 + Vite
- Socket.io client
- WebRTC (P2P video/audio)
- Web Crypto API (ECDH key exchange + AES-256-GCM)

## Features
- Login / Register
- Friends list with real-time online presence
- Direct messaging (works offline too)
- Typing indicators
- P2P encrypted video + audio calls
- E2E encrypted in-call chat (AES-256-GCM)
- Mobile responsive — works on phones
- Add to home screen (PWA-ready)

## Local Setup

**1. Install dependencies**
```bash
npm install
```

**2. Run (connects to local server on port 5000)**
```bash
npm run dev
```

Opens at http://localhost:5173

> Make sure the server is running first — see `securecall-server` repo.

---

## Deploy on Vercel (Free)

1. Push this repo to GitHub
2. Go to https://vercel.com → New Project → Import `securecall-client`
3. Add environment variable:

```
VITE_SERVER_URL=https://your-railway-server.up.railway.app
```

4. Click Deploy
5. Your app will be live at `https://securecall.vercel.app`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| VITE_SERVER_URL | No (local dev) | URL of deployed server. Leave empty for local dev — Vite proxy handles it. |

---

## Mobile (Add to Home Screen)

**iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap Share → Add to Home Screen
3. Opens fullscreen like a native app

**Android (Chrome):**
1. Open your Vercel URL in Chrome
2. Tap menu → Add to Home Screen

---

## Project Structure

```
src/
├── api.js              # HTTP helpers + SERVER_URL export
├── crypto.js           # ECDH key exchange + AES-256-GCM
├── styles.js           # Global CSS (dark theme)
├── main.jsx            # React root (no StrictMode)
├── App.jsx             # Screen router + socket management
├── components/
│   └── IncomingCall.jsx  # Incoming call popup
└── screens/
    ├── AuthScreen.jsx    # Login / Register
    ├── FriendsScreen.jsx # Friends list + direct messages
    └── CallScreen.jsx    # Video call + encrypted chat
```

---

## Security Model

| Layer | Method |
|---|---|
| Passwords | bcrypt (12 rounds) on server |
| Auth | JWT (7 day expiry) |
| Video/Audio | WebRTC P2P — server never sees media |
| In-call chat | ECDH P-256 key exchange → AES-256-GCM per message |
| Direct messages | Relayed through server (not E2E encrypted) |
| TURN relay | Encrypted WebRTC packets only |
| Message storage | Zero — no messages stored on server |
