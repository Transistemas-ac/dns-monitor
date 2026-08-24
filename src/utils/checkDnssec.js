import dohQuery from "./dohQuery.js";

export default async function checkDnssec(env, domain) {
  const { zoneId, zoneName } = domain;
  const key = `dnssec_state_${zoneId}`;

  let info;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dnssec`, {
      headers: { Authorization: `Bearer ${domain.cfToken}` },
    });
    if (res.status === 403) {
      console.error(`DNSSEC ${zoneName}: sin permisos (403), se omite`);
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    info = (await res.json()).result || {};
  } catch (err) {
    console.error(`DNSSEC ${zoneName}: ${err.message}`);
    return null;
  }

  const status = info.status || "unknown";
  const expectedDs = info.ds || null;

  let externalDs = [];
  try {
    externalDs = await dohQuery(zoneName, 43);
  } catch (err) {
    console.error(`DNSSEC ${zoneName} (DoH DS): ${err.message}`);
  }

  const raw = await env.DNS_MONITOR.get(key);
  const prev = raw ? JSON.parse(raw) : null;
  const state = { status, expectedDs, externalDs };

  if (!prev) {
    await env.DNS_MONITOR.put(key, JSON.stringify(state));
    return null;
  }

  const changed =
    prev.status !== status ||
    prev.expectedDs !== expectedDs ||
    JSON.stringify(prev.externalDs) !== JSON.stringify(externalDs);

  if (!changed) return null;

  await env.DNS_MONITOR.put(key, JSON.stringify(state));

  const lines = [];
  if (prev.status !== status) {
    lines.push(`Estado DNSSEC en Cloudflare: ${prev.status} -> ${status}`);
  }
  if (status === "active" && externalDs.length === 0) {
    lines.push("⚠️ DNSSEC activo en Cloudflare pero sin registros DS visibles en el DNS público (¿DS no propagado o eliminado?)");
  } else if (status !== "active" && externalDs.length > 0) {
    lines.push(`⚠️ Hay registros DS en el DNS público pero el estado en Cloudflare es "${status}" (DS huérfano)`);
  } else if (status === "active" && expectedDs && externalDs.length > 0 && !externalDs.some((d) => d.includes(expectedDs))) {
    lines.push(`❌ Mismatch: el DS esperado (${expectedDs}) no está entre los DS públicos (${externalDs.join(", ")})`);
  }
  lines.push(`Estado actual: ${status}${expectedDs ? ` | DS esperado: ${expectedDs}` : ""}`);

  return { title: "DNSSEC", lines };
}