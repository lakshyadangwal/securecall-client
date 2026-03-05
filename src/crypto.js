export async function generateKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]
  );
}

export async function exportPublicKey(keyPair) {
  const raw = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(base64Key) {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    "raw", raw, { name: "ECDH", namedCurve: "P-256" }, true, []
  );
}

export async function deriveSharedKey(privateKey, peerPublicKey) {
  return await window.crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(sharedKey, plaintext) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptMessage(sharedKey, base64Data) {
  const combined = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    sharedKey, combined.slice(12)
  );
  return new TextDecoder().decode(plaintext);
}

export async function keyFingerprint(base64Key) {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const hash = await window.crypto.subtle.digest("SHA-256", raw);
  const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex.match(/.{1,4}/g).slice(0, 8).join(" ");
}