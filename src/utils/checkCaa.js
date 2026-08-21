import dohQuery from "./dohQuery.js";

export default async function checkCaa(env, domain) {
  const { zoneId, zoneName } = domain;
  const key = `caa_state_${zoneId}`;
  const warnKey = `caa_warned_${zoneId}`;

  let records = [];
  try {
    records = await dohQuery(zoneName, 257);
  } catch (err) {
    console.error(`CAA ${zoneName}: ${err.message}`);
    return null;
  }

  const lines = [];

  if (domain.expectCAA === true && records.length === 0) {
    const warned = await env.DNS_MONITOR.get(warnKey);
    if (!warned) {
      await env.DNS_MONITOR.put(warnKey, "1");
      lines.push("⚠️ No se encontraron registros CAA: cualquier CA puede emitir certificados para este dominio");
    }
  }

  const raw = await env.DNS_MONITOR.get(key);
  const prev = raw ? JSON.parse(raw) : null;

  if (!prev) {
    await env.DNS_MONITOR.put(key, JSON.stringify({ records }));
    if (lines.length === 0) return null;
  } else {
    const changed = JSON.stringify(prev.records) !== JSON.stringify(records);
    if (changed) {
      await env.DNS_MONITOR.put(key, JSON.stringify({ records }));

      if (records.length === 0) {
        lines.push("⚠️ Ya no hay registros CAA en el dominio");
      } else {
        lines.push("Cambio en registros CAA:");
        for (const r of records) lines.push(`+ ${r}`);
        for (const r of prev.records) {
          if (!records.includes(r)) lines.push(`- ${r}`);
        }
      }
    } else if (lines.length === 0) {
      return null;
    }
  }

  if (lines.length === 0) return null;

  return { title: "CAA (Certificate Authority Authorization)", lines };
}