import dohQuery from "./dohQuery.js";

const stripEch = (s) => s.replace(/\s+ech=[^\s]+/g, "");
const normalize = (records) => records.map(stripEch);

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

  const prevNorm = normalize(prev.records);
  const currNorm = normalize(records);
  const changed = JSON.stringify(prevNorm) !== JSON.stringify(currNorm);
  if (!changed) return null;

  await env.DNS_MONITOR.put(key, JSON.stringify({ records }));

  const lines = [];
  if (records.length === 0) {
    lines.push("⚠️ Ya no hay registro HTTPS (SVCB) en el apex");
  } else {
    lines.push("Registros HTTPS (SVCB) actuales:");
    for (const r of currNorm) lines.push(`+ ${r}`);
    for (const r of prevNorm) {
      if (!currNorm.includes(r)) lines.push(`- ${r}`);
    }
  }

  return { title: "Registro HTTPS (SVCB)", lines };
}