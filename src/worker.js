import diffRecords from "./utils/diffRecords.js";
import normalizeRecords from "./utils/normalizeRecords.js";
import sendEmail from "./utils/sendEmail.js";
import fetchAllDnsRecords from "./utils/fetchAllDnsRecords.js";
import dohQuery from "./utils/dohQuery.js";
import checkDomainExpiry from "./utils/checkDomainExpiry.js";
import checkEmailRecords from "./utils/checkEmailRecords.js";
import checkDnssec from "./utils/checkDnssec.js";
import checkCaa from "./utils/checkCaa.js";
import checkWeb from "./utils/checkWeb.js";
import checkNsConsistency from "./utils/checkNsConsistency.js";
import checkHttpsRecord from "./utils/checkHttpsRecord.js";
import fetchAuditLogs from "./utils/fetchAuditLogs.js";
import {
  checkMissedRuns,
  pingHealthchecks,
  recordDomainError,
  clearDomainError,
} from "./utils/checkHeartbeat.js";
import buildEmailBody, {
  buildEmailText,
  buildDnsSection,
  buildNsSection,
} from "./utils/buildEmailBody.js";

import {
  createToken,
  createUser,
  deleteToken,
  deleteTokensForUser,
  getAllAlertEmails,
  getAllChannels,
  getAllDomains,
  getTokenUser,
  getUserByEmail,
  getUserById,
  insertAlert,
  setUserVerified,
  updateDomainStatus,
  updateUserPassword,
} from "./db.js";
import {
  decryptSecret,
  hashPassword,
  randomToken,
  sha256Hex,
  verifyPassword,
} from "./crypto.js";
import {
  checkLoginRateLimit,
  clearSessionCookie,
  getCurrentUser,
  isValidOrigin,
  jsonError,
  logoutSession,
  startSession,
} from "./auth.js";
import { renderDashboardPage } from "./pages/dashboard.js";
import { renderAlertsPage } from "./pages/alerts.js";
import { renderTokenPage } from "./pages/token.js";
import {
  renderChangePasswordPage,
  renderForgotPage,
  renderLoginPage,
  renderMessagePage,
  renderRegisterPage,
  renderResetPage,
  renderVerifySentPage,
} from "./pages/auth.js";
import {
  handleApiAlerts,
  handleApiDomainItem,
  handleApiDomains,
} from "./api/domains.js";
import { handleApiChannels } from "./api/channels.js";
import { handleApiSettings, handleApiToken } from "./api/settings.js";
import sendToChannels from "./utils/sendToChannels.js";
import { emailHtml, sendSystemEmail, SYSTEM_MAIL_FROM } from "./utils/systemEmail.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },

  async fetch(request, env, ctx) {
    return handleFetch(request, env);
  },
};

/* ============================================================
   HTTP (dashboard, auth, API)
   ============================================================ */

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirect(location, setCookie) {
  const headers = { Location: location };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return new Response(null, { status: 302, headers });
}

