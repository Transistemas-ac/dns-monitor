/* ===== API JSON de dominios (requiere sesión) ===== */

import {
  countDomains,
  createDomain,
  DB_QUOTA_DOMAINS,
  deleteDomain,
  deleteKvStateForZone,
  getDomain,
  listDomains,
  listAlerts,
  updateDomain,
} from "../db.js";
import { encryptSecret } from "../crypto.js";
import { jsonError, jsonOk } from "../auth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZONE_ID_RE = /^[0-9a-f]{32}$/i;

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function maskSecrets(domain) {
  return {
    id: domain.id,
    zoneId: domain.zone_id,
    zoneName: domain.zone_name,
    emoji: domain.emoji || "🌍",
    mailTo: domain.mail_to,
    mailFrom: domain.mail_from,
    expiryAlertDays: JSON.parse(domain.expiry_alert_days || "[60,30,14,7,1]"),
    expectMX: !!domain.expect_mx,
    expectSPF: !!domain.expect_spf,
    expectDMARC: !!domain.expect_dmarc,
    expectDKIM: !!domain.expect_dkim,
    expectCAA: !!domain.expect_caa,
    expectWeb: !!domain.expect_web,
    hasCfToken: !!domain.cf_token_enc,
    hasResendKey: !!domain.resend_key_enc,
    lastCheckTs: domain.last_check_ts,
    lastError: domain.last_error,
    createdAt: domain.created_at,
  };
}

async function cfErrorDetail(res) {
  try {
    const data = await res.json();
    return data.errors || [];
  } catch {
    return [];
  }
}

