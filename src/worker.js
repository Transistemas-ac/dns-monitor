import diffRecords from "./utils/diffRecords.js";
import normalizeRecords from "./utils/normalizeRecords.js";
import sendEmail from "./utils/sendEmail.js";
import fetchAllDnsRecords from "./utils/fetchAllDnsRecords.js";
import buildEmailBody from "./utils/buildEmailBody.js";

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
};

async function runCheck(env) {
  const zoneId = env.CF_ZONE_ID;
  const apiToken = env.CF_API_TOKEN;

  const kvKeyDNS = `dns_state_${zoneId}`;
  const kvKeyNS = `ns_state_${zoneId}`;

  /* ---------- DNS REGISTERS (internos de Cloudflare) ---------- */

  const currentRecords = await fetchAllDnsRecords(zoneId, apiToken);
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

  const nsResponse = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${env.ZONE_NAME}&type=NS`,
    {
      headers: { Accept: "application/dns-json" },
    }
  );

  const nsData = await nsResponse.json();
  const currentNS = (nsData.Answer || [])
    .filter((a) => a.type === 2)
    .map((a) => a.data)
    .sort();

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

  /* ---------- CONDITIONAL EMAIL ---------- */

  if (diffDNS?.hasChanges || diffNS !== null) {
    const subject = `🚨 Cambio detectado en DNS de ${env.ZONE_NAME}`;
    const body = buildEmailBody(diffDNS, diffNS, env);
    await sendEmail(env, subject, body);
  }
}
