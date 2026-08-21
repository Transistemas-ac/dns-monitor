export default async function fetchAuditLogs(env, domain, since) {
  const url = `https://api.cloudflare.com/client/v4/zones/${domain.zoneId}/audit_logs?since=${encodeURIComponent(since)}&direction=desc&per_page=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();

  return (data.result || [])
    .filter(
      (e) =>
        e.resource?.type === "dns_record" ||
        (e.action?.id || "").startsWith("dns_record.")
    )
    .map((e) => ({
      email: e.actor?.email || "desconocido",
      action: e.action?.id || "dns_record",
      when: e.when ? new Date(e.when).toLocaleString("es-AR") : "—",
    }));
}