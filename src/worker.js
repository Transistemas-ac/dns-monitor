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

/* -------------------------------------------------------------- */
/* --------------------------- HELPERS --------------------------- */
/* -------------------------------------------------------------- */

async function fetchAllDnsRecords(zoneId, apiToken) {
  let page = 1;
  const perPage = 100;
  let all = [];

  while (true) {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?page=${page}&per_page=${perPage}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`Error al obtener DNS: ${res.status}`);
    }

    const data = await res.json();
    all = all.concat(data.result || []);

    const info = data.result_info;
    if (!info || page >= info.total_pages) break;

    page++;
  }

  return all;
}

function normalizeRecords(records) {
  const mapped = records.map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    ttl: r.ttl,
    proxied: !!r.proxied,
  }));

  mapped.sort((a, b) => {
    const ka = `${a.name}|${a.type}|${a.content}`;
    const kb = `${b.name}|${b.type}|${b.content}`;
    return ka.localeCompare(kb);
  });

  return mapped;
}

function diffRecords(previous, current) {
  const prevMap = new Map(previous.map((r) => [r.id, r]));
  const currMap = new Map(current.map((r) => [r.id, r]));

  const created = [];
  const deleted = [];
  const updated = [];

  for (const r of current) {
    if (!prevMap.has(r.id)) {
      created.push(r);
    } else {
      const p = prevMap.get(r.id);
      if (
        p.type !== r.type ||
        p.name !== r.name ||
        p.content !== r.content ||
        p.ttl !== r.ttl ||
        p.proxied !== r.proxied
      ) {
        updated.push({ before: p, after: r });
      }
    }
  }

  for (const p of previous) {
    if (!currMap.has(p.id)) {
      deleted.push(p);
    }
  }

  return {
    created,
    deleted,
    updated,
    hasChanges: created.length > 0 || deleted.length > 0 || updated.length > 0,
  };
}

function buildEmailBody(diffDNS, diffNS, env) {
  const zoneName = env.ZONE_NAME || "transistemas.org";
  let lines = [];

  lines.push(`Se detectaron cambios en el dominio ${zoneName}`);
  lines.push("");

  /* DNS records */
  if (diffDNS?.hasChanges) {
    lines.push("Cambios en registros DNS internos (Cloudflare)");
    lines.push("");

    lines.push(`Nuevos: ${diffDNS.created.length}`);
    lines.push(`Eliminados: ${diffDNS.deleted.length}`);
    lines.push(`Modificados: ${diffDNS.updated.length}`);
    lines.push("");

    if (diffDNS.created.length > 0) {
      lines.push("Nuevos:");
      for (const r of diffDNS.created.slice(0, 20)) {
        lines.push(`+ ${r.type} ${r.name} -> ${r.content}`);
      }
      lines.push("");
    }

    if (diffDNS.deleted.length > 0) {
      lines.push("Eliminados:");
      for (const r of diffDNS.deleted.slice(0, 20)) {
        lines.push(`- ${r.type} ${r.name} -> ${r.content}`);
      }
      lines.push("");
    }

    if (diffDNS.updated.length > 0) {
      lines.push("Modificados:");
      for (const u of diffDNS.updated.slice(0, 20)) {
        const b = u.before;
        const a = u.after;
        lines.push(`* ${a.type} ${a.name}`);
        lines.push(`  antes: ${b.content}`);
        lines.push(`  después: ${a.content}`);
      }
      lines.push("");
    }
  }

  /* Nameservers externos */
  if (diffNS) {
    lines.push("Cambio en nameservers REALES del dominio (DoH)");
    lines.push("");

    lines.push("Anterior:");
    for (const x of diffNS.previous) lines.push(`- ${x}`);
    lines.push("");

    lines.push("Actual:");
    for (const x of diffNS.current) lines.push(`+ ${x}`);
    lines.push("");
  }

  lines.push("🚨 Monitor automático de Transistemas 🏳️‍⚧️");
  lines.push("https://github.com/Transistemas/dns-monitor");

  return lines.join("\n");
}

async function sendEmail(env, subject, body) {
  const apiKey = env.RESEND_API_KEY;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    throw new Error(`Error al enviar correo: ${res.status}`);
  }
}
