import { useState } from "react";
import { api } from "../api.js";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let data;
      if (mode === "login") {
        data = await api.login({ username: form.username, password: form.password });
      } else {
        data = await api.register({ username: form.username, email: form.email, password: form.password });
      }
      onAuth(data.token, data.user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const onKey = (e) => e.key === "Enter" && submit();

  return (
    <div style={{
      position: "relative", zIndex: 1,
      height: "100%", display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{
            fontFamily: "'Syne', sans-serif", fontWeight: 800,
            fontSize: "clamp(1.8rem, 6vw, 2.4rem)", letterSpacing: "-0.02em",
            color: "#e0e0e8",
          }}>
            Secure<span style={{ color: "#00ff88" }}>Call</span>
          </div>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: "0.6rem",
            letterSpacing: "0.2em", color: "rgba(0,255,136,0.4)",
            marginTop: "6px", textTransform: "uppercase",
          }}>
            End-to-end encrypted · P2P video
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "clamp(20px, 6vw, 32px)",
        }}>
          {/* Tab toggle */}
          <div style={{ display: "flex", marginBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                flex: 1, fontFamily: "'Space Mono', monospace",
                fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "10px", background: "transparent", border: "none",
                borderBottom: mode === m ? "2px solid #00ff88" : "2px solid transparent",
                color: mode === m ? "#00ff88" : "rgba(255,255,255,0.3)",
                cursor: "pointer", transition: "all 0.15s",
                marginBottom: "-1px",
              }}>
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div className="label">Username</div>
              <input className="input" placeholder="your_username"
                value={form.username} onChange={set("username")}
                onKeyDown={onKey} autoCapitalize="none" autoCorrect="off"
                autoComplete={mode === "login" ? "username" : "new-password"}
              />
            </div>

            {mode === "register" && (
              <div>
                <div className="label">Email</div>
                <input className="input" placeholder="you@example.com" type="email"
                  value={form.email} onChange={set("email")}
                  onKeyDown={onKey} autoComplete="email"
                />
              </div>
            )}

            <div>
              <div className="label">Password</div>
              <input className="input" placeholder="••••••••" type="password"
                value={form.password} onChange={set("password")}
                onKeyDown={onKey}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <div style={{
                fontFamily: "'Space Mono', monospace", fontSize: "0.62rem",
                color: "#ff4466", padding: "8px 12px",
                background: "rgba(255,68,102,0.06)",
                border: "1px solid rgba(255,68,102,0.2)",
              }}>
                ⚠ {error}
              </div>
            )}

            <button className="btn btn-green" onClick={submit} disabled={loading}
              style={{ width: "100%", justifyContent: "center", padding: "12px", marginTop: "4px" }}>
              {loading ? "..." : mode === "login" ? "Sign In →" : "Create Account →"}
            </button>
          </div>
        </div>

        <div style={{
          fontFamily: "'Space Mono', monospace", fontSize: "0.52rem",
          color: "rgba(255,255,255,0.15)", textAlign: "center", marginTop: "20px",
          lineHeight: 1.8,
        }}>
          Video encrypted with WebRTC · Messages with AES-256-GCM<br />
          Zero server storage
        </div>
      </div>
    </div>
  );
}