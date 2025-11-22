export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCheck(env));
  },
};

async function runCheck(env) {
  const zoneId = env.CF_ZONE_ID;
  const apiToken = env.CF_API_TOKEN;
  const kvKey = `dns_state_${zoneId}`;

  const currentRecords = await fetchAllDnsRecords(zoneId, apiToken);
  const snapshot = normalizeRecords(currentRecords);

  const previousJson = await env.DNS_MONITOR.get(kvKey);
  if (!previousJson) {
    await env.DNS_MONITOR.put(kvKey, JSON.stringify(snapshot));
    return;
  }

  const previous = JSON.parse(previousJson);
  const diff = diffRecords(previous, snapshot);

  if (!diff.hasChanges) {
    return;
  }

  const subject = `Cambio en DNS de ${env.ZONE_NAME || "transistemas.org"}`;
  const body = buildEmailBody(diff, env);

  await sendEmail(env, subject, body);
  await env.DNS_MONITOR.put(kvKey, JSON.stringify(snapshot));
}

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
    if (!info || page >= info.total_pages) {
      break;
    }
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

function buildEmailBody(diff, env) {
  const zoneName = env.ZONE_NAME || "transistemas.org";
  let lines = [];

  lines.push(`Se detectaron cambios en los registros DNS de ${zoneName}.`);
  lines.push("");
  lines.push(`Nuevos registros: ${diff.created.length}`);
  lines.push(`Registros eliminados: ${diff.deleted.length}`);
  lines.push(`Registros modificados: ${diff.updated.length}`);
  lines.push("");

  if (diff.created.length > 0) {
    lines.push("Nuevos:");
    for (const r of diff.created.slice(0, 20)) {
      lines.push(
        `+ ${r.type} ${r.name} -> ${r.content} ttl=${r.ttl} proxied=${r.proxied}`
      );
    }
    if (diff.created.length > 20) {
      lines.push(`(+ ${diff.created.length - 20} más)`);
    }
    lines.push("");
  }

  if (diff.deleted.length > 0) {
    lines.push("Eliminados:");
    for (const r of diff.deleted.slice(0, 20)) {
      lines.push(
        `- ${r.type} ${r.name} -> ${r.content} ttl=${r.ttl} proxied=${r.proxied}`
      );
    }
    if (diff.deleted.length > 20) {
      lines.push(`(+ ${diff.deleted.length - 20} más)`);
    }
    lines.push("");
  }

  if (diff.updated.length > 0) {
    lines.push("Modificados:");
    for (const u of diff.updated.slice(0, 20)) {
      const b = u.before;
      const a = u.after;
      lines.push(`* ${a.type} ${a.name}`);
      lines.push(`  antes: ${b.content} ttl=${b.ttl} proxied=${b.proxied}`);
      lines.push(`  después: ${a.content} ttl=${a.ttl} proxied=${a.proxied}`);
    }
    if (diff.updated.length > 20) {
      lines.push(`(+ ${diff.updated.length - 20} más)`);
    }
    lines.push("");
  }

  lines.push(
    "Este mensaje fue generado automáticamente por el monitor de DNS."
  );

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
