// In production: VITE_SERVER_URL = https://your-server.up.railway.app
// In local dev: empty string — vite proxy handles it
const BASE = import.meta.env.VITE_SERVER_URL || "";

async function request(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  register: (body) => request("POST", "/auth/register", body),
  login: (body) => request("POST", "/auth/login", body),
  me: (token) => request("GET", "/auth/me", null, token),
  getFriends: (token) => request("GET", "/friends", null, token),
  addFriend: (username, token) => request("POST", "/friends/add", { username }, token),
  acceptFriend: (userId, token) => request("POST", "/friends/accept", { userId }, token),
  removeFriend: (userId, token) => request("DELETE", `/friends/${userId}`, null, token),
  getIceConfig: (token) => request("GET", "/ice-config", null, token),
};

// Export the base URL so socket.io can use it too
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5000";