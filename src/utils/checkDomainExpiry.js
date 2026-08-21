const DEFAULT_ALERT_DAYS = [60, 30, 14, 7, 1];

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

  const alertDays = Array.isArray(domain.expiryAlertDays)
    ? [...domain.expiryAlertDays]
    : [...DEFAULT_ALERT_DAYS];
  const sorted = alertDays.sort((a, b) => b - a);
  const crossing = sorted.find((d) => daysLeft <= d) ?? null;

  const raw = await env.DNS_MONITOR.get(kvKey);
  const prev = raw ? JSON.parse(raw) : null;

  if (!prev) {
    await env.DNS_MONITOR.put(kvKey, JSON.stringify({ expirationDate, alertedFor: null }));
    return null;
  }

  const renewed = prev.expirationDate !== expirationDate && prev.alertedFor !== null;

  await env.DNS_MONITOR.put(kvKey, JSON.stringify({ expirationDate, alertedFor: crossing }));

  if (renewed) {
    return {
      title: "Vencimiento de dominio",
      lines: [
        `El dominio ${zoneName} fue renovado o su fecha de expiración cambió ✅`,
        `Nueva fecha de expiración: ${expirationDate} (${daysLeft} días restantes)`,
      ],
    };
  }

  if (crossing === null || prev.alertedFor === crossing) return null;

  return {
    title: "Vencimiento de dominio",
    lines: [
      `El dominio ${zoneName} expira en ${daysLeft} días (${expirationDate}) ⚠️`,
      daysLeft <= 7
        ? "¡Renoválo ya! Riesgo de perder el dominio."
        : `Umbral de alerta superado: ${crossing} días`,
    ],
  };
}