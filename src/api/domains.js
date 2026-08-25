/* ===== API JSON de dominios (requiere sesión) ===== */

import {
  countDomains,
  createDomain,
  DB_QUOTA_DOMAINS,
  deleteDomain,
  deleteKvStateForZone,
  getDomain,
  getUserCfToken,
  listDomains,
  listAlerts,
  setUserCfToken,
  updateDomain,
} from "../db.js";
import { decryptSecret, encryptSecret } from "../crypto.js";
import { jsonError, jsonOk } from "../auth.js";
import buildDomainSummary from "./domainSummary.js";

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
    expiryAlertDays: JSON.parse(domain.expiry_alert_days || "[60,30,14,7,1]"),
    expectMX: !!domain.expect_mx,
    expectSPF: !!domain.expect_spf,
    expectDMARC: !!domain.expect_dmarc,
    expectDKIM: !!domain.expect_dkim,
    expectCAA: !!domain.expect_caa,
    expectWeb: !!domain.expect_web,
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

async function lookupZoneId(zoneName, cfToken) {
  const headers = { Authorization: `Bearer ${cfToken}` };
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(zoneName.trim())}&per_page=1`,
    { headers }
  );
  if (!res.ok) {
    const errors = await cfErrorDetail(res);
    const codes = new Set((await Promise.all([cfErrorDetail(res)])).flat().map((e) => e.code));
    if (res.status === 401) throw new Error("El token de Cloudflare es inválido (401).");
    if (res.status === 403) throw new Error("El token no tiene permiso Zone → Zone → Read para buscar la zona.");
    throw new Error("No se pudo buscar la zona en Cloudflare.");
  }
  const data = await res.json();
  const zone = data.result?.[0];
  if (!zone) {
    throw new Error(`No se encontró la zona "${zoneName}" en tu cuenta de Cloudflare.`);
  }
  return zone.id;
}

async function validateCfToken(zoneName, cfToken) {
  const zoneId = await lookupZoneId(zoneName, cfToken);
  
  /* Validar que el token tiene acceso a los DNS records de esa zona (Zone → DNS → Read) */
  const headers = { Authorization: `Bearer ${cfToken}` };
  const dnsRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=1`,
    { headers: { Authorization: `Bearer ${cfToken}` } }
  );
  if (!dnsRes.ok) {
    const errors = await cfErrorDetail(dnsRes);
    if (dnsRes.status === 403) throw new Error("El token no tiene permiso Zone → DNS → Read para leer los registros.");
    throw new Error("El token no tiene acceso a los DNS de la zona (requiere Zone → DNS → Read).");
  }
  return zoneId;
}

function validateCommon(body) {
  const errors = [];
  // zoneId se resuelve automáticamente desde zoneName vía la API de Cloudflare,
  // no lo pedimos al cliente. Solo validamos si viene explícito.
  if (body.zoneId && !ZONE_ID_RE.test(body.zoneId)) errors.push("zoneId inválido (32 caracteres hexadecimales).");
  if (!body.zoneName || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(body.zoneName)) errors.push("zoneName inválido.");
  if (errors.length) throw new Error(errors.join(" "));
}

function flagsFromBody(body, existing) {
  return {
    expectMX: true,
    expectSPF: true,
    expectDMARC: true,
    expectDKIM: true,
    expectCAA: true,
    expectWeb: true,
  };
}

/* ---------- Handlers ---------- */

export async function handleApiDomains(env, request, user) {
  if (request.method === "GET") {
    const domains = await listDomains(env, user.id);
    const summaries = await Promise.all(
      domains.map((d) => buildDomainSummary(env, d.zone_id).catch(() => null))
    );
    const result = domains.map((d, i) => ({
      ...maskSecrets(d),
      summary: summaries[i],
    }));
    return jsonOk({ domains: result });
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

      /* Resolver el token CF: usar el enviado, o el guardado a nivel de usuario. */
      let cfToken = body.cfToken;
      if (!cfToken) {
        const stored = await getUserCfToken(env, user.id);
        if (stored?.cf_token_enc) {
          cfToken = await decryptSecret(env, stored.cf_token_enc, stored.cf_token_iv);
        }
      }
      if (!cfToken) {
        return jsonError(400, "Necesitás configurar un token de Cloudflare. Andá a /app/token.");
      }

      // Validar que el token tenga acceso a la zona
      const zoneId = await validateCfToken(body.zoneName.trim(), cfToken);

      const flags = flagsFromBody(body);

      const id = await createDomain(env, {
        userId: user.id,
        domain: {
          zoneId,
          zoneName: body.zoneName.trim(),
          emoji: body.emoji || "🌍",
          ...flags,
        },
      });

      // Guardar el token CF a nivel de usuario (solo si se envió uno nuevo)
      if (body.cfToken) {
        const cf = await encryptSecret(env, body.cfToken);
        await setUserCfToken(env, user.id, cf.enc, cf.iv);
      }

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
        emoji: body.emoji ?? (existing.emoji || "🌍"),
        ...flagsFromBody(body, existing),
      };

      /* Si se envía un token nuevo, validarlo y guardarlo a nivel de usuario. */
      if (body.cfToken) {
        await validateCfToken(existing.zone_name, body.cfToken);
        const cf = await encryptSecret(env, body.cfToken);
        await setUserCfToken(env, existing.user_id, cf.enc, cf.iv);
      }

      await updateDomain(env, domainId, user.id, next);

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

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(50, Math.max(5, parseInt(url.searchParams.get("per_page") || "20", 10) || 20));

  if (domainId) {
    const parsedId = parseInt(domainId, 10);
    if (!Number.isInteger(parsedId)) return jsonError(400, "ID inválido.");
    const domain = await getDomain(env, parsedId, user.id);
    if (!domain) return jsonError(404, "Dominio no encontrado.");

    const { alerts: rows, total } = await listAlerts(env, {
      userId: user.id,
      domainId: parsedId,
      page,
      perPage,
    });

    return jsonOk({
      domain: maskSecrets(domain),
      alerts: rows.map((a) => ({
        id: a.id,
        subject: a.subject,
        createdAt: a.created_at,
      })),
      total,
      page,
      perPage,
    });
  }

  /* Sin domainId: historial global con filtro opcional por múltiples dominios */
  const domainIdsParam = url.searchParams.get("domain_ids");
  const domainIds = domainIdsParam
    ? domainIdsParam.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0)
    : [];

  const { alerts: rows, total } = await listAlerts(env, {
    userId: user.id,
    domainIds,
    page,
    perPage,
  });

  return jsonOk({
    alerts: rows.map((a) => ({
      id: a.id,
      domainId: a.domain_id,
      subject: a.subject,
      createdAt: a.created_at,
    })),
    total,
    page,
    perPage,
  });
}

