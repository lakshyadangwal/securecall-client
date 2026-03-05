import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api.js";

const isMobile = () => window.innerWidth <= 640;

export default function FriendsScreen({
  user, token, socket, onCall, onLogout,
  conversations, unread, onSendDM, onClearUnread,
}) {
  const [friends, setFriends] = useState([]);
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("friends");
  const [openChat, setOpenChat] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [mobile, setMobile] = useState(isMobile());

  const typingTimer = useRef(null);
  const chatEndRef = useRef(null);
  const friendIdSetRef = useRef(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setMobile(isMobile());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const data = await api.getFriends(token);
      const accepted = data.filter((f) => f.status === "accepted");
      setFriends(data);
      const idSet = new Set(accepted.map((f) => Number(f.id)));
      friendIdSetRef.current = idSet;
      if (idSet.size > 0) socket.emit("get-presence", Array.from(idSet));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token, socket]);

  useEffect(() => {
    loadFriends();

    socket.on("all-online-users", (allIds) => {
      const online = allIds.map(Number).filter((id) => friendIdSetRef.current.has(id));
      setOnlineIds(new Set(online));
    });

    socket.on("presence-list", (ids) => setOnlineIds(new Set(ids.map(Number))));

    socket.on("user-online", ({ userId }) => {
      const uid = Number(userId);
      if (friendIdSetRef.current.has(uid)) setOnlineIds((p) => new Set([...p, uid]));
    });

    socket.on("user-offline", ({ userId }) => {
      setOnlineIds((p) => { const s = new Set(p); s.delete(Number(userId)); return s; });
    });

    socket.on("peer-typing", ({ fromUserId, isTyping }) => {
      setOpenChat((cur) => { if (cur && Number(fromUserId) === Number(cur.id)) setPeerTyping(isTyping); return cur; });
    });

    const interval = setInterval(() => {
      const ids = Array.from(friendIdSetRef.current);
      if (ids.length > 0) socket.emit("get-presence", ids);
    }, 15000);

    return () => {
      socket.off("all-online-users"); socket.off("presence-list");
      socket.off("user-online"); socket.off("user-offline"); socket.off("peer-typing");
      clearInterval(interval);
    };
  }, [socket, loadFriends]);

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [conversations, openChat]);

  const openChatWith = (friend) => {
    setOpenChat(friend);
    onClearUnread(friend.id);
    setChatInput("");
    setPeerTyping(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const closeChat = () => setOpenChat(null);

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text || !openChat) return;
    onSendDM(openChat.id, openChat.username, text);
    setChatInput("");
    socket.emit("typing", { toUserId: openChat.id, isTyping: false });
    clearTimeout(typingTimer.current);
  };

  const handleTyping = (e) => {
    setChatInput(e.target.value);
    if (!openChat) return;
    socket.emit("typing", { toUserId: openChat.id, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("typing", { toUserId: openChat.id, isTyping: false }), 1500);
  };

  const addFriend = async () => {
    if (!addInput.trim()) return;
    setAddError(""); setAddSuccess("");
    try {
      const data = await api.addFriend(addInput.trim(), token);
      setAddSuccess(`Sent to ${data.target.username}`);
      setAddInput(""); loadFriends();
    } catch (e) { setAddError(e.message); }
  };

  const acceptFriend = async (userId) => { await api.acceptFriend(userId, token); loadFriends(); };
  const removeFriend = async (userId) => {
    await api.removeFriend(userId, token);
    setFriends((f) => f.filter((fr) => fr.id !== userId));
    friendIdSetRef.current.delete(Number(userId));
    if (openChat?.id === userId) setOpenChat(null);
  };

  const accepted = friends.filter((f) => f.status === "accepted");
  const pending = friends.filter((f) => f.status === "pending");
  const incomingPending = pending.filter((f) => Number(f.requester_id) !== Number(user.id));
  const outgoingPending = pending.filter((f) => Number(f.requester_id) === Number(user.id));
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const sortedFriends = [...accepted].sort((a, b) => {
    const ao = onlineIds.has(Number(a.id)), bo = onlineIds.has(Number(b.id));
    if (ao && !bo) return -1; if (!ao && bo) return 1;
    return a.username.localeCompare(b.username);
  });
  const msgs = openChat ? (conversations[Number(openChat.id)] || []) : [];
  const chatFriendOnline = openChat ? onlineIds.has(Number(openChat.id)) : false;

  // On mobile: show chat panel OR friends list, not both
  const showList = !mobile || !openChat;
  const showChat = !!openChat;

  return (
    <div style={{
      position: "relative", zIndex: 1, height: "100%",
      display: "grid",
      gridTemplateColumns: mobile ? "1fr" : (openChat ? "320px 1fr" : "1fr"),
      maxWidth: mobile ? "100%" : (openChat ? "900px" : "460px"),
      margin: "0 auto",
    }}>

      {/* ═══════════ FRIENDS LIST ═══════════ */}
      {showList && (
        <div style={{
          display: "grid", gridTemplateRows: "auto 1fr",
          height: "100%",
          borderRight: !mobile && openChat ? "1px solid rgba(255,255,255,0.06)" : "none",
          background: "#060608",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 14px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                  {user.avatar}
                </div>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.88rem" }}>{user.username}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Space Mono', monospace", fontSize: "0.48rem", color: "#00ff88" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px #00ff88", display: "inline-block" }} /> ONLINE
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost" onClick={onLogout} style={{ padding: "6px 12px", fontSize: "0.62rem" }}>Sign Out</button>
            </div>

            {/* Add friend */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <input className="input" placeholder="Add friend by username..."
                  value={addInput} onChange={(e) => setAddInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFriend()}
                  autoCapitalize="none" style={{ fontSize: "0.78rem" }} />
                <button className="btn btn-green" onClick={addFriend} style={{ padding: "0 14px", whiteSpace: "nowrap", fontSize: "0.65rem" }}>+ Add</button>
              </div>
              {addError && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.56rem", color: "#ff4466", marginTop: "4px" }}>⚠ {addError}</div>}
              {addSuccess && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.56rem", color: "#00ff88", marginTop: "4px" }}>✓ {addSuccess}</div>}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {[
                { id: "friends", label: `Friends (${accepted.length})` },
                { id: "pending", label: `Pending${incomingPending.length ? " ●" : ""}` },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  fontFamily: "'Space Mono', monospace", fontSize: "0.56rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", padding: "8px 12px",
                  background: "transparent", border: "none",
                  borderBottom: tab === id ? "2px solid #00ff88" : "2px solid transparent",
                  color: tab === id ? "#00ff88" : "rgba(255,255,255,0.3)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>{label}</button>
              ))}
              {totalUnread > 0 && (
                <span style={{ marginLeft: "auto", background: "#ff4466", color: "#fff", borderRadius: "10px", fontFamily: "'Space Mono', monospace", fontSize: "0.46rem", padding: "2px 7px" }}>
                  {totalUnread} new
                </span>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", padding: "8px 10px" }}>
            {loading && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "40px" }}>Loading...</div>}

            {tab === "friends" && !loading && (
              <>
                {sortedFriends.length === 0 && (
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "50px", lineHeight: 2 }}>
                    No friends yet.<br /><span style={{ color: "rgba(0,255,136,0.4)" }}>Add someone above.</span>
                  </div>
                )}
                {sortedFriends.map((friend) => {
                  const isOnline = onlineIds.has(Number(friend.id));
                  const friendUnread = unread[Number(friend.id)] || 0;
                  const isOpen = !mobile && openChat?.id === friend.id;
                  const lastMsg = (conversations[Number(friend.id)] || []).slice(-1)[0];
                  return (
                    <div key={friend.id} onClick={() => openChatWith(friend)} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "11px 10px", marginBottom: "4px", cursor: "pointer",
                      background: isOpen ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isOpen ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.05)"}`,
                      transition: "all 0.12s", animation: "slide-up 0.2s ease",
                      WebkitTapHighlightColor: "transparent",
                    }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", flexShrink: 0, background: isOnline ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${isOnline ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", position: "relative" }}>
                        {friend.avatar || "👤"}
                        <span style={{ position: "absolute", bottom: "1px", right: "1px", width: "10px", height: "10px", borderRadius: "50%", background: isOnline ? "#00ff88" : "#1a1a2a", boxShadow: isOnline ? "0 0 6px #00ff88" : "none", border: "2px solid #060608" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#e0e0e8" }}>{friend.username}</div>
                          {friendUnread > 0 && <span style={{ background: "#00ff88", color: "#060608", borderRadius: "10px", fontFamily: "'Space Mono', monospace", fontSize: "0.46rem", padding: "1px 6px", fontWeight: 700, flexShrink: 0 }}>{friendUnread}</span>}
                        </div>
                        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.5rem", color: lastMsg ? "rgba(255,255,255,0.28)" : isOnline ? "#00ff88" : "rgba(255,255,255,0.18)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {lastMsg ? (lastMsg.mine ? `You: ${lastMsg.message}` : lastMsg.message) : isOnline ? "● online" : "○ offline"}
                        </div>
                      </div>
                      {isOnline && (
                        <button className="btn btn-green" onClick={(e) => { e.stopPropagation(); onCall(friend); }} style={{ padding: "6px 10px", fontSize: "0.75rem", flexShrink: 0 }}>📹</button>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {tab === "pending" && !loading && (
              <>
                {incomingPending.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 10px", marginBottom: "4px", background: "rgba(0,255,136,0.03)", border: "1px solid rgba(0,255,136,0.12)" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{f.avatar || "👤"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.88rem" }}>{f.username}</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.5rem", color: "rgba(0,255,136,0.4)" }}>wants to connect</div>
                    </div>
                    <button className="btn btn-green" onClick={() => acceptFriend(f.id)} style={{ padding: "6px 11px" }}>✓</button>
                    <button className="btn btn-red" onClick={() => removeFriend(f.id)} style={{ padding: "6px 9px" }}>✕</button>
                  </div>
                ))}
                {outgoingPending.map((f) => (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 10px", marginBottom: "4px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{f.avatar || "👤"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.88rem" }}>{f.username}</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.5rem", color: "rgba(255,255,255,0.2)" }}>pending...</div>
                    </div>
                    <button className="btn btn-ghost" onClick={() => removeFriend(f.id)} style={{ padding: "6px 11px", fontSize: "0.6rem" }}>Cancel</button>
                  </div>
                ))}
                {!incomingPending.length && !outgoingPending.length && (
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "50px" }}>No pending requests</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ CHAT PANEL ═══════════ */}
      {showChat && (
        <div style={{
          display: "grid", gridTemplateRows: "auto 1fr auto",
          height: "100%", background: "#070712",
        }}>
          {/* Chat header */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.3)" }}>
            <button className="btn btn-ghost" onClick={closeChat} style={{ padding: "7px 12px", fontSize: "0.7rem", flexShrink: 0 }}>←</button>
            <div style={{ width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0, background: chatFriendOnline ? "rgba(0,255,136,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${chatFriendOnline ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.07)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", position: "relative" }}>
              {openChat.avatar || "👤"}
              <span style={{ position: "absolute", bottom: 0, right: 0, width: "9px", height: "9px", borderRadius: "50%", background: chatFriendOnline ? "#00ff88" : "#1a1a2a", boxShadow: chatFriendOnline ? "0 0 5px #00ff88" : "none", border: "2px solid #070712" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{openChat.username}</div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.5rem", color: peerTyping ? "#ffaa00" : chatFriendOnline ? "#00ff88" : "rgba(255,255,255,0.2)" }}>
                {peerTyping ? "typing..." : chatFriendOnline ? "● online" : "○ offline"}
              </div>
            </div>
            {chatFriendOnline && (
              <button className="btn btn-green" onClick={() => onCall(openChat)} style={{ padding: "7px 14px", fontSize: "0.65rem", flexShrink: 0 }}>📹 Call</button>
            )}
          </div>

          {/* Messages */}
          <div style={{ overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: "center", marginTop: "80px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "14px" }}>💬</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.6rem", color: "rgba(255,255,255,0.18)", lineHeight: 2 }}>
                  No messages yet.<br />
                  <span style={{ color: "rgba(0,255,136,0.35)" }}>
                    {chatFriendOnline ? "Say hello!" : "Send a message — they'll see it when online."}
                  </span>
                </div>
              </div>
            )}

            {msgs.map((msg, i) => {
              const showDate = i === 0 || new Date(msg.ts).toDateString() !== new Date(msgs[i - 1]?.ts).toDateString();
              return (
                <div key={i}>
                  {showDate && (
                    <div style={{ textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: "0.46rem", color: "rgba(255,255,255,0.12)", letterSpacing: "0.1em", margin: "8px 0 4px", textTransform: "uppercase" }}>
                      {new Date(msg.ts).toLocaleDateString()}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: msg.mine ? "flex-end" : "flex-start", animation: "slide-up 0.18s ease" }}>
                    <div style={{ maxWidth: "80%", padding: "9px 13px", background: msg.mine ? "rgba(0,255,136,0.09)" : "rgba(255,255,255,0.05)", border: `1px solid ${msg.mine ? "rgba(0,255,136,0.22)" : "rgba(255,255,255,0.09)"}`, fontFamily: "'Syne', sans-serif", fontSize: "0.9rem", lineHeight: 1.55, color: msg.mine ? "#d0ffe8" : "#c8c8d8", borderBottomRightRadius: msg.mine ? 0 : "2px", borderBottomLeftRadius: !msg.mine ? 0 : "2px", wordBreak: "break-word" }}>
                      {msg.message}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "0.44rem", color: "rgba(255,255,255,0.13)" }}>
                        {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.mine && (
                        <span style={{ fontSize: "0.6rem", color: msg.status === "sent" ? "#00ff88" : msg.status === "offline" ? "#ff9944" : "rgba(255,255,255,0.2)" }}>
                          {msg.status === "sent" ? "✓✓" : msg.status === "offline" ? "✓" : "·"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {peerTyping && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 12px", alignSelf: "flex-start", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", width: "fit-content" }}>
                {[0, 1, 2].map((i) => <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(0,255,136,0.6)", animation: `blink 1.2s ${i * 0.22}s ease-in-out infinite` }} />)}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "8px", background: "rgba(0,0,0,0.4)" }}>
            <input
              ref={inputRef}
              className="input"
              placeholder={chatFriendOnline ? `Message ${openChat.username}...` : "Offline — message anyway"}
              value={chatInput}
              onChange={handleTyping}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              style={{ fontSize: "0.85rem" }}
            />
            <button className="btn btn-green" onClick={sendMessage}
              disabled={!chatInput.trim()} style={{ padding: "0 16px", flexShrink: 0 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}