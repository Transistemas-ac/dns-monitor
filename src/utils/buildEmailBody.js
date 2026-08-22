const ACCENTS = {
  pink: "#fe98cc",
  blue: "#54b4f0",
  yellow: "#fecc01",
  purple: "#8e53bc",
  green: "#31d05b",
  red: "#ef4444",
};

const SECTION_EMOJI = {
  pink: "🔍",
  blue: "📡",
  yellow: "⚠️",
  purple: "🌐",
  green: "✅",
  red: "🚨",
};

const ROBOT_CRUSH_B64 = "AAEAAAASAQAABAAgRFNJRwAAAAEAACqAAAAACEdERUYAAQAAAAAqiAAAAAxHUE9TABkADAAAKpQAAAASR1NVQmyRdI8AACqoAAAAIE9TLzJCI4nZAAABqAAAAGBjbWFwELUvuwAAA5wAAAI+Y3Z0ICWiCgQAABOEAAAAPGZwZ212ZH12AAAF3AAADRZnYXNwAAAAEAAAKngAAAAIZ2x5ZmmPUh0AABSMAAASoGhlYWQR5ZJuAAABLAAAADZoaGVhDU8F3gAAAWQAAAAkaG10eIXoAAAAAAIIAAABlGxvY2HggOVCAAATwAAAAMxtYXhwAXwAWgAAAYgAAAAgbmFtZfQc9p4AACcsAAACWHBvc3R8yoC/AAAphAAAAPFwcmVwGVACEAAAEvQAAACNAAEAAAABAAA8whfGXw889QALCAAAAAAA1kOgYwAAAADWQ6f8AAD+1AZABkAAAAAGAAEAAAAAAAAAAQAABkD+1ADNBqQAAAAABkAAAQAAAAAAAAAAAAAAAAAAAGUAAQAAAGUAIAADAAgAAgACAB4ALwCLAAAAZgAAAAIAAQADA+YBkAAFAAAFmgUzAAABMwWaBTMAAAOaAGYCEgAAAgAFAAAAAAAAAAAAAIMAAAACAAAAAAAAAABITCAgAEAAACCsBRQAAADNBkABLAAAAAEAAAAABdwFeAAAACAAAAXcAAAAAAAAAfwAAAH8AAAB9AAAA+gAAAUUAAAETAAABLAAAASwAAAB9AAAAlgAAAJYAAADIAAAA4QAAAH0AAADIAAAAfQAAASwAAAETAAAAfQAAARMAAAETAAABEwAAARMAAAETAAABEwAAARMAAAETAAAAfQAAAGQAAACWAAAAyAAAAJYAAAETAAABEwAAARMAAAETAAABEwAAARMAAAETAAABEwAAARMAAAETAAAAfQAAARMAAAETAAABEwAAAakAAAETAAABEwAAARMAAAETAAABEwAAARMAAAETAAABEwAAARMAAAGpAAABEwAAARMAAAETAAAAlgAAASwAAACWAAAAfQAAARMAAAB9AAABEwAAARMAAAETAAABEwAAARMAAAETAAABEwAAARMAAAB9AAABEwAAARMAAAETAAABqQAAARMAAAETAAABEwAAARMAAAETAAABEwAAARMAAAETAAABEwAAAakAAAETAAABEwAAARMAAACvAAA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LLAAFrAQI0IgsAhDIC5HI0cjYSBgsCBgZrACYiCwAFBYsEBgWWawAWMjICA8ijgtsD4sIyAuRrACJUawEENYUBtSWVggPFkusS4BFCstsD8sIyAuRrACJUawEENYUhtQWVggPFkusS4BFCstsEAsIyAuRrACJUawEENYUBtSWVggPFkjIC5GsAIlRrAQQ1hSG1BZWCA8WS6xLgEUKy2wQSywOCsjIC5GsAIlRrAQQ1hQG1JZWCA8WS6xLgEUKy2wQiywOSuKICA8sAQjQoo4IyAuRrACJUawEENYUBtSWVggPFkusS4BFCuwBEMusC4rLbBDLLAAFrAEJbAEJiAuRyNHI2GwCUMrIyA8IC4jOLEuARQrLbBELLEIBCVCsAAWsAQlsAQlIC5HI0cjYSCwBCNCsAlDKyCwYFBYILBAUVizAiADIBuzAiYDGllCQiMgR7AEQ7ACYiCwAFBYsEBgWWawAWNgILABKyCKimEgsAJDYGQjsANDYWRQWLACQ2EbsANDYFmwAyWwAmIgsABQWLBAYFlmsAFjYbACJUZhOCMgPCM4GyEgIEYjR7ABKyNhOCFZsS4BFCstsEUssQA4Ky6xLgEUKy2wRiyxADkrISMgIDywBCNCIzixLgEUK7AEQy6wListsEcssAAVIEewACNCsgABARUUEy6wNCotsEgssAAVIEewACNCsgABARUUEy6wNCotsEkssQABFBOwNSotsEossDcqLbBLLLAAFkUjIC4gRoojYTixLgEUKy2wTCywCCNCsEsrLbBNLLIAAEQrLbBOLLIAAUQrLbBPLLIBAEQrLbBQLLIBAUQrLbBRLLIAAEUrLbBSLLIAAUUrLbBTLLIBAEUrLbBULLIBAUUrLbBVLLMAAABBKy2wViyzAAEAQSstsFcsswEAAEErLbBYLLMBAQBBKy2wWSyzAAABQSstsFosswABAUErLbBbLLMBAAFBKy2wXCyzAQEBQSstsF0ssgAAQystsF4ssgABQystsF8ssgEAQystsGAssgEBQystsGEssgAARistsGIssgABRistsGMssgEARistsGQssgEBRistsGUsswAAAEIrLbBmLLMAAQBCKy2wZyyzAQAAQistsGgsswEBAEIrLbBpLLMAAAFCKy2waiyzAAEBQistsGssswEAAUIrLbBsLLMBAQFCKy2wbSyxADorLrEu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";

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function sectionAccent(section) {
  const t = section.title.toLowerCase();
  const text = (section.lines || []).join(" ").toLowerCase();
  if (
    t.includes("error") ||
    text.includes("❌") ||
    text.includes("crítico") ||
    text.includes("dejó de responder") ||
    text.includes("mismatch")
  ) {
    return "red";
  }
  if (
    t.includes("recuperado") ||
    text.includes("✅") ||
    text.includes("renovado") ||
    text.includes("volvió") ||
    text.includes("consistentes") ||
    text.includes("resuelto")
  ) {
    return "green";
  }
  if (
    text.includes("⚠️") ||
    t.includes("heartbeat") ||
    t.includes("caa") ||
    text.includes("expira")
  ) {
    return "yellow";
  }
  if (t.includes("nameserver") || t.includes("consistencia")) return "purple";
  if (t.includes("quién")) return "pink";
  return "blue";
}

