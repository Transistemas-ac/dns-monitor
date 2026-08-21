import dohQuery from "./dohQuery.js";

const COMMON_DKIM_SELECTORS = [
  "google",
  "google2",
  "default",
  "k1",
  "k2",
  "selector1",
  "selector2",
  "s1",
  "s2",
  "dkim",
  "mail",
  "smtp",
  "zoho",
  "o365",
  "ed25519",
];

const stripQuotes = (t) => t.replace(/^"+|"+$/g, "");

export default async function checkEmailRecords(env, domain) {
  const { zoneId, zoneName } = domain;
  const issues = [];

  try {
    if (domain.expectMX !== false) {
      const mx = await dohQuery(zoneName, 15);
      if (mx.length === 0) {
        issues.push({ level: "error", label: "MX", detail: "El dominio no tiene registros MX" });
      }
    }

    if (domain.expectSPF !== false) {
      const txt = (await dohQuery(zoneName, 16)).map(stripQuotes);
      const spf = txt.filter((t) => t.startsWith("v=spf1"));
      if (spf.length === 0) {
        issues.push({ level: "error", label: "SPF", detail: "No se encontró registro SPF (v=spf1)" });
      } else if (spf.length > 1) {
        issues.push({ level: "error", label: "SPF", detail: `SPF duplicado: ${spf.length} registros v=spf1` });
      } else {
        if (!/(^|\s)-?~?all(\s|$)/.test(spf[0])) {
          issues.push({ level: "warn", label: "SPF", detail: "SPF sin mecanismo all al final (recomendado ~all o -all)" });
        }

        const isLookup = (t) =>
          t.startsWith("include:") ||
          t.startsWith("redirect=") ||
          t === "a" || t.startsWith("a:") || t.startsWith("a/") ||
          t === "mx" || t.startsWith("mx:") || t.startsWith("mx/") ||
          t === "ptr" || t.startsWith("ptr:");
        const tokens = spf[0].split(/\s+/).filter(Boolean);
        const lookups = 1 + tokens.filter(isLookup).length;
        if (lookups > 10) {
          issues.push({ level: "error", label: "SPF", detail: `SPF con ${lookups} DNS lookups (máx. 10 según RFC 7208)` });
        }
      }
    }

    if (domain.expectDMARC !== false) {
      const dmarc = (await dohQuery(`_dmarc.${zoneName}`, 16)).map(stripQuotes);
      const records = dmarc.filter((t) => t.startsWith("v=DMARC1"));
      if (records.length === 0) {
        issues.push({ level: "warn", label: "DMARC", detail: "No se encontró registro DMARC (_dmarc)" });
      } else if (records.length > 1) {
        issues.push({ level: "error", label: "DMARC", detail: `DMARC duplicado: ${records.length} registros` });
      } else if (!/p=/.test(records[0])) {
        issues.push({ level: "error", label: "DMARC", detail: "DMARC sin política p=" });
      } else if (/\bp=none\b/.test(records[0])) {
        issues.push({ level: "warn", label: "DMARC", detail: "DMARC con p=none (solo monitoreo, sin enforcement)" });
      }
      if (!/\brua=/.test(records[0]) && !/\bruf=/.test(records[0])) {
        issues.push({ level: "warn", label: "DMARC", detail: "DMARC sin rua/ruf (no hay reportes de agregados ni fallas)" });
      }
    }

    if (domain.expectDKIM !== false) {
      const found = [];
      for (const selector of COMMON_DKIM_SELECTORS) {
        const dkim = (await dohQuery(`${selector}._domainkey.${zoneName}`, 16)).map(stripQuotes);
        if (dkim.some((t) => t.startsWith("v=DKIM1"))) {
          found.push(selector);
        }
      }
      if (found.length === 0) {
        issues.push({
          level: "warn",
          label: "DKIM",
          detail: `No se encontró DKIM (v=DKIM1) en selectores comunes: ${COMMON_DKIM_SELECTORS.join(", ")}`,
        });
      }
    }
  } catch (err) {
    console.error(`Email records ${zoneName}: ${err.message}`);
    return null;
  }

  issues.sort((a, b) => (a.level === "error" ? 0 : 1) - (b.level === "error" ? 0 : 1));

  const key = `email_state_${zoneId}`;
  const raw = await env.DNS_MONITOR.get(key);
  const prev = raw ? JSON.parse(raw) : null;

  if (!prev) {
    await env.DNS_MONITOR.put(key, JSON.stringify(issues));
    return null;
  }

  const keyOf = (i) => `${i.label}|${i.detail}`;
  const prevSet = new Set(prev.map(keyOf));
  const currSet = new Set(issues.map(keyOf));

  if (currSet.size === prevSet.size && [...currSet].every((k) => prevSet.has(k))) {
    return null;
  }

  await env.DNS_MONITOR.put(key, JSON.stringify(issues));

  const lines = [];
  for (const i of issues) {
    if (!prevSet.has(keyOf(i))) {
      lines.push(`+ [${i.level.toUpperCase()}] ${i.label}: ${i.detail}`);
    }
  }
  for (const p of prev) {
    if (!currSet.has(keyOf(p))) {
      lines.push(`✓ Resuelto: ${p.label}: ${p.detail}`);
    }
  }

  if (lines.length === 0) return null;

  return { title: "Verificación de registros de email", lines };
}