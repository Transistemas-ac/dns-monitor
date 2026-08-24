/* ===== Dispatcher de alertas a canales (telegram / discord / webhook) ===== */

import { decryptSecret } from "../crypto.js";

const TG_MAX = 4096;
const DC_MAX = 2000;

function buildChannelText(data) {
  const parts = [`${data.subject}`, `Dominio: ${data.domain}`];
  for (const s of data.sections || []) {
    parts.push(`\n▸ ${s.title}`);
    for (const line of s.lines || []) parts.push(`  ${line}`);
  }
  return parts.join("\n");
}

function splitText(text, max) {
  if (text.length <= max) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += max) chunks.push(text.slice(i, i + max));
  return chunks;
}

async function sendTelegram(config, data) {
  const { botToken, chatId } = config;
  const base = `https://api.telegram.org/bot${botToken}`;
  const text = buildChannelText(data);
  for (const chunk of splitText(text, TG_MAX)) {
    const res = await fetch(`${base}/sendMessage`, {
      method: "POST",
      body: new URLSearchParams({ chat_id: String(chatId), text: chunk }),
    });
    if (!res.ok) {
      const err = (await res.text()).slice(0, 200);
      throw new Error(`Telegram ${res.status}: ${err}`);
    }
  }
}

async function sendDiscord(config, data) {
  const text = buildChannelText(data);
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text.slice(0, DC_MAX) }),
  });
  if (!res.ok) {
    throw new Error(`Discord ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function sendWebhook(config, data) {
  const payload = JSON.stringify({
    event: "dns_monitor.alert",
    subject: data.subject,
    domain: data.domain,
    sections: data.sections,
    timestamp: new Date().toISOString(),
  });
  const headers = { "Content-Type": "application/json", "User-Agent": "dns-monitor/1.0" };
  if (config.signatureSecret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(config.signatureSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    headers["X-DNS-Monitor-Signature"] =
      "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const res = await fetch(config.url, { method: "POST", headers, body: payload });
  if (!res.ok) {
    throw new Error(`Webhook ${res.status}`);
  }
}

/* data = { subject, domain, sections: [{title, lines}] } */
export default async function sendToChannels(env, channelRow, data) {
  let config;
  try {
    config = JSON.parse(await decryptSecret(env, channelRow.config_enc, channelRow.config_iv));
  } catch (err) {
    console.error(`Canal ${channelRow.type} con configuración inválida:`, err.message);
    return;
  }

  try {
    if (channelRow.type === "telegram") await sendTelegram(config, data);
    else if (channelRow.type === "discord") await sendDiscord(config, data);
    else if (channelRow.type === "webhook") await sendWebhook(config, data);
  } catch (err) {
    console.error(`Error enviando alerta por ${channelRow.type}:`, err.message);
  }
}