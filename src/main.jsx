import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// StrictMode intentionally removed — it double-mounts components in dev,
// which causes duplicate socket connections, duplicate join-room events,
// and duplicate WebRTC offers breaking calls entirely.
ReactDOM.createRoot(document.getElementById("root")).render(<App />);