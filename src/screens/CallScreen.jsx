import { useEffect, useRef, useState, useCallback } from "react";
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage, keyFingerprint,
} from "../crypto.js";
import { api } from "../api.js";

const isMobile = () => window.innerWidth <= 640;

export default function CallScreen({ user, token, socket, peer, roomId, onHangUp }) {
  const [connStatus, setConnStatus] = useState("connecting");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerName, setPeerName] = useState(peer?.username || "");
  const [callDuration, setCallDuration] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [mobile, setMobile] = useState(isMobile());
  const [unreadChat, setUnreadChat] = useState(0);

  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const dataChannelRef = useRef(null);
  const keyPairRef = useRef(null);
  const sharedKeyRef = useRef(null);
  const chatEndRef = useRef(null);
  const timerRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const hasCreatedOfferRef = useRef(false);
  const hasStartedMediaRef = useRef(false);

  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const addMsg = useCallback((msg) => {
    setMessages((p) => [...p, { ...msg, ts: Date.now() }]);
    if (!showChat) setUnreadChat((n) => n + 1);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [showChat]);
  const sysMsg = useCallback((text) => addMsg({ type: "system", text }), [addMsg]);

  useEffect(() => {
    (async () => {
      keyPairRef.current = await generateKeyPair();
    })();
  }, []);

  useEffect(() => {
    socket.off("room-joined"); socket.off("user-joined"); socket.off("offer");
    socket.off("answer"); socket.off("ice-candidate"); socket.off("user-left");

    socket.on("room-joined", async ({ userCount }) => {
      if (userCount === 1) sysMsg("Waiting for " + (peer?.username || "friend") + "...");
      else sysMsg("Joining room...");
      await startMedia();
    });

    socket.on("user-joined", async ({ username }) => {
      if (hasCreatedOfferRef.current) return;
      setPeerName(username); setPeerConnected(true);
      sysMsg(`${username} joined`);
      hasCreatedOfferRef.current = true;
      await createOffer();
    });

    socket.on("offer", async ({ offer }) => {
      sysMsg("Connecting...");
      if (!pcRef.current) await startMedia();
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("answer", { answer, roomId });
      } catch (e) { sysMsg("Error: " + e.message); }
    });

    socket.on("answer", async ({ answer }) => {
      try {
        if (pcRef.current?.signalingState === "have-local-offer")
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) { console.error(e); }
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (!candidate || !pcRef.current) return;
      try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    socket.on("user-left", ({ username }) => {
      sysMsg(`${username} left`);
      setPeerConnected(false); setEncryptionReady(false); setConnStatus("connecting");
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      stopTimer();
    });

    if (!hasJoinedRef.current) {
      hasJoinedRef.current = true;
      socket.emit("join-room", roomId);
      sysMsg(`Joining room ${roomId}...`);
    }

    return () => {
      socket.off("room-joined"); socket.off("user-joined"); socket.off("offer");
      socket.off("answer"); socket.off("ice-candidate"); socket.off("user-left");
      cleanupCall();
    };
  }, [roomId]);

  const startMedia = async () => {
    if (hasStartedMediaRef.current) return;
    hasStartedMediaRef.current = true;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      sysMsg("Camera and microphone ready");
    } catch {
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); sysMsg("Audio only"); }
      catch (e) { sysMsg("No camera/mic: " + e.message); return; }
    }
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    await createPeerConnection(stream);
  };

  const createPeerConnection = async (stream) => {
    let iceServers = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];
    try { const cfg = await api.getIceConfig(token); iceServers = cfg.iceServers; } catch {}

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
        setPeerConnected(true); startTimer(); setConnStatus("connected");
      }
    };
    pc.onicecandidate = (e) => { if (e.candidate) socket.emit("ice-candidate", { candidate: e.candidate, roomId }); };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") setConnStatus(encryptionReady ? "encrypted" : "connected");
      if (s === "failed") pc.restartIce();
      if (s === "disconnected") setConnStatus("connecting");
    };
    pc.ondatachannel = (e) => { dataChannelRef.current = e.channel; setupDataChannel(e.channel); };
  };

  const createOffer = async () => {
    if (!pcRef.current) await startMedia();
    const dc = pcRef.current.createDataChannel("secure-chat", { ordered: true });
    dataChannelRef.current = dc; setupDataChannel(dc);
    try {
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socket.emit("offer", { offer, roomId });
    } catch (e) { sysMsg("Offer failed: " + e.message); }
  };

  const setupDataChannel = (dc) => {
    dc.onopen = async () => {
      sysMsg("Secure channel open — exchanging keys...");
      const pub = await exportPublicKey(keyPairRef.current);
      dc.send(JSON.stringify({ type: "pubkey", key: pub, username: user.username }));
    };
    dc.onmessage = async (e) => {
      let data; try { data = JSON.parse(e.data); } catch { return; }
      if (data.type === "pubkey") {
        try {
          setPeerName(data.username || "Peer");
          const peerPub = await importPublicKey(data.key);
          sharedKeyRef.current = await deriveSharedKey(keyPairRef.current.privateKey, peerPub);
          setEncryptionReady(true); setConnStatus("encrypted");
          sysMsg("🔐 End-to-end encryption active");
        } catch (e) { sysMsg("Key exchange failed"); }
      }
      if (data.type === "msg" && sharedKeyRef.current) {
        try { addMsg({ type: "received", text: await decryptMessage(sharedKeyRef.current, data.payload), from: data.from }); }
        catch { sysMsg("Decryption failed"); }
      }
    };
  };

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !sharedKeyRef.current) return;
    if (dataChannelRef.current?.readyState !== "open") { sysMsg("Chat not ready"); return; }
    const encrypted = await encryptMessage(sharedKeyRef.current, text);
    dataChannelRef.current.send(JSON.stringify({ type: "msg", payload: encrypted, from: user.username }));
    addMsg({ type: "sent", text });
    setChatInput("");
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
  };
  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null; setCallDuration(0); };
  const cleanupCall = () => {
    stopTimer();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close(); pcRef.current = null;
    dataChannelRef.current = null; sharedKeyRef.current = null;
  };

  const hangUp = () => { cleanupCall(); onHangUp(); };
  const toggleAudio = () => { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setAudioMuted(!audioMuted); } };
  const toggleVideo = () => { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setVideoMuted(!videoMuted); } };
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const statusColor = { connecting: "#ffaa00", connected: "#4488ff", encrypted: "#00ff88" };
  const statusLabel = { connecting: "CONNECTING", connected: "CONNECTED", encrypted: "ENCRYPTED" };

  const openChat = () => { setShowChat(true); setUnreadChat(0); };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#060608", position: "relative", zIndex: 1 }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.5)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>SecureCall</span>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor[connStatus], boxShadow: `0 0 5px ${statusColor[connStatus]}`, display: "inline-block" }} />
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.52rem", color: statusColor[connStatus] }}>{statusLabel[connStatus]}</span>
          </div>
          {callDuration > 0 && <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.52rem", color: "rgba(255,255,255,0.25)" }}>{fmt(callDuration)}</span>}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {/* Chat toggle on mobile */}
          {mobile && (
            <button className="btn btn-ghost" onClick={showChat ? () => setShowChat(false) : openChat}
              style={{ padding: "5px 10px", fontSize: "0.65rem", position: "relative" }}>
              💬 {unreadChat > 0 && !showChat && <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ff4466", borderRadius: "50%", width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Mono', monospace", fontSize: "0.4rem", color: "#fff" }}>{unreadChat}</span>}
            </button>
          )}
          <button className="btn btn-red" onClick={hangUp} style={{ padding: "5px 12px", fontSize: "0.65rem" }}>✕ End</button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: mobile ? "block" : "grid", gridTemplateColumns: "1fr 300px", overflow: "hidden", position: "relative" }}>

        {/* Video (hidden on mobile when chat open) */}
        {(!mobile || !showChat) && (
          <div style={{ position: "relative", background: "#080810", overflow: "hidden", height: mobile ? "100%" : undefined, display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, position: "relative", background: "#0a0a12" }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {!peerConnected && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px" }}>
                  <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", width: "72px", height: "72px", borderRadius: "50%", border: "1px solid rgba(0,255,136,0.4)", animation: "pulse-ring 2s ease-out infinite" }} />
                    <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>{peer?.avatar || "👤"}</div>
                  </div>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.58rem", letterSpacing: "0.12em", color: "rgba(0,255,136,0.5)" }}>
                    Waiting for {peerName || "friend"}<span style={{ animation: "blink 1s step-end infinite", color: "#00ff88" }}>_</span>
                  </span>
                </div>
              )}
              {peerConnected && <div style={{ position: "absolute", bottom: "8px", left: "10px", fontFamily: "'Space Mono', monospace", fontSize: "0.55rem", color: "rgba(0,255,136,0.7)" }}>{peerName}</div>}
              {encryptionReady && <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)", color: "#00ff88", fontFamily: "'Space Mono', monospace", fontSize: "0.5rem", padding: "2px 7px" }}>🔐 E2E</div>}
            </div>

            {/* Local PiP */}
            <div style={{ position: "absolute", bottom: mobile ? "70px" : "60px", right: "10px", width: mobile ? "80px" : "130px", height: mobile ? "55px" : "80px", border: "1px solid rgba(0,255,136,0.2)", background: "#0a0a12", zIndex: 10, overflow: "hidden" }}>
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {videoMuted && <div style={{ position: "absolute", inset: 0, background: "rgba(6,6,8,0.85)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>📵</div>}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", padding: "10px", background: "rgba(0,0,0,0.7)", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={toggleAudio} style={{ padding: "8px 14px", fontSize: "0.65rem", borderColor: audioMuted ? "#ff4466" : undefined, color: audioMuted ? "#ff4466" : undefined }}>
                {audioMuted ? "🔇" : "🎙"}
              </button>
              <button className="btn btn-ghost" onClick={toggleVideo} style={{ padding: "8px 14px", fontSize: "0.65rem", borderColor: videoMuted ? "#ff4466" : undefined, color: videoMuted ? "#ff4466" : undefined }}>
                {videoMuted ? "📵" : "📹"}
              </button>
              {!mobile && (
                <button className="btn btn-ghost" onClick={showChat ? () => setShowChat(false) : openChat} style={{ padding: "8px 14px", fontSize: "0.65rem" }}>
                  💬 {unreadChat > 0 && !showChat ? `(${unreadChat})` : "Chat"}
                </button>
              )}
              <button className="btn btn-red" onClick={hangUp} style={{ padding: "8px 16px", fontSize: "0.65rem" }}>📵 End</button>
            </div>
          </div>
        )}

        {/* Chat panel — side panel on desktop, full screen on mobile */}
        {(showChat || !mobile) && (
          <div style={{ display: "flex", flexDirection: "column", borderLeft: !mobile ? "1px solid rgba(255,255,255,0.05)" : "none", background: "#080810", height: mobile ? "100%" : undefined, position: mobile ? "absolute" : undefined, inset: mobile ? "0" : undefined }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.55rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>Encrypted Chat</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {encryptionReady
                  ? <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)", padding: "1px 6px" }}>🔐 AES-256</span>
                  : <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", color: "rgba(255,170,0,0.5)", border: "1px solid rgba(255,170,0,0.2)", padding: "1px 6px" }}>Waiting...</span>}
                {mobile && <button className="btn btn-ghost" onClick={() => setShowChat(false)} style={{ padding: "4px 8px", fontSize: "0.6rem" }}>✕</button>}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  fontFamily: "'Space Mono', monospace",
                  padding: msg.type === "system" ? "2px 0" : "7px 10px",
                  alignSelf: msg.type === "sent" ? "flex-end" : msg.type === "system" ? "center" : "flex-start",
                  background: msg.type === "sent" ? "rgba(0,255,136,0.07)" : msg.type === "received" ? "rgba(255,255,255,0.04)" : "transparent",
                  border: msg.type === "sent" ? "1px solid rgba(0,255,136,0.18)" : msg.type === "received" ? "1px solid rgba(255,255,255,0.08)" : "none",
                  color: msg.type === "system" ? "rgba(0,255,136,0.4)" : msg.type === "sent" ? "#c0ffd8" : "#b0b0c0",
                  fontSize: msg.type === "system" ? "0.52rem" : "0.72rem",
                  letterSpacing: msg.type === "system" ? "0.08em" : 0,
                  textTransform: msg.type === "system" ? "uppercase" : "none",
                  maxWidth: msg.type === "system" ? "100%" : "86%",
                  lineHeight: 1.5, animation: "slide-up 0.2s ease",
                }}>
                  {msg.type === "received" && <div style={{ fontSize: "0.48rem", color: "rgba(0,255,136,0.4)", marginBottom: "2px" }}>{msg.from}</div>}
                  {msg.text}
                  {msg.type !== "system" && <div style={{ fontSize: "0.46rem", color: "rgba(255,255,255,0.15)", marginTop: "3px", textAlign: "right" }}>{new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: "8px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "6px", flexShrink: 0 }}>
              <input className="input" placeholder={encryptionReady ? "Type..." : "Waiting for encryption..."}
                value={chatInput} disabled={!encryptionReady}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                style={{ fontSize: "0.8rem" }} />
              <button className="btn btn-green" onClick={sendMessage} disabled={!encryptionReady || !chatInput.trim()} style={{ padding: "8px 12px" }}>→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}