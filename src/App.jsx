import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { globalCSS } from "./styles.js";
import AuthScreen from "./screens/AuthScreen.jsx";
import FriendsScreen from "./screens/FriendsScreen.jsx";
import CallScreen from "./screens/CallScreen.jsx";
import IncomingCall from "./components/IncomingCall.jsx";
import { api } from "./api.js";

const SIGNAL_SERVER = "http://localhost:5000";

export default function App() {
  const [screen, setScreen] = useState("auth");
  const [token, setToken] = useState(() => localStorage.getItem("sc_token") || "");
  const [user, setUser] = useState(null);
  const [callPeer, setCallPeer] = useState(null);
  const [callRoomId, setCallRoomId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [conversations, setConversations] = useState({});
  const [unread, setUnread] = useState({});
  const socketRef = useRef(null);
  const userRef = useRef(null);

  // Auto-login
  useEffect(() => {
    if (token) {
      api.me(token)
        .then((u) => {
          setUser(u);
          userRef.current = u;
          connectSocket(token);
          setScreen("friends");
        })
        .catch(() => {
          localStorage.removeItem("sc_token");
          setToken("");
        });
    }
  }, []);

  const connectSocket = (tok) => {
    // Destroy existing socket completely before creating new one
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SIGNAL_SERVER, {
      auth: { token: tok },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("[socket] connected:", socket.id);
    });

    socket.on("connect_error", (e) => {
      console.error("[socket] connect error:", e.message);
    });

    socket.on("reconnect", (n) => {
      console.log("[socket] reconnected after", n, "attempts");
    });

    // Incoming DM
    socket.on("direct-message", ({ fromUserId, fromUsername, message, ts }) => {
      const uid = Number(fromUserId);
      const msg = { from: fromUsername, fromUserId: uid, message, ts, mine: false };
      setConversations((prev) => ({
        ...prev,
        [uid]: [...(prev[uid] || []), msg],
      }));
      setUnread((prev) => ({ ...prev, [uid]: (prev[uid] || 0) + 1 }));
    });

    // Call events
    socket.on("incoming-call", ({ from, roomId }) => {
      setIncomingCall({ from, roomId });
    });

    socket.on("call-accepted", ({ roomId }) => {
      setCallRoomId(roomId);
      setScreen("call");
    });

    socket.on("call-rejected", ({ username }) => {
      alert(`${username || "Friend"} declined the call`);
      setCallPeer(null);
      setCallRoomId(null);
      setScreen("friends");
    });

    socket.on("call-failed", ({ reason }) => {
      alert(`Call failed: ${reason}`);
      setCallPeer(null);
      setCallRoomId(null);
    });

    socketRef.current = socket;
    return socket;
  };

  const handleAuth = (tok, u) => {
    localStorage.setItem("sc_token", tok);
    setToken(tok);
    setUser(u);
    userRef.current = u;
    connectSocket(tok);
    setScreen("friends");
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    localStorage.removeItem("sc_token");
    setToken("");
    setUser(null);
    userRef.current = null;
    setConversations({});
    setUnread({});
    setScreen("auth");
  };

  const handleCallFriend = (friend) => {
    const roomId = Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    setCallPeer(friend);
    setCallRoomId(roomId);
    socketRef.current?.emit("call-user", { targetUserId: friend.id, roomId });
    setScreen("call");
  };

  const acceptIncoming = () => {
    if (!incomingCall) return;
    const { from, roomId } = incomingCall;
    setCallPeer({ id: from.userId, username: from.username });
    setCallRoomId(roomId);
    socketRef.current?.emit("call-accepted", { targetUserId: from.userId, roomId });
    setIncomingCall(null);
    setScreen("call");
  };

  const rejectIncoming = () => {
    if (incomingCall) {
      socketRef.current?.emit("call-rejected", { targetUserId: incomingCall.from.userId });
    }
    setIncomingCall(null);
  };

  const handleHangUp = () => {
    setCallPeer(null);
    setCallRoomId(null);
    setScreen("friends");
  };

  const sendDM = (toUserId, toUsername, message) => {
    const tempId = Math.random().toString(36).slice(2);
    const ts = Date.now();
    const uid = Number(toUserId);

    const msg = { from: userRef.current?.username, fromUserId: Number(userRef.current?.id), message, ts, mine: true, tempId, status: "sending" };
    setConversations((prev) => ({ ...prev, [uid]: [...(prev[uid] || []), msg] }));

    socketRef.current?.emit("direct-message", { toUserId: uid, message, tempId });

    const onSent = ({ tempId: id, ts: serverTs }) => {
      if (id !== tempId) return;
      socketRef.current?.off("message-sent", onSent);
      setConversations((prev) => ({
        ...prev,
        [uid]: (prev[uid] || []).map((m) =>
          m.tempId === tempId ? { ...m, status: "sent", ts: serverTs } : m
        ),
      }));
    };

    const onOffline = ({ tempId: id }) => {
      if (id !== tempId) return;
      socketRef.current?.off("message-offline", onOffline);
      setConversations((prev) => ({
        ...prev,
        [uid]: (prev[uid] || []).map((m) =>
          m.tempId === tempId ? { ...m, status: "offline" } : m
        ),
      }));
    };

    socketRef.current?.on("message-sent", onSent);
    socketRef.current?.on("message-offline", onOffline);
  };

  const clearUnread = (userId) => {
    setUnread((prev) => { const n = { ...prev }; delete n[Number(userId)]; return n; });
  };

  return (
    <>
      <style>{globalCSS}</style>
      <div className="scan-line" />
      <div className="grid-bg" />

      {screen === "auth" && <AuthScreen onAuth={handleAuth} />}

      {screen === "friends" && user && socketRef.current && (
        <FriendsScreen
          user={user}
          token={token}
          socket={socketRef.current}
          onCall={handleCallFriend}
          onLogout={handleLogout}
          conversations={conversations}
          unread={unread}
          onSendDM={sendDM}
          onClearUnread={clearUnread}
        />
      )}

      {screen === "call" && user && socketRef.current && callRoomId && (
        <CallScreen
          user={user}
          token={token}
          socket={socketRef.current}
          peer={callPeer}
          roomId={callRoomId}
          onHangUp={handleHangUp}
        />
      )}

      {incomingCall && (
        <IncomingCall
          caller={incomingCall.from}
          onAccept={acceptIncoming}
          onReject={rejectIncoming}
        />
      )}
    </>
  );
}