const MONO_FONT = "ui-monospace, Menlo, Consolas, 'Courier New', monospace";

function renderLine(line) {
  const raw = line.trim();

  if (raw === "") return '<div style="height:8px;font-size:0;line-height:0;">&nbsp;</div>';

  if (/^\+ \[(ERROR|WARN|INFO)\]/.test(raw)) {
    const m = raw.match(/^\+ \[(ERROR|WARN|INFO)\]/);
    const level = m[1].toUpperCase();
    const rest = raw.slice(m[0].length).trim();
    const badge = {
      ERROR: { bg: "#ef4444", fg: "#ffffff" },
      WARN: { bg: "#fecc01", fg: "#1b1b1a" },
      INFO: { bg: "#54b4f0", fg: "#1b1b1a" },
    }[level];
    const idx = rest.indexOf(":");
    let label = "";
    let detail = rest;
    if (idx > 0) {
      label = `<strong style="color:#fefffe;">${escapeHtml(rest.slice(0, idx))}</strong> `;
      detail = rest.slice(idx + 1).trim();
    }
    return (
      `<div style="margin:0 0 8px;"><span style="display:inline-block;background-color:${badge.bg};color:${badge.fg};font-size:11px;font-weight:800;letter-spacing:1px;padding:2px 8px;border-radius:10px;margin-right:8px;">${level}</span>` +
      `${label}<span style="color:#b8b8b7;">${escapeHtml(detail)}</span></div>`
    );
  }

  if (raw.startsWith("+ ")) {
    return `<div style="margin:0 0 8px;color:#31d05b;font-family:${MONO_FONT};font-size:13px;">${escapeHtml(raw)}</div>`;
  }
  if (raw.startsWith("- ")) {
    return `<div style="margin:0 0 8px;color:#ef4444;font-family:${MONO_FONT};font-size:13px;">${escapeHtml(raw)}</div>`;
  }
  if (raw.startsWith("* ")) {
    return `<div style="margin:0 0 8px;color:#fecc01;font-weight:600;font-family:${MONO_FONT};font-size:13px;">${escapeHtml(raw)}</div>`;
  }
  if (raw.startsWith("antes:")) {
    return `<div style="margin:0 0 8px;padding-left:16px;color:#8a8a89;"><span style="color:#fe98cc;font-weight:700;">antes:</span> ${escapeHtml(raw.slice(6).trim())}</div>`;
  }
  if (raw.startsWith("después:")) {
    return `<div style="margin:0 0 8px;padding-left:16px;color:#8a8a89;"><span style="color:#54b4f0;font-weight:700;">después:</span> ${escapeHtml(raw.slice(8).trim())}</div>`;
  }
  if (/^✓\s*Resuelto/.test(raw)) {
    return `<div style="margin:0 0 8px;color:#31d05b;font-weight:600;">${escapeHtml(raw)}</div>`;
  }
  if (raw.startsWith("Anterior:")) {
    return `<div style="margin:10px 0 4px;color:#fe98cc;font-weight:700;">Anterior</div>`;
  }
  if (raw.startsWith("Actual:")) {
    return `<div style="margin:10px 0 4px;color:#54b4f0;font-weight:700;">Actual</div>`;
  }
  if (raw.endsWith(":")) {
    return `<div style="margin:10px 0 4px;color:#b8b8b7;font-weight:700;">${escapeHtml(raw.slice(0, -1))}</div>`;
  }
  return `<div style="margin:0 0 8px;color:#fefffe;">${escapeHtml(raw)}</div>`;
}

