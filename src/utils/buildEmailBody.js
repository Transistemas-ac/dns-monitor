export function buildDnsSection(diffDNS) {
  const lines = [];

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
  }

  return { title: "Cambios en registros DNS internos (Cloudflare)", lines };
}

export function buildNsSection(diffNS) {
  const lines = [];

  lines.push("Anterior:");
  for (const x of diffNS.previous) lines.push(`- ${x}`);
  lines.push("");

  lines.push("Actual:");
  for (const x of diffNS.current) lines.push(`+ ${x}`);

  return { title: "Cambio en nameservers REALES del dominio (DoH)", lines };
}

export default function buildEmailBody(zoneName, sections) {
  const lines = [`Alertas para el dominio ${zoneName}`, ""];

  for (const section of sections) {
    lines.push(`● ${section.title}`);
    lines.push("");
    lines.push(...section.lines);
    lines.push("");
  }

  lines.push("🚨 Monitor DNS automático");

  return lines.join("\n");
}