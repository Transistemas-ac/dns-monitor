import diffRecords from "./utils/diffRecords.js";
import normalizeRecords from "./utils/normalizeRecords.js";
import sendEmail from "./utils/sendEmail.js";
import fetchAllDnsRecords from "./utils/fetchAllDnsRecords.js";
import dohQuery from "./utils/dohQuery.js";
import checkDomainExpiry from "./utils/checkDomainExpiry.js";
import checkEmailRecords from "./utils/checkEmailRecords.js";
import checkDnssec from "./utils/checkDnssec.js";
import fetchAuditLogs from "./utils/fetchAuditLogs.js";
import {
  checkMissedRuns,
  pingHealthchecks,
  recordDomainError,
  clearDomainError,
} from "./utils/checkHeartbeat.js";
import buildEmailBody, { buildDnsSection, buildNsSection } from "./utils/buildEmailBody.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
};

function getDomains(env) {
  if (!env.DOMAINS) {
    console.error("DOMAINS var not configured");
    return [];
  }

  let domains = env.DOMAINS;
  if (typeof domains === "string") {
    domains = JSON.parse(domains);
  }

  if (!Array.isArray(domains)) {
    console.error("DOMAINS var must be a JSON array");
    return [];
  }

  return domains.filter(
    (d) =>
      d &&
      typeof d === "object" &&
      d.zoneId &&
      d.zoneName &&
      d.mailTo &&
      d.mailFrom
  );
}

function getMailTargets(domains) {
  const seen = new Set();
  const targets = [];
  for (const d of domains) {
    const k = `${d.mailTo}|${d.mailFrom}`;
    if (!seen.has(k)) {
      seen.add(k);
      targets.push({ to: d.mailTo, from: d.mailFrom });
    }
  }
  return targets;
}

async function runCheck(env) {
  const domains = getDomains(env);
  const targets = getMailTargets(domains);

  const heartbeatSection = await checkMissedRuns(env);
  const globalSections = heartbeatSection ? [heartbeatSection] : [];

  for (const domain of domains) {
    const sections = [];

    try {
      const result = await checkDomain(env, domain);
      sections.push(...result.sections);

      const recovered = await clearDomainError(env, domain);
      if (recovered) sections.push(recovered);
    } catch (err) {
      console.error(`Error monitoreando ${domain.zoneName}:`, err);
      const errSection = await recordDomainError(env, domain);
      if (errSection) sections.push(errSection);
    }

    if (sections.length > 0) {
      const subject =
        sections.length === 1
          ? `🚨 ${sections[0].title} en ${domain.zoneName}`
          : `🚨 Múltiples alertas en ${domain.zoneName}`;
      await sendEmail(env, {
        from: domain.mailFrom,
        to: domain.mailTo,
        subject,
        body: buildEmailBody(domain.zoneName, sections),
      });
    }
  }

  await pingHealthchecks(env);

  for (const section of globalSections) {
    for (const t of targets) {
      await sendEmail(env, {
        from: t.from,
        to: t.to,
        subject: `🚨 ${section.title}`,
        body: buildEmailBody("Monitor global", [section]),
      });
    }
  }
}

async function checkDomain(env, domain) {
  const zoneId = domain.zoneId;
  const sections = [];

  /* ---------- DNS REGISTERS (internos de Cloudflare) ---------- */

  const kvKeyDNS = `dns_state_${zoneId}`;
  const currentRecords = await fetchAllDnsRecords(zoneId, env.CF_API_TOKEN);
  const snapshotDNS = normalizeRecords(currentRecords);
  const previousDNSjson = await env.DNS_MONITOR.get(kvKeyDNS);
  let diffDNS = null;

  if (!previousDNSjson) {
    await env.DNS_MONITOR.put(kvKeyDNS, JSON.stringify(snapshotDNS));
  } else {
    const previousDNS = JSON.parse(previousDNSjson);
    diffDNS = diffRecords(previousDNS, snapshotDNS);
    if (diffDNS.hasChanges) {
      await env.DNS_MONITOR.put(kvKeyDNS, JSON.stringify(snapshotDNS));
    }
  }

  /* ---------- NAMESERVERS REALES (DNS externo, DoH) ---------- */

  const currentNS = await dohQuery(domain.zoneName, 2);
  const kvKeyNS = `ns_state_${zoneId}`;
  const previousNSjson = await env.DNS_MONITOR.get(kvKeyNS);
  let diffNS = null;

  if (!previousNSjson) {
    await env.DNS_MONITOR.put(kvKeyNS, JSON.stringify(currentNS));
  } else {
    const previousNS = JSON.parse(previousNSjson);

    const changed =
      previousNS.length !== currentNS.length ||
      previousNS.some((x, i) => x !== currentNS[i]);

    if (changed) {
      diffNS = { previous: previousNS, current: currentNS };
      await env.DNS_MONITOR.put(kvKeyNS, JSON.stringify(currentNS));
    }
  }

  if (diffDNS?.hasChanges) sections.push(buildDnsSection(diffDNS));
  if (diffNS) sections.push(buildNsSection(diffNS));

  /* ---------- AUDIT LOGS (quién lo cambió) ---------- */

  if (diffDNS?.hasChanges) {
    const auditSection = await fetchAuditSection(env, domain);
    if (auditSection) sections.push(auditSection);
  }

  /* ---------- CHECKS DIARIOS (frescura por KV) ---------- */

  const nowMs = Date.now();
  const isStale = async (key) => {
    const raw = await env.DNS_MONITOR.get(key);
    return !raw || nowMs - parseInt(raw, 10) > DAY_MS;
  };

  const dailyChecks = [
    [`last_expiry_ts_${zoneId}`, checkDomainExpiry],
    [`last_email_ts_${zoneId}`, checkEmailRecords],
    [`last_dnssec_ts_${zoneId}`, checkDnssec],
  ];

  for (const [key, checkFn] of dailyChecks) {
    if (await isStale(key)) {
      await env.DNS_MONITOR.put(key, String(nowMs));
      try {
        const section = await checkFn(env, domain);
        if (section) sections.push(section);
      } catch (err) {
        console.error(`Check diario ${domain.zoneName}:`, err);
      }
    }
  }

  return { domain, sections };
}

async function fetchAuditSection(env, domain) {
  const cursorKey = `audit_cursor_${domain.zoneId}`;
  const cursorRaw = await env.DNS_MONITOR.get(cursorKey);
  const since = cursorRaw || new Date(Date.now() - 15 * 60 * 1000).toISOString();

  let actors = [];
  try {
    actors = await fetchAuditLogs(env, domain, since);
    await env.DNS_MONITOR.put(cursorKey, new Date().toISOString());
  } catch (err) {
    if (err.message.includes("403")) {
      console.error(`Audit logs ${domain.zoneName}: sin permiso (requiere Zone > Logs > Read), se omite`);
    } else {
      console.error(`Audit logs ${domain.zoneName}: ${err.message}`);
    }
    return null;
  }

  if (actors.length === 0) return null;

  const unique = [
    ...new Map(actors.map((a) => [`${a.email}|${a.action}|${a.when}`, a])).values(),
  ];

  return {
    title: "Quién lo cambió (Audit Logs de Cloudflare)",
    lines: unique.map((a) => `${a.email} — ${a.action} (${a.when})`),
  };
}