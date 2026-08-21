const MISS_THRESHOLD_MS = 25 * 60 * 1000;
const ERROR_STREAK_ALERT = 3;

export async function checkMissedRuns(env) {
  const now = Date.now();
  const raw = await env.DNS_MONITOR.get("last_run_ts");
  await env.DNS_MONITOR.put("last_run_ts", String(now));

  if (!raw) return null;

  const elapsed = now - parseInt(raw, 10);
  if (elapsed <= MISS_THRESHOLD_MS) return null;

  return {
    title: "Heartbeat del monitor",
    lines: [
      `El monitor no registró corridas durante ${Math.round(elapsed / 60000)} minutos (intervalo esperado: 10 min).`,
      "Posibles causas: cron interrumpido, deploy fallido o Worker caído.",
      "Esta alerta confirma que el Worker volvió a ejecutarse.",
    ],
  };
}

export async function pingHealthchecks(env) {
  if (!env.HEALTHCHECKS_URL) return;

  try {
    const res = await fetch(env.HEALTHCHECKS_URL);
    if (!res.ok) {
      console.error(`Healthchecks ping falló: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error("Healthchecks ping:", err.message);
  }
}

export async function recordDomainError(env, domain) {
  const key = `error_streak_${domain.zoneId}`;
  const raw = await env.DNS_MONITOR.get(key);
  const streak = (raw ? parseInt(raw, 10) : 0) + 1;
  await env.DNS_MONITOR.put(key, String(streak));

  if (streak % ERROR_STREAK_ALERT !== 0) return null;

  return {
    title: "Error monitoreando el dominio",
    lines: [
      `Se detectaron ${streak} corridas consecutivas con errores monitoreando ${domain.zoneName}.`,
      "Revisar los logs con: npx wrangler tail",
    ],
  };
}

export async function clearDomainError(env, domain) {
  const key = `error_streak_${domain.zoneId}`;
  const raw = await env.DNS_MONITOR.get(key);
  if (!raw) return null;

  const streak = parseInt(raw, 10);
  await env.DNS_MONITOR.put(key, "0");

  if (streak < ERROR_STREAK_ALERT) return null;

  return {
    title: "Dominio recuperado",
    lines: [
      `${domain.zoneName} volvió a monitorearse correctamente ✅ (tras ${streak} corridas con errores)`,
    ],
  };
}