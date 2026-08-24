/* ===== API JSON de settings del usuario (requiere sesión) ===== */

import { jsonError, jsonOk } from "../auth.js";
import { updateUserAlertEmail } from "../db.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleApiSettings(env, request, user) {
  if (request.method === "GET") {
    return jsonOk({ settings: { alertEmail: user.alert_email || "" } });
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

  return jsonError(405, "Método no permitido.");
}