async function handleFetch(request, env) {
  const url = new URL(request.url);

  if (request.method === "POST" && !isValidOrigin(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  /* ---------- API JSON ---------- */

  if (url.pathname.startsWith("/api/")) {
    const user = await getCurrentUser(env, request);
    if (!user) return jsonError(401, "Necesitás iniciar sesión.");

    if (url.pathname === "/api/domains") {
      return handleApiDomains(env, request, user);
    }

    if (url.pathname === "/api/settings" || url.pathname === "/api/settings/test") {
      return handleApiSettings(env, request, user);
    }

    if (url.pathname === "/api/token") {
      return handleApiToken(env, request, user);
    }

    if (url.pathname.startsWith("/api/channels")) {
      return handleApiChannels(env, request, user);
    }

    const match = url.pathname.match(/^\/api\/domains\/(\d+)(\/alerts)?$/);
    if (match) {
      if (match[2]) return handleApiAlerts(env, request, user, match[1]);
      return handleApiDomainItem(env, request, user, match[1]);
    }

    return jsonError(404, "No encontrado.");
  }

  /* ---------- Páginas ---------- */

  switch (url.pathname) {
    case "/register": {
      const user = await getCurrentUser(env, request);
      if (user) return redirect("/app");
      if (request.method !== "POST") return html(renderRegisterPage({}));

      const form = await request.formData();
      const email = String(form.get("email") || "").trim().toLowerCase();
      const password = String(form.get("password") || "");

      if (!EMAIL_RE.test(email)) {
        return html(renderRegisterPage({ error: "Email inválido.", email }));
      }
      if (password.length < 8) {
        return html(renderRegisterPage({ error: "La contraseña debe tener al menos 8 caracteres.", email }));
      }
      if (await getUserByEmail(env, email)) {
        return html(renderRegisterPage({ error: "Ya existe una cuenta con ese email. Ingresá.", email }));
      }

      const { saltHex, hashHex } = await hashPassword(password);
      const userId = await createUser(env, { email, passwordHash: hashHex, salt: saltHex });

      const verificationSent = await sendVerificationEmail(env, request, userId, email);
      await sendWelcomeEmail(env, request, email);
      if (verificationSent) {
        return redirect(`/verify-sent?email=${encodeURIComponent(email)}`);
      }

      /* Sin email de sistema configurado (dev): la cuenta queda verificada. */
      await setUserVerified(env, userId);
      const cookie = await startSession(env, request, userId);
      return redirect("/app", cookie);
    }

    case "/verify-sent": {
      const email = url.searchParams.get("email") || "";
      return html(renderVerifySentPage({ email }));
    }

    case "/verify": {
      const token = url.searchParams.get("token");
      if (!token) {
        return html(renderMessagePage({
          emoji: "😕",
          title: "Link inválido",
          message: "Falta el token de confirmación.",
          ctaHref: "/login",
          ctaLabel: "Ir a ingresar",
        }));
      }
      const user = await getTokenUser(env, await sha256Hex(token), "verify");
      if (!user) {
        return html(renderMessagePage({
          emoji: "😕",
          title: "Link inválido o vencido",
          message: "El link de confirmación expiró o ya fue usado. Podés reenviarlo desde el ingreso.",
          ctaHref: "/login",
          ctaLabel: "Ir a ingresar",
        }));
      }
      await deleteToken(env, await sha256Hex(token));
      await setUserVerified(env, user.id);
      return html(renderMessagePage({
        emoji: "✅",
        title: "Email confirmado",
        message: "Tu cuenta está verificada. Ya podés ingresar y agregar dominios.",
        ctaHref: "/login",
        ctaLabel: "Ingresar",
      }));
    }

    case "/resend": {
      const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
      if (!email) return redirect("/login");
      const account = await getUserByEmail(env, email);
      if (account && !account.verified) {
        await sendVerificationEmail(env, request, account.id, account.email);
      }
      return html(renderVerifySentPage({ email }));
    }

    case "/forgot": {
      if (request.method !== "POST") return html(renderForgotPage({}));

      const form = await request.formData();
      const email = String(form.get("email") || "").trim().toLowerCase();

      if (!EMAIL_RE.test(email)) {
        return html(renderForgotPage({ error: "Email inválido.", email }));
      }

      const account = await getUserByEmail(env, email);
      if (account) {
        await sendResetEmail(env, request, account.id, account.email);
      }
      return html(renderForgotPage({ email, sent: true }));
    }

    case "/reset": {
      if (request.method === "GET") {
        const token = url.searchParams.get("token");
        if (!token) {
          return html(renderMessagePage({
            emoji: "😕",
            title: "Link inválido",
            message: "Falta el token de recuperación.",
            ctaHref: "/forgot",
            ctaLabel: "Pedir otro link",
          }));
        }
        const account = await getTokenUser(env, await sha256Hex(token), "reset");
        if (!account) {
          return html(renderMessagePage({
            emoji: "😕",
            title: "Link inválido o vencido",
            message: "El link de recuperación expiró o ya fue usado. Pedí uno nuevo.",
            ctaHref: "/forgot",
            ctaLabel: "Pedir otro link",
          }));
        }
        return html(renderResetPage({ token }));
      }

      const form = await request.formData();
      const token = String(form.get("token") || "");
      const password = String(form.get("password") || "");
      const password2 = String(form.get("password2") || "");

      if (password.length < 8) {
        return html(renderResetPage({ error: "La contraseña debe tener al menos 8 caracteres.", token }));
      }
      if (password !== password2) {
        return html(renderResetPage({ error: "Las contraseñas no coinciden.", token }));
      }

      const account = await getTokenUser(env, await sha256Hex(token), "reset");
      if (!account) {
        return html(renderResetPage({ error: "El link expiró o ya fue usado. Pedí uno nuevo.", token: "" }));
      }

      const { saltHex, hashHex } = await hashPassword(password);
      await updateUserPassword(env, account.id, hashHex, saltHex);
      await deleteToken(env, await sha256Hex(token));

      return html(renderMessagePage({
        emoji: "✅",
        title: "Contraseña actualizada",
        message: "Ya podés ingresar con tu contraseña nueva.",
        ctaHref: "/login",
        ctaLabel: "Ingresar",
      }));
    }

    case "/login": {
      const user = await getCurrentUser(env, request);
      if (user) return redirect("/app");
      if (request.method !== "POST") return html(renderLoginPage({}));

      const form = await request.formData();
      const email = String(form.get("email") || "").trim().toLowerCase();
      const password = String(form.get("password") || "");

      const rl = await checkLoginRateLimit(env, email, request);
      if (rl.limited) {
        return html(renderLoginPage({ error: "Demasiados intentos. Probá de nuevo en unos minutos.", email }));
      }

      const account = await getUserByEmail(env, email);
      const valid = account && (await verifyPassword(password, account.salt, account.password_hash));
      if (!valid) {
        await rl.bump();
        return html(renderLoginPage({ error: "Email o contraseña incorrectos.", email }));
      }

      if (!account.verified) {
        return html(renderLoginPage({
          error: "Confirmá tu email antes de ingresar.",
          email,
          unverified: true,
        }));
      }

      const cookie = await startSession(env, request, account.id);
      return redirect("/app", cookie);
    }

    case "/change-password": {
      const user = await getCurrentUser(env, request);
      if (!user) return redirect("/login");
      if (request.method !== "POST") return html(renderChangePasswordPage({ user }));

      const form = await request.formData();
      const current = String(form.get("current") || "");
      const password = String(form.get("password") || "");
      const password2 = String(form.get("password2") || "");

      const account = await getUserById(env, user.id);
      const validCurrent = await verifyPassword(current, account.salt, account.password_hash);
      if (!validCurrent) {
        return html(renderChangePasswordPage({ user, error: "La contraseña actual es incorrecta." }));
      }
      if (password.length < 8) {
        return html(renderChangePasswordPage({ user, error: "La contraseña nueva debe tener al menos 8 caracteres." }));
      }
      if (password !== password2) {
        return html(renderChangePasswordPage({ user, error: "Las contraseñas nuevas no coinciden." }));
      }

      const { saltHex, hashHex } = await hashPassword(password);
      await updateUserPassword(env, user.id, hashHex, saltHex);
      const cookie = await startSession(env, request, user.id);
      return redirect("/app", cookie);
    }

    case "/logout": {
      await logoutSession(env, request);
      return redirect("/", clearSessionCookie(request));
    }

    case "/app/alertas": {
      const user = await getCurrentUser(env, request);
      if (!user) return redirect("/login");
      return html(renderAlertsPage({ user }));
    }

    case "/app/token": {
      const user = await getCurrentUser(env, request);
      if (!user) return redirect("/login");
      return html(renderTokenPage({ user }));
    }

    case "/app": {
      const user = await getCurrentUser(env, request);
      if (!user) return redirect("/login");
      return html(renderDashboardPage({ user }));
    }
  }

  return new Response("No encontrado", { status: 404 });
}

/* ---------- Emails de sistema (operador: RESEND_API_KEY + SYSTEM_MAIL_FROM) ---------- */

async function sendVerificationEmail(env, request, userId, email) {
  if (!env.RESEND_API_KEY) return false;
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await deleteTokensForUser(env, userId, "verify");
  await createToken(env, {
    tokenHash,
    userId,
    type: "verify",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
  const origin = new URL(request.url).origin;
  const link = `${origin}/verify?token=${encodeURIComponent(token)}`;
  return sendSystemEmail(env, request, {
    to: email,
    subject: "Confirmá tu email — DNS Monitor",
    text: `Confirmá tu cuenta de DNS Monitor tocando este link (válido por 24 h):\n\n${link}`,
    html: emailHtml(
      "Confirmá tu email",
      "Tocá el botón para activar tu cuenta de DNS Monitor.\n El link vence en 24 horas.",
      link,
      "Confirmar mi email"
    ),
  });
}

async function sendWelcomeEmail(env, request, email) {
  if (!env.RESEND_API_KEY) return false;
  const origin = new URL(request.url).origin;
  return sendSystemEmail(env, request, {
    to: email,
    subject: "Te damos la bienvenida a DNS Monitor",
    text:
      "¡Hola!\n\n" +
      "Tu cuenta en DNS Monitor se creó con éxito. Estos son tus próximos pasos:\n\n" +
      "1. Confirmá tu email con el link que te enviamos aparte.\n" +
      "2. Conectá tu token de Cloudflare desde el dashboard.\n" +
      "3. Agregá tus dominios. El monitor los vigila cada 10 minutos y te avisa por email ante cualquier cambio.\n\n" +
      "Cualquier duda, respondé este correo.\n\n" +
      "— Equipo de DNS Monitor",
    html: emailHtml(
      "Te damos la bienvenida",
      "Tu cuenta en DNS Monitor se creó con éxito. Estos son tus próximos pasos:",
      `${origin}/login`,
      "Ir a mi dashboard",
      [
        "Confirmá tu email con el link que te enviamos aparte",
        "Conectá tu token de Cloudflare",
        "Agregá tus dominios: los vigilamos cada 10 minutos y te avisamos por email ante cualquier cambio",
      ]
    ),
  });
}

async function sendResetEmail(env, request, userId, email) {
  if (!env.RESEND_API_KEY) return false;
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await deleteTokensForUser(env, userId, "reset");
  await createToken(env, {
    tokenHash,
    userId,
    type: "reset",
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  const origin = new URL(request.url).origin;
  const link = `${origin}/reset?token=${encodeURIComponent(token)}`;
  return sendSystemEmail(env, request, {
    to: email,
    subject: "Recuperar contraseña — DNS Monitor",
    text: `Para crear una contraseña nueva, tocá este link (válido por 1 hora):\n\n${link}\n\nSi no pediste este cambio, ignorá este correo.`,
    html: emailHtml(
      "Recuperar contraseña",
      "Tocá el botón para crear una contraseña nueva. El link vence en 1 hora. Si no lo pediste vos, ignorá este correo.",
      link,
      "Crear nueva contraseña"
    ),
  });
}

/* ============================================================
   Motor de monitoreo (cron)
   ============================================================ */

function domainFromRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    zoneId: row.zone_id,
    zoneName: row.zone_name,
    emoji: row.emoji || "🌍",
    expiryAlertDays: JSON.parse(row.expiry_alert_days || "[60,30,14,7,1]"),
    expectMX: !!row.expect_mx,
    expectSPF: !!row.expect_spf,
    expectDMARC: !!row.expect_dmarc,
    expectDKIM: !!row.expect_dkim,
    expectCAA: !!row.expect_caa,
    expectWeb: !!row.expect_web,
    alertEmail: row.user_alert_email || row.user_email,
    cfTokenEnc: row.cf_token_enc,
    cfTokenIv: row.cf_token_iv,
  };
}

async function getDomains(env) {
  /* Modo SaaS: los dominios y secretos viven en D1 (fuente de verdad). */
  if (env.DB) {
    const rows = await getAllDomains(env);
    const domains = [];
    for (const row of rows) {
      try {
        const cfToken = await decryptSecret(env, row.cf_token_enc, row.cf_token_iv);
        domains.push(domainFromRow({ ...row, cf_token_enc: row.cf_token_enc, cf_token_iv: row.cf_token_iv }));
      } catch (err) {
        console.error(`Secretos cifrados inválidos para ${row.zone_name}:`, err.message);
        await updateDomainStatus(env, row.id, {
          lastCheckTs: Date.now(),
          lastError: "Secretos cifrados inválidos (revisá MASTER_KEY)",
        });
      }
    }
    return domains;
  }

  /* Modo legacy self-host: la variable DOMAINS + secretos globales. */
  if (!env.DOMAINS) {
    console.error("DOMAINS var not configured");
    return [];
  }

  let domains = env.DOMAINS;
  if (typeof domains === "string") {
    domains = JSON.parse(domains);
  }

  if (!Array.isArray(domains)) {
    console.error("DOMAINS var must be a JSON array");
    return [];
  }

  return domains
    .filter(
      (d) =>
        d &&
        typeof d === "object" &&
        d.zoneId &&
        d.zoneName &&
        d.mailTo &&
        d.mailFrom
    )
    .map((d) => ({ ...d, cfToken: env.CF_API_TOKEN }));
}

async function runCheck(env) {

  const channelsByUser = new Map();
  if (env.DB) {
    const allChannels = await getAllChannels(env);
    for (const ch of allChannels) {
      if (!channelsByUser.has(ch.user_id)) channelsByUser.set(ch.user_id, []);
      channelsByUser.get(ch.user_id).push(ch);
    }
  }

  const heartbeatSection = await checkMissedRuns(env);
  const globalSections = heartbeatSection ? [heartbeatSection] : [];

  for (const domain of domains) {
    const sections = [];
    const nowMs = Date.now();
    let error = null;

    try {
      const result = await checkDomain(env, domain);
      sections.push(...result.sections);

      const recovered = await clearDomainError(env, domain);
      if (recovered) sections.push(recovered);
    } catch (err) {
      error = err.message || String(err);
      console.error(`Error monitoreando ${domain.zoneName}:`, err);
      const errSection = await recordDomainError(env, domain);
      if (errSection) sections.push(errSection);
    }

    if (domain.id && env.DB) {
      await updateDomainStatus(env, domain.id, { lastCheckTs: nowMs, lastError: error });
    }

    if (sections.length > 0) {
      const subject =
        sections.length === 1
          ? `🚨 ${sections[0].title} en ${domain.zoneName}`
          : `🚨 Múltiples alertas en ${domain.zoneName}`;

      if (domain.id && env.DB) {
        await insertAlert(env, {
          domainId: domain.id,
          userId: domain.userId,
          subject,
          sections: sections.map((s) => ({ title: s.title, lines: s.lines })),
        });
      }

      const channelSections = sections.map((s) => ({ title: s.title, lines: s.lines }));
      for (const ch of channelsByUser.get(domain.userId) || []) {
        await sendToChannels(env, ch, {
          subject,
          domain: domain.zoneName,
          sections: channelSections,
        });
      }

      try {
        await sendEmail({
          apiKey: env.RESEND_API_KEY,
          from: env.SYSTEM_MAIL_FROM || SYSTEM_MAIL_FROM,
          to: domain.alertEmail,
          subject,
          html: buildEmailBody(domain.zoneName, sections),
          text: buildEmailText(domain.zoneName, sections),
        });
      } catch (err) {
        console.error(`No se pudo enviar el correo para ${domain.zoneName}:`, err);
      }
    }
  }

  await pingHealthchecks(env);

  /* Alertas globales a los emails configurados en la sección Alertas
     (usa el email de sistema del operador). */
  if (globalSections.length > 0 && env.DB && env.RESEND_API_KEY) {
    const alertEmails = await getAllAlertEmails(env);
    for (const section of globalSections) {
      for (const to of alertEmails) {
        try {
          await sendEmail({
            apiKey: env.RESEND_API_KEY,
            from: env.SYSTEM_MAIL_FROM || SYSTEM_MAIL_FROM,
            to,
            subject: `🚨 ${section.title}`,
            html: buildEmailBody("Monitor global", [section]),
            text: buildEmailText("Monitor global", [section]),
          });
        } catch (err) {
          console.error(`No se pudo enviar el correo global a ${to}:`, err);
        }
      }
    }
  }

  /* Alertas globales a todos los canales configurados. */
  for (const ch of [...channelsByUser.values()].flat()) {
    for (const section of globalSections) {
      await sendToChannels(env, ch, {
        subject: `🚨 ${section.title}`,
        domain: "Monitor global",
        sections: [{ title: section.title, lines: section.lines }],
      });
    }
  }
}

async function checkDomain(env, domain) {
  const zoneId = domain.zoneId;
  const sections = [];

  /* ---------- DNS REGISTERS (internos de Cloudflare) ---------- */

  const kvKeyDNS = `dns_state_${zoneId}`;
  const currentRecords = await fetchAllDnsRecords(zoneId, domain.cfToken);
  const snapshotDNS = normalizeRecords(currentRecords);
  const previousDNSjson = await env.DNS_MONITOR.get(kvKeyDNS);
  let diffDNS = null;

  if (!previousDNSjson) {
    await env.DNS_MONITOR.put(kvKeyDNS, JSON.stringify(snapshotDNS));
  } else {
    const previousDNS = JSON.parse(previousDNSjson);
    diffDNS = diffRecords(previousDNS, snapshotDNS);
    if (diffDNS.hasChanges) {
      await env.DNS_MONITOR.put(kvKeyDNS, JSON.stringify(snapshotDNS));
    }
  }

  /* ---------- NAMESERVERS REALES (DNS externo, DoH) ---------- */

  const currentNS = await dohQuery(domain.zoneName, 2);
  const kvKeyNS = `ns_state_${zoneId}`;
  const previousNSjson = await env.DNS_MONITOR.get(kvKeyNS);
  let diffNS = null;

  if (!previousNSjson) {
    await env.DNS_MONITOR.put(kvKeyNS, JSON.stringify(currentNS));
  } else {
    const previousNS = JSON.parse(previousNSjson);

    const changed =
      previousNS.length !== currentNS.length ||
      previousNS.some((x, i) => x !== currentNS[i]);

    if (changed) {
      diffNS = { previous: previousNS, current: currentNS };
      await env.DNS_MONITOR.put(kvKeyNS, JSON.stringify(currentNS));
    }
  }

  if (diffDNS?.hasChanges) sections.push(buildDnsSection(diffDNS));
  if (diffNS) sections.push(buildNsSection(diffNS));

  /* ---------- AUDIT LOGS (quién lo cambió) ---------- */

  if (diffDNS?.hasChanges) {
    const auditSection = await fetchAuditSection(env, domain);
    if (auditSection) sections.push(auditSection);
  }

  /* ---------- CHECKS DIARIOS (frescura por KV) ---------- */

  const nowMs = Date.now();
  const isStale = async (key) => {
    const raw = await env.DNS_MONITOR.get(key);
    return !raw || nowMs - parseInt(raw, 10) > DAY_MS;
  };

  const dailyChecks = [
    [`last_expiry_ts_${zoneId}`, checkDomainExpiry],
    [`last_email_ts_${zoneId}`, checkEmailRecords],
    [`last_dnssec_ts_${zoneId}`, checkDnssec],
    [`last_caa_ts_${zoneId}`, checkCaa],
    [`last_web_ts_${zoneId}`, checkWeb],
    [`last_nscons_ts_${zoneId}`, checkNsConsistency],
    [`last_https_ts_${zoneId}`, checkHttpsRecord],
  ];

  for (const [key, checkFn] of dailyChecks) {
    if (await isStale(key)) {
      await env.DNS_MONITOR.put(key, String(nowMs));
      try {
        const section = await checkFn(env, domain);
        if (section) sections.push(section);
      } catch (err) {
        console.error(`Check diario ${domain.zoneName}:`, err);
      }
    }
  }

  return { domain, sections };
}

async function fetchAuditSection(env, domain) {
  const cursorKey = `audit_cursor_${domain.zoneId}`;
  const cursorRaw = await env.DNS_MONITOR.get(cursorKey);
  const since = cursorRaw || new Date(Date.now() - 15 * 60 * 1000).toISOString();

  let actors = [];
  try {
    actors = await fetchAuditLogs(env, domain, since);
    await env.DNS_MONITOR.put(cursorKey, new Date().toISOString());
  } catch (err) {
    if (err.message.includes("403")) {
      console.error(`Audit logs ${domain.zoneName}: sin permiso (requiere Zone > Logs > Read), se omite`);
    } else {
      console.error(`Audit logs ${domain.zoneName}: ${err.message}`);
    }
    return null;
  }

  if (actors.length === 0) return null;

  const unique = [
    ...new Map(actors.map((a) => [`${a.email}|${a.action}|${a.when}`, a])).values(),
  ];

  return {
    title: "Quién lo cambió (Audit Logs de Cloudflare)",
    lines: unique.map((a) => `${a.email} — ${a.action} (${a.when})`),
  };
}