function renderSection(section) {
  const accent = sectionAccent(section);
  const hex = ACCENTS[accent];
  const emoji = SECTION_EMOJI[accent];
  const linesHtml = (section.lines || []).map(renderLine).join("");
  return (
    `<tr><td style="background-color:#2a2a29;border:2px solid ${rgba(hex, 0.4)};border-left:6px solid ${hex};border-radius:20px;padding:22px 26px;">` +
    `<div style="font-size:16px;font-weight:700;color:${hex};line-height:1.4;">${emoji} ${escapeHtml(section.title)}</div>` +
    `<div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>` +
    `<div style="font-size:14px;line-height:1.65;">${linesHtml}</div>` +
    `</td></tr>` +
    `<tr><td style="height:20px;font-size:0;line-height:0;">&nbsp;</td></tr>`
  );
}

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

export function buildEmailText(zoneName, sections) {
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

export default function buildEmailBody(zoneName, sections) {
  const sectionsHtml = sections.map(renderSection).join("");
  const stamp = new Date().toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const isGlobal = zoneName === "Monitor global";
  const alertTitle = isGlobal ? "Monitor global" : "Alertas para el dominio";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(alertTitle)} ${escapeHtml(zoneName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @font-face {
    font-family: "Robot Crush";
    src: url(data:font/truetype;base64,${ROBOT_CRUSH_B64}) format("truetype");
    font-display: swap;
  }
  body { font-family: "Work Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#1b1b1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1b1b1a;">
<tr>
<td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">

<tr>
<td align="center" style="padding:8px 0 28px;">
  <div style="font-family:'Robot Crush','Work Sans',sans-serif;font-size:30px;letter-spacing:4px;color:#fe98cc;line-height:1.2;">DNS MONITOR</div>
  <div style="font-size:12px;color:#8a8a89;letter-spacing:2px;margin-top:8px;">ALERTA AUTOMÁTICA DE DNS</div>
</td>
</tr>

<tr>
<td style="background-color:#2a2a29;border:2px solid #3a3a39;border-radius:20px;padding:28px 32px;text-align:center;">
  <div style="font-size:36px;line-height:1;">🚨</div>
  <div style="margin:14px 0 0;font-size:21px;font-weight:800;color:#fefffe;line-height:1.3;">${escapeHtml(alertTitle)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:16px auto 0;">
    <tr>
      <td style="background-color:#1b1b1a;border:2px solid #54b4f0;border-radius:15px;padding:8px 24px;font-size:17px;font-weight:800;color:#54b4f0;letter-spacing:1px;">${escapeHtml(zoneName)}</td>
    </tr>
  </table>
  <div style="margin-top:14px;font-size:13px;color:#8a8a89;">${sections.length} alerta${sections.length === 1 ? "" : "s"} detectada${sections.length === 1 ? "" : "s"}</div>
</td>
</tr>

<tr><td style="height:24px;font-size:0;line-height:0;">&nbsp;</td></tr>

${sectionsHtml}

<tr>
<td style="text-align:center;border-top:2px solid #3a3a39;padding:22px 0 6px;">
  <div style="font-family:'Robot Crush','Work Sans',sans-serif;color:#fe98cc;font-size:15px;letter-spacing:2px;">🚨 MONITOR DNS AUTOMÁTICO</div>
  <div style="color:#8a8a89;font-size:12px;margin-top:8px;">Enviado automáticamente · ${escapeHtml(stamp)}</div>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>`;
}