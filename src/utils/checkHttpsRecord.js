import dohQuery from "./dohQuery.js";

export default async function checkHttpsRecord(env, domain) {
  const { zoneId, zoneName } = domain;
  const key = `https_state_${zoneId}`;

  let records = [];
  try {
    records = await dohQuery(zoneName, 65);
  } catch (err) {
    console.error(`HTTPS/SVCB ${zoneName}: ${err.message}`);
    return null;
  }

  const raw = await env.DNS_MONITOR.get(key);
  const prev = raw ? JSON.parse(raw) : null;

  if (!prev) {
    await env.DNS_MONITOR.put(key, JSON.stringify({ records }));
    return null;
  }

  const changed = JSON.stringify(prev.records) !== JSON.stringify(records);
  if (!changed) return null;

  await env.DNS_MONITOR.put(key, JSON.stringify({ records }));

  const lines = [];
  if (records.length === 0) {
    lines.push("⚠️ Ya no hay registro HTTPS (SVCB) en el apex");
  } else {
    lines.push("Registros HTTPS (SVCB) actuales:");
    for (const r of records) lines.push(`+ ${r}`);
    for (const r of prev.records) {
      if (!records.includes(r)) lines.push(`- ${r}`);
    }
  }

  return { title: "Registro HTTPS (SVCB)", lines };
}