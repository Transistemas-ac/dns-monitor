/* ===== API JSON de settings del usuario (requiere sesión) ===== */

import { jsonError, jsonOk } from "../auth.js";
import { updateUserAlertEmail, getUserCfToken, setUserCfToken } from "../db.js";
import { encryptSecret, decryptSecret } from "../crypto.js";
import { emailHtml, sendSystemEmail } from "../utils/systemEmail.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CF_TOKEN_RE = /^[A-Za-z0-9_-]+$/;

/* Valida que el token tenga los permisos mínimos (Zone → Zone → Read). */
async function validateCfTokenMinimal(cfToken) {
  const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=1", {
    headers: { Authorization: `Bearer ${cfToken}` },
  });
  if (res.status === 401) throw new Error("El token de Cloudflare es inválido (401).");
  if (res.status === 403) throw new Error("El token no tiene permiso Zone → Zone → Read.");
  if (!res.ok) throw new Error("No se pudo validar el token contra Cloudflare (HTTP " + res.status + ").");
}

export async function handleApiToken(env, request, user) {
  if (request.method === "GET") {
    return jsonOk({ hasCfToken: !!(user.cf_token_enc && user.cf_token_iv) });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Body JSON inválido.");
    }
    const cfToken = String(body.cfToken || "").trim();
    if (!cfToken) return jsonError(400, "Ingresá un token.");
    if (!CF_TOKEN_RE.test(cfToken)) return jsonError(400, "El token tiene un formato inválido.");
    try {
      await validateCfTokenMinimal(cfToken);
    } catch (err) {
      return jsonError(400, err.message);
    }
    const cf = await encryptSecret(env, cfToken);
    await setUserCfToken(env, user.id, cf.enc, cf.iv);
    return jsonOk({ saved: true });
  }

  if (request.method === "DELETE") {
    await setUserCfToken(env, user.id, null, null);
    return jsonOk({ deleted: true });
  }

  return jsonError(405, "Método no permitido.");
}

export async function handleApiSettings(env, request, user) {
  if (request.method === "GET") {
    return jsonOk({ 
      settings: { 
        alertEmail: user.alert_email || "",
        hasCfToken: !!(user.cf_token_enc && user.cf_token_iv)
      } 
    });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Body JSON inválido.");
    }
    const email = String(body.alertEmail || "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      return jsonError(400, "Email inválido.");
    }
    await updateUserAlertEmail(env, user.id, email || null);
    return jsonOk({ settings: { alertEmail: email } });
  }

  if (request.method === "POST" && request.url.endsWith("/test")) {
    let body;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const email = String(body.alertEmail || "").trim().toLowerCase();
    const to = email && EMAIL_RE.test(email) ? email : user.alert_email || user.email;

    const sent = await sendSystemEmail(env, request, {
      to,
      subject: "DNS Monitor — prueba de alertas por email",
      text: "🔔 Si recibís este correo, tus alertas por email están configuradas correctamente. No respondas a este mensaje.",
      html: emailHtml(
        "Prueba de alertas por email",
        "🔔 Si estás viendo este correo, tus alertas por email están configuradas correctamente.",
        `${new URL(request.url).origin}/app/alertas`,
        "Volver a las alertas"
      ),
    });
    if (!sent) {
      return jsonError(400, "No se pudo enviar el email de prueba (revisá la configuración del operador).");
    }
    return jsonOk({ tested: true });
  }

  return jsonError(405, "Método no permitido.");
}