async function validateCfToken({ zoneId, zoneName, cfToken }) {
  const headers = { Authorization: `Bearer ${cfToken}` };

  /* 1) GET /zones/{id} valida acceso + nombre de zona, pero exige Zone → Zone → Read. */
  const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
    headers,
  });
  if (zoneRes.ok) {
    const data = await zoneRes.json();
    const zoneNameFromApi = data.result?.name;
    if (zoneNameFromApi) {
      if (zoneNameFromApi.toLowerCase() !== zoneName.trim().toLowerCase()) {
        throw new Error(`El zoneId corresponde a "${zoneNameFromApi}", no a "${zoneName}".`);
      }
      return;
    }
  }

  /* 2) Fallback: el endpoint que usa el monitor (Zone → DNS → Read).
     Si responde OK, el monitoreo puede operar aunque falte Zone → Zone → Read. */
  const dnsRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=1`,
    { headers }
  );
  if (dnsRes.ok) return;

  /* 3) Diagnóstico con los códigos de error de Cloudflare. */
  const [zoneErrors, dnsErrors] = await Promise.all([cfErrorDetail(zoneRes), cfErrorDetail(dnsRes)]);
  const errors = [...zoneErrors, ...dnsErrors];
  const codes = new Set(errors.map((e) => e.code));
  const messages = errors.map((e) => e.message).filter(Boolean);

  if (codes.has(9109)) {
    throw new Error(
      "Ese zoneId no corresponde a ninguna zona de tu cuenta de Cloudflare. Copialo desde Cloudflare → Overview → API → Zone ID (o revisá que la zona esté incluida en el alcance del token)."
    );
  }
  if (codes.has(10000) || messages.some((m) => /auth/i.test(m))) {
    throw new Error("El token de Cloudflare es inválido o no incluye esa zona en su alcance.");
  }
  if (zoneRes.status === 401 || dnsRes.status === 401) {
    throw new Error("El token de Cloudflare es inválido (401).");
  }
  throw new Error(
    "El token no tiene acceso a esa zona. Verificá que el token tenga el permiso Zone → DNS → Read y que la zona esté incluida en su alcance."
  );
}

async function validateResendKey(resendKey) {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  if (!res.ok) {
    throw new Error("La API key de Resend es inválida o no tiene permisos.");
  }
}

function validateCommon(body) {
  const errors = [];
  if (!body.zoneId || !ZONE_ID_RE.test(body.zoneId)) errors.push("zoneId inválido (32 caracteres hexadecimales).");
  if (!body.zoneName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(body.zoneName)) errors.push("zoneName inválido.");
  if (!body.mailTo || !EMAIL_RE.test(body.mailTo)) errors.push("mailTo inválido.");
  if (!body.mailFrom || !EMAIL_RE.test(body.mailFrom)) errors.push("mailFrom inválido.");
  if (errors.length) throw new Error(errors.join(" "));
}

function flagsFromBody(body, existing) {
  const parseDays = () => {
    if (Array.isArray(body.expiryAlertDays)) {
      return body.expiryAlertDays.map(Number).filter((n) => Number.isFinite(n));
    }
    if (existing?.expiry_alert_days) {
      try {
        return JSON.parse(existing.expiry_alert_days);
      } catch {
        return [60, 30, 14, 7, 1];
      }
    }
    return [60, 30, 14, 7, 1];
  };
  const bool = (key, fallback) =>
    body[key] !== undefined ? !!body[key] : fallback;
  return {
    expiryAlertDays: parseDays(),
    expectMX: bool("expectMX", existing ? existing.expect_mx === 1 : true),
    expectSPF: bool("expectSPF", existing ? existing.expect_spf === 1 : true),
    expectDMARC: bool("expectDMARC", existing ? existing.expect_dmarc === 1 : true),
    expectDKIM: bool("expectDKIM", existing ? existing.expect_dkim === 1 : true),
    expectCAA: bool("expectCAA", existing ? existing.expect_caa === 1 : false),
    expectWeb: bool("expectWeb", existing ? existing.expect_web === 1 : false),
  };
}

/* ---------- Handlers ---------- */

export async function handleApiDomains(env, request, user) {
  if (request.method === "GET") {
    const domains = await listDomains(env, user.id);
    return jsonOk({ domains: domains.map(maskSecrets) });
  }

  if (request.method === "POST") {
    const body = await readJson(request);
    if (!body) return jsonError(400, "Body JSON inválido.");

    try {
      validateCommon(body);
      const quota = await countDomains(env, user.id);
      if (quota >= DB_QUOTA_DOMAINS) {
        return jsonError(403, `Alcanzaste el límite de ${DB_QUOTA_DOMAINS} dominios del plan gratuito.`);
      }
      if (!body.cfToken) return jsonError(400, "El token de Cloudflare es obligatorio.");
      if (!body.resendKey) return jsonError(400, "La API key de Resend es obligatoria.");

      await validateCfToken({
        zoneId: body.zoneId,
        zoneName: body.zoneName,
        cfToken: body.cfToken,
      });
      await validateResendKey(body.resendKey);

      const cf = await encryptSecret(env, body.cfToken);
      const rs = await encryptSecret(env, body.resendKey);
      const flags = flagsFromBody(body);

      const id = await createDomain(env, {
        userId: user.id,
        domain: {
          zoneId: body.zoneId.trim(),
          zoneName: body.zoneName.trim(),
          mailTo: body.mailTo.trim(),
          mailFrom: body.mailFrom.trim(),
          emoji: body.emoji || "🌍",
          ...flags,
          cfTokenEnc: cf.enc,
          cfTokenIv: cf.iv,
          resendKeyEnc: rs.enc,
          resendKeyIv: rs.iv,
        },
      });

      return jsonOk({ domain: { id } }, 201);
    } catch (err) {
      return jsonError(400, err.message);
    }
  }

  return jsonError(405, "Método no permitido.");
}

export async function handleApiDomainItem(env, request, user, id) {
  const domainId = parseInt(id, 10);
  if (!Number.isInteger(domainId)) return jsonError(400, "ID inválido.");

  const existing = await getDomain(env, domainId, user.id);
  if (!existing) return jsonError(404, "Dominio no encontrado.");

  if (request.method === "DELETE") {
    await deleteDomain(env, domainId, user.id);
    await deleteKvStateForZone(env, existing.zone_id);
    return jsonOk({ deleted: true });
  }

  if (request.method === "PUT") {
    const body = await readJson(request);
    if (!body) return jsonError(400, "Body JSON inválido.");

    try {
      const next = {
        mailTo: body.mailTo ?? existing.mail_to,
        mailFrom: body.mailFrom ?? existing.mail_from,
        emoji: body.emoji ?? (existing.emoji || "🌍"),
        ...flagsFromBody(body, existing),
      };
      if (body.mailTo !== undefined && !EMAIL_RE.test(next.mailTo)) return jsonError(400, "mailTo inválido.");
      if (body.mailFrom !== undefined && !EMAIL_RE.test(next.mailFrom)) return jsonError(400, "mailFrom inválido.");

      let cfTokenEnc = existing.cf_token_enc;
      let cfTokenIv = existing.cf_token_iv;
      if (body.cfToken) {
        await validateCfToken({
          zoneId: existing.zone_id,
          zoneName: existing.zone_name,
          cfToken: body.cfToken,
        });
        const cf = await encryptSecret(env, body.cfToken);
        cfTokenEnc = cf.enc;
        cfTokenIv = cf.iv;
      }

      let resendKeyEnc = existing.resend_key_enc;
      let resendKeyIv = existing.resend_key_iv;
      if (body.resendKey) {
        await validateResendKey(body.resendKey);
        const rs = await encryptSecret(env, body.resendKey);
        resendKeyEnc = rs.enc;
        resendKeyIv = rs.iv;
      }

      await updateDomain(env, domainId, user.id, {
        ...next,
        cfTokenEnc,
        cfTokenIv,
        resendKeyEnc,
        resendKeyIv,
      });

      const updated = await getDomain(env, domainId, user.id);
      return jsonOk({ domain: maskSecrets(updated) });
    } catch (err) {
      return jsonError(400, err.message);
    }
  }

  return jsonError(405, "Método no permitido.");
}

export async function handleApiAlerts(env, request, user, domainId) {
  if (request.method !== "GET") return jsonError(405, "Método no permitido.");

  const parsedId = parseInt(domainId, 10);
  if (!Number.isInteger(parsedId)) return jsonError(400, "ID inválido.");
  const domain = await getDomain(env, parsedId, user.id);
  if (!domain) return jsonError(404, "Dominio no encontrado.");

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(50, Math.max(5, parseInt(url.searchParams.get("per_page") || "20", 10) || 20));

  const { alerts, total } = await listAlerts(env, {
    userId: user.id,
    domainId: parsedId,
    page,
    perPage,
  });

  return jsonOk({
    domain: maskSecrets(domain),
    alerts: alerts.map((a) => ({
      id: a.id,
      subject: a.subject,
      createdAt: a.created_at,
    })),
    total,
    page,
    perPage,
  });
}

