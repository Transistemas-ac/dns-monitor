export default async function checkWeb(env, domain) {
  const { zoneId, zoneName } = domain;
  if (domain.expectWeb !== true) return null;

  const key = `web_state_${zoneId}`;

  let result;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`https://${zoneName}`, {
      redirect: "follow",
      headers: { "User-Agent": "DNS-Monitor/1.0" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    result = { ok: res.ok, status: res.status, error: null };
  } catch (err) {
    result = {
      ok: false,
      status: null,
      error: err.name === "AbortError" ? "timeout" : err.message,
    };
  }

  const raw = await env.DNS_MONITOR.get(key);
  const prev = raw ? JSON.parse(raw) : null;

  if (!prev) {
    await env.DNS_MONITOR.put(key, JSON.stringify(result));
    return null;
  }

  const changed =
    prev.ok !== result.ok || prev.status !== result.status || prev.error !== result.error;
  if (!changed) return null;

  await env.DNS_MONITOR.put(key, JSON.stringify(result));

  const lines = [];
  if (prev.ok && !result.ok) {
    lines.push(`❌ El sitio dejó de responder: ${result.error || `HTTP ${result.status}`}`);
  } else if (!prev.ok && result.ok) {
    lines.push(`✅ El sitio volvió a responder (HTTP ${result.status})`);
  } else if (result.ok) {
    lines.push(`El sitio responde HTTP ${result.status}`);
  } else {
    lines.push(`El sitio no responde: ${result.error || `HTTP ${result.status}`}`);
  }

  return { title: "Web check (¿el sitio está arriba?)", lines };
}