/* ===== Sesiones, cookies y rate-limit de login ===== */

import { createSession, deleteSession, getSessionUser } from "./db.js";
import { randomToken, sha256Hex } from "./crypto.js";

const SESSION_COOKIE = "dnsm_session";
const SESSION_DAYS = 30;
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 900;

export function getCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function isSecure(request) {
  return request.url.startsWith("https://");
}

export function sessionCookie(request, token, maxAgeSeconds = SESSION_DAYS * 86400) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(request) {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isSecure(request)) parts.push("Secure");
  return parts.join("; ");
}

export async function startSession(env, request, userId) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + SESSION_DAYS * 86400 * 1000;
  await createSession(env, { tokenHash, userId, expiresAt });
  return sessionCookie(request, token);
}

export async function getCurrentUser(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return getSessionUser(env, tokenHash);
}

export async function logoutSession(env, request) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await deleteSession(env, await sha256Hex(token));
  }
}

export function jsonError(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(data, status = 200) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/* ---------- Rate-limit de login (KV, por email + IP) ---------- */

export async function checkLoginRateLimit(env, email, request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `rl_login_${(await sha256Hex(email.toLowerCase())).slice(0, 24)}_${ip}`;
  const current = parseInt((await env.DNS_MONITOR.get(key)) || "0", 10);
  if (current >= LOGIN_MAX_ATTEMPTS) {
    return { limited: true, retryAfter: LOGIN_WINDOW_SECONDS };
  }
  return { limited: false, bump: async () => {
    await env.DNS_MONITOR.put(key, String(current + 1), {
      expirationTtl: LOGIN_WINDOW_SECONDS,
    });
  } };
}

/* ---------- Validación CSRF básica (SameSite=Lax + chequeo de Origin) ---------- */

export function isValidOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}