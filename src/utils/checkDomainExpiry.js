const DEFAULT_ALERT_DAYS = [60, 30, 14, 7, 1];
const DANGEROUS_STATUSES = ["pending delete", "redemption period", "client hold"];

function getRegistrar(data) {
  const ent = (data.entities || []).find((e) => (e.roles || []).includes("registrar"));
  const fn = ent?.vcardArray?.[1]?.find((item) => item[0] === "fn")?.[3];
  return fn || ent?.handle || null;
}

export default async function checkDomainExpiry(env, domain) {
  const { zoneId, zoneName } = domain;
  const kvKey = `expiry_state_${zoneId}`;

  let data;
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(zoneName)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error(`RDAP ${zoneName}: ${err.message}`);
    return null;
  }

  const event = (data.events || []).find((e) => e.eventAction === "expiration");
  if (!event?.eventDate) {
    console.error(`RDAP ${zoneName}: sin evento de expiración`);
    return null;
  }

  const expirationDate = event.eventDate;
  const daysLeft = Math.floor((Date.parse(expirationDate) - Date.now()) / 86400000);
  const registrar = getRegistrar(data);
  const dangerous = (data.status || []).map((s) => s.toLowerCase()).filter((s) =>
    DANGEROUS_STATUSES.includes(s)
  );

  const alertDays = Array.isArray(domain.expiryAlertDays)
    ? [...domain.expiryAlertDays]
    : [...DEFAULT_ALERT_DAYS];
  const sorted = alertDays.sort((a, b) => b - a);
  const crossing = sorted.find((d) => daysLeft <= d) ?? null;

  const raw = await env.DNS_MONITOR.get(kvKey);
  const prev = raw ? JSON.parse(raw) : null;

  const state = { expirationDate, alertedFor: crossing, registrar, status: dangerous };
  const fresh = !prev || prev.registrar === undefined;

  if (fresh) {
    await env.DNS_MONITOR.put(kvKey, JSON.stringify(state));
    return null;
  }

  await env.DNS_MONITOR.put(kvKey, JSON.stringify(state));

  const lines = [];

  if (prev.expirationDate !== expirationDate && prev.alertedFor !== null) {
    lines.push(`El dominio ${zoneName} fue renovado o su fecha de expiración cambió ✅`);
    lines.push(`Nueva fecha de expiración: ${expirationDate} (${daysLeft} días restantes)`);
  }

  if (prev.registrar !== registrar) {
    lines.push(`⚠️ Registrador: ${prev.registrar || "desconocido"} → ${registrar || "desconocido"}`);
  }

  for (const s of dangerous) {
    if (!prev.status.includes(s)) {
      lines.push(`🚨 Estado crítico detectado: "${s}" — ¡el dominio está en peligro!`);
    }
  }

  if (crossing !== null && prev.alertedFor !== crossing && prev.expirationDate === expirationDate) {
    lines.push(`El dominio ${zoneName} expira en ${daysLeft} días (${expirationDate}) ⚠️`);
    lines.push(
      daysLeft <= 7
        ? "¡Renoválo ya! Riesgo de perder el dominio."
        : `Umbral de alerta superado: ${crossing} días`
    );
  }

  if (lines.length === 0) return null;

  return { title: "Vencimiento y estado del dominio", lines };
}