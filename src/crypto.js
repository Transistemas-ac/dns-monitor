/* ===== Utilidades de cifrado y hashing (WebCrypto, sin dependencias) ===== */

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/* ===== Passwords (PBKDF2-SHA256, 100k iteraciones) ===== */

async function pbkdf2(password, salt, iterations = 100000) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return { saltHex: bytesToHex(salt), hashHex: bytesToHex(hash) };
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const hash = await pbkdf2(password, hexToBytes(saltHex));
  return bytesToHex(hash) === expectedHashHex;
}

/* ===== Secretos del usuario (AES-256-GCM con MASTER_KEY del operador) ===== */

async function importMasterKey(env) {
  if (!env.MASTER_KEY) {
    throw new Error("MASTER_KEY secret no configurado");
  }
  const raw = base64ToBytes(env.MASTER_KEY);
  if (raw.length !== 32) {
    throw new Error("MASTER_KEY debe ser una clave base64 de 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(env, plaintext) {
  const key = await importMasterKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  return { enc: bytesToBase64(new Uint8Array(ct)), iv: bytesToBase64(iv) };
}

export async function decryptSecret(env, encB64, ivB64) {
  const key = await importMasterKey(env);
  const ct = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    key,
    base64ToBytes(encB64)
  );
  return new TextDecoder().decode(ct);
}