/* ===== API JSON de settings del usuario (requiere sesión) ===== */

import { jsonError, jsonOk } from "../auth.js";
import { updateUserAlertEmail, getUserCfToken } from "../db.js";
import { emailHtml, sendSystemEmail } from "../utils/systemEmail.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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