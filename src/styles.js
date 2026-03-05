export const globalCSS = `
  @keyframes pulse-ring {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2); opacity: 0; }
  }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
  @keyframes slide-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ring-shake {
    0%,100% { transform: rotate(0); }
    20% { transform: rotate(-8deg); }
    40% { transform: rotate(8deg); }
    60% { transform: rotate(-6deg); }
    80% { transform: rotate(6deg); }
  }
  @keyframes scan {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }
  @keyframes glow-pulse {
    0%,100% { box-shadow: 0 0 10px rgba(0,255,136,0.2); }
    50% { box-shadow: 0 0 24px rgba(0,255,136,0.5); }
  }

  .scan-line {
    position: fixed; inset: 0; pointer-events: none; z-index: 9999;
    background: linear-gradient(transparent 0%, rgba(0,255,136,0.025) 50%, transparent 100%);
    animation: scan 10s linear infinite; height: 60px; width: 100%;
  }
  .grid-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(0,255,136,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,255,136,0.025) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  .btn {
    font-family: 'Space Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 10px 20px;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-green {
    background: transparent;
    border: 1px solid #00ff88;
    color: #00ff88;
  }
  .btn-green:hover { background: #00ff88; color: #060608; }
  .btn-green:disabled { opacity: 0.3; cursor: not-allowed; pointer-events: none; }

  .btn-red {
    background: transparent;
    border: 1px solid #ff4466;
    color: #ff4466;
  }
  .btn-red:hover { background: #ff4466; color: #fff; }

  .btn-ghost {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.4);
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: #fff; }

  .input {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e0e0e8;
    font-family: 'Space Mono', monospace;
    font-size: 0.78rem;
    padding: 10px 14px;
    outline: none;
    width: 100%;
    transition: border-color 0.15s;
  }
  .input:focus { border-color: rgba(0,255,136,0.5); }
  .input::placeholder { color: rgba(224,224,232,0.2); }

  .mono { font-family: 'Space Mono', monospace; }
  .label {
    font-family: 'Space Mono', monospace;
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(0,255,136,0.4);
    display: block;
    margin-bottom: 5px;
  }
  .tag {
    font-family: 'Space Mono', monospace;
    font-size: 0.55rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 2px 8px;
    border: 1px solid currentColor;
  }
  .divider {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.05);
    margin: 16px 0;
  }

  .panel {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.07);
  }
  .panel-green {
    background: rgba(0,255,136,0.03);
    border: 1px solid rgba(0,255,136,0.15);
  }

  .online-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #00ff88;
    box-shadow: 0 0 6px #00ff88;
    flex-shrink: 0;
  }
  .offline-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #333;
    flex-shrink: 0;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.15); }
  ::-webkit-scrollbar-track { background: transparent; }
`;