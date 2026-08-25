/* ===== Resumen de estado de un dominio para la card del dashboard ===== */

export default async function buildDomainSummary(env, zoneId) {
  const kv = (key) => env.DNS_MONITOR.get(key).then((r) => (r ? JSON.parse(r) : null));

  const [dnsState, nsState, expiryState, emailState, dnssecState, caaState, webState, nsconsState, httpsState] =
    await Promise.all([
      kv(`dns_state_${zoneId}`),
      kv(`ns_state_${zoneId}`),
      kv(`expiry_state_${zoneId}`),
      kv(`email_state_${zoneId}`),
      kv(`dnssec_state_${zoneId}`),
      kv(`caa_state_${zoneId}`),
      kv(`web_state_${zoneId}`),
      kv(`nscons_state_${zoneId}`),
      kv(`https_state_${zoneId}`),
    ]);

  return {
    ips: extractIps(dnsState),
    mx: extractMx(dnsState),
    spf: parseSpfStatus(emailState),
    dmarc: parseDmarcStatus(emailState),
    dkimFound: parseDkimFound(emailState),
    dkimTotal: 14,
    dnssec: dnssecState ? { status: dnssecState.status, active: dnssecState.status === "active" } : null,
    caa: caaState ? caaState.records : [],
    expiry: expiryState
      ? {
          date: expiryState.expirationDate,
          daysLeft: Math.floor((Date.parse(expiryState.expirationDate) - Date.now()) / 86400000),
          registrar: expiryState.registrar,
          dangerous: expiryState.status || [],
        }
      : null,
    web: webState,
    ns: nsState || [],
    nsConsistent: nsconsState
      ? nsconsState.cf.length > 0 &&
        nsconsState.cf.length === nsconsState.google.length &&
        nsconsState.cf.every((x, i) => x === nsconsState.google[i])
      : null,
    https: httpsState ? httpsState.records : [],
    hasHttpsRecord: httpsState ? httpsState.records.length > 0 : null,
  };
}

function extractIps(dnsState) {
  if (!dnsState) return [];
  return dnsState
    .filter((r) => r.type === "A" || r.type === "AAAA")
    .map((r) => ({ type: r.type, content: r.content }));
}

function extractMx(dnsState) {
  if (!dnsState) return [];
  return dnsState
    .filter((r) => r.type === "MX")
    .map((r) => r.content);
}

function parseSpfStatus(emailState) {
  if (!emailState) return null;
  const spf = emailState.find((i) => i.label === "SPF");
  if (!spf) return { ok: true };
  return { ok: spf.level !== "error", detail: spf.detail };
}

function parseDmarcStatus(emailState) {
  if (!emailState) return null;
  const dmarc = emailState.find((i) => i.label === "DMARC");
  if (!dmarc) return { ok: true, policy: "enforced" };
  const isNone = dmarc.detail && dmarc.detail.includes("p=none");
  return { ok: dmarc.level !== "error", policy: isNone ? "none" : "warn", detail: dmarc.detail };
}

function parseDkimFound(emailState) {
  if (!emailState) return null;
  const dkim = emailState.find((i) => i.label === "DKIM");
  if (!dkim) return 14;
  const match = dkim.detail && dkim.detail.match(/selectores comunes: (.+)/);
  return 0;
}
