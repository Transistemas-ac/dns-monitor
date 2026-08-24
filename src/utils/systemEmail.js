/* ===== Emails de sistema y de alertas del operador ===== */

import sendEmail from "./sendEmail.js";

export const SYSTEM_MAIL_FROM = "DNS Monitor <no-reply@transistemas.org>";

export async function sendSystemEmail(env, request, { to, subject, text, html }) {
  if (!env.RESEND_API_KEY) {
    console.log("Email de sistema no enviado (RESEND_API_KEY no configurado):", subject);
    return false;
  }
  try {
    await sendEmail({
      apiKey: env.RESEND_API_KEY,
      from: env.SYSTEM_MAIL_FROM || SYSTEM_MAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("Error enviando email de sistema:", err.message);
    return false;
  }
}

export function emailHtml(title, body, link, buttonLabel, steps) {
  const stepsHtml = Array.isArray(steps) && steps.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px">
         ${steps.map((s, i) =>
           `<tr><td style="padding:10px 0;color:#b8b8b7;font-size:14px;line-height:1.55">
              <span style="display:inline-block;background:#54b4f0;color:#1b1b1a;border-radius:50%;width:22px;height:22px;text-align:center;line-height:22px;font-weight:bold;font-size:12px;margin-right:10px">${i + 1}</span>${s}
            </td></tr>`
         ).join("")}
       </table>`
    : "";
  return `<!doctype html>
<html lang="es">
<body style="margin:0;background:#1b1b1a;font-family:Arial,sans-serif;padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#2a2a29;border-radius:16px;border:2px solid #3a3a39">
        <tr>
          <td style="padding:28px 32px;text-align:center">
            <div style="font-size:40px">🛰️</div>
            <h1 style="font-family:Arial,sans-serif;color:#fefffe;font-size:22px;margin:12px 0 8px">${title}</h1>
            <p style="color:#b8b8b7;font-size:15px;line-height:1.6;margin:0 0 20px">${body}</p>
            ${stepsHtml}
            <a href="${link}" style="display:inline-block;background:#fe98cc;color:#1b1b1a;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:20px;font-size:15px">${buttonLabel}</a>
            <p style="color:#8a8a89;font-size:12px;margin:20px 0 0">DNS Monitor — <a href="https://dns.transistemas.org" style="color:#54b4f0">dns.transistemas.org</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}