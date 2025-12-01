export default function buildEmailBody(diffDNS, diffNS, env) {
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
  lines.push("https://github.com/Transistemas-ac/dns-monitor");

  return lines.join("\n");
}
