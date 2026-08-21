export default async function checkNsConsistency(env, domain) {
  const { zoneId, zoneName } = domain;
  const key = `nscons_state_${zoneId}`;

  let google = [];
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(zoneName)}&type=NS`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    google = (data.Answer || []).filter((a) => a.type === 2).map((a) => a.data).sort();
  } catch (err) {
    console.error(`NS consistency ${zoneName} (dns.google): ${err.message}`);
    return null;
  }

  let cf = [];
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(zoneName)}&type=NS`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cf = (data.Answer || []).filter((a) => a.type === 2).map((a) => a.data).sort();
  } catch (err) {
    console.error(`NS consistency ${zoneName} (cloudflare-dns.com): ${err.message}`);
    return null;
  }

  const equal = cf.length === google.length && cf.every((x, i) => x === google[i]);
  const state = { cf, google };

  const raw = await env.DNS_MONITOR.get(key);
  const prev = raw ? JSON.parse(raw) : null;

  if (!prev) {
    await env.DNS_MONITOR.put(key, JSON.stringify(state));
    return null;
  }

  const prevEqual =
    prev.cf.length === prev.google.length && prev.cf.every((x, i) => x === prev.google[i]);

  if (prevEqual === equal) return null;

  await env.DNS_MONITOR.put(key, JSON.stringify(state));

  const lines = [];
  if (!equal) {
    lines.push("⚠️ Los resolvers 1.1.1.1 (Cloudflare) y 8.8.8.8 (Google) devuelven nameservers distintos:");
    lines.push(`Cloudflare: ${cf.join(", ") || "(sin respuesta)"}`);
    lines.push(`Google: ${google.join(", ") || "(sin respuesta)"}`);
  } else {
    lines.push(`✅ Resolvers consistentes: ${cf.join(", ") || "(sin respuesta)"}`);
  }

  return { title: "Consistencia de nameservers (1.1.1.1 vs 8.8.8.8)", lines };
}