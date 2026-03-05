import { useEffect, useState } from "react";

export default function IncomingCall({ caller, onAccept, onReject }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    // Auto-reject after 30s
    const timeout = setTimeout(onReject, 30000);
    return () => { clearInterval(t); clearTimeout(timeout); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(6,6,8,0.85)",
      backdropFilter: "blur(8px)",
      animation: "fade-in 0.3s ease",
    }}>
      <div className="panel-green" style={{
        padding: "36px 32px", textAlign: "center",
        width: "min(340px, 90vw)",
        animation: "slide-up 0.3s ease",
      }}>
        {/* Pulse avatar */}
        <div style={{
          position: "relative", display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          marginBottom: "20px",
        }}>
          <div style={{
            position: "absolute",
            width: "80px", height: "80px", borderRadius: "50%",
            border: "2px solid rgba(0,255,136,0.4)",
            animation: "pulse-ring 1.5s ease-out infinite",
          }} />
          <div style={{
            position: "absolute",
            width: "80px", height: "80px", borderRadius: "50%",
            border: "2px solid rgba(0,255,136,0.2)",
            animation: "pulse-ring 1.5s ease-out 0.5s infinite",
          }} />
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem",
            animation: "ring-shake 1.5s ease-in-out infinite",
          }}>
            {caller.avatar || "👤"}
          </div>
        </div>

        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.55rem", letterSpacing: "0.2em",
          color: "rgba(0,255,136,0.4)", marginBottom: "6px",
        }}>INCOMING CALL</div>

        <div style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 700,
          fontSize: "1.4rem", color: "#e0e0e8", marginBottom: "4px",
        }}>
          {caller.username}
        </div>

        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "0.6rem", color: "rgba(255,255,255,0.2)",
          marginBottom: "28px",
        }}>
          {elapsed}s
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-red" onClick={onReject}
            style={{ flex: 1, justifyContent: "center" }}>
            ✕ Decline
          </button>
          <button className="btn btn-green" onClick={onAccept}
            style={{ flex: 1, justifyContent: "center" }}>
            ✓ Accept
          </button>
        </div>
      </div>
    </div>
  );
}