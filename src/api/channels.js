/* ===== API JSON de canales de alerta (requiere sesión) ===== */

import { jsonError, jsonOk } from "../auth.js";
import { encryptSecret } from "../crypto.js";
import { deleteChannel, listChannels, upsertChannel } from "../db.js";

const CHANNEL_TYPES = ["telegram", "discord", "webhook"];

function mask(channel) {
  return {
    type: channel.type,
    name: channel.name || "",
    enabled: !!channel.enabled,
    configured: true,
  };
}

async function validateAndMaybeTest(type, config, doTest) {
  if (type === "telegram") {
    const botToken = String(config.botToken || "").trim();
    const chatId = String(config.chatId || "").trim();
    if (!botToken || !chatId) {
      throw new Error("Faltan el bot token y el chat id.");
    }
    const me = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    if (!me.ok) {
      throw new Error("Bot token de Telegram inválido. Creá un bot con @BotFather.");
    }
    if (doTest) {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        body: new URLSearchParams({
          chat_id: chatId,
          text: "🔔 DNS Monitor: canal de Telegram configurado correctamente.",
        }),
      });
      if (!res.ok) {
        throw new Error("No se pudo enviar el mensaje de prueba. Verificá el chat id y mandale un mensaje al bot antes.");
      }
    }
    return { botToken, chatId };
  }

  if (type === "discord") {
    const url = String(config.url || "").trim();
    if (!/^https:\/\/discord\.com\/api\/webhooks\//.test(url)) {
      throw new Error("URL de webhook de Discord inválida (debe empezar con https://discord.com/api/webhooks/).");
    }
    const check = await fetch(url);
    if (!check.ok) {
      throw new Error("El webhook de Discord no existe (404) o no responde.");
    }
    if (doTest) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "🔔 DNS Monitor: canal de Discord configurado correctamente." }),
      });
      if (!res.ok) {
        throw new Error("El mensaje de prueba falló.");
      }
    }
    return { url };
  }

  if (type === "webhook") {
    const url = String(config.url || "").trim();
    if (!/^https:\/\//.test(url)) {
      throw new Error("La URL del webhook debe ser https.");
    }
    let signatureSecret = null;
    if (config.signatureSecret) {
      if (String(config.signatureSecret).length < 8) {
        throw new Error("El secret de firma debe tener al menos 8 caracteres.");
      }
      signatureSecret = config.signatureSecret;
    }
    if (doTest) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "dns_monitor.test", timestamp: new Date().toISOString() }),
      });
      if (!res.ok) {
        throw new Error(`El webhook respondió ${res.status}. Verificá que acepte POST.`);
      }
    }
    return { url, signatureSecret };
  }

  throw new Error("Tipo de canal inválido.");
}

export async function handleApiChannels(env, request, user) {
  if (request.method === "GET") {
    const channels = await listChannels(env, user.id);
    return jsonOk({ channels: channels.map(mask) });
  }

  const match = new URL(request.url).pathname.match(/^\/api\/channels\/(\w+)(?:\/test)?$/);
  const type = match?.[1];
  if (!type || !CHANNEL_TYPES.includes(type)) {
    return jsonError(400, "Tipo de canal inválido.");
  }

  if (request.method === "DELETE") {
    await deleteChannel(env, user.id, type);
    return jsonOk({ deleted: type });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Body JSON inválido.");
  }

  const doTest = request.url.endsWith("/test");
  try {
    const config = await validateAndMaybeTest(type, body, doTest);
    if (doTest) {
      return jsonOk({ tested: type });
    }
    const enc = await encryptSecret(env, JSON.stringify(config));
    await upsertChannel(env, {
      userId: user.id,
      type,
      name: String(body.name || "").trim() || null,
      configEnc: enc.enc,
      configIv: enc.iv,
      enabled: body.enabled !== false,
    });
    return jsonOk({
      channel: {
        type,
        name: String(body.name || "").trim() || "",
        enabled: body.enabled !== false,
        configured: true,
      },
    });
  } catch (err) {
    return jsonError(400, err.message);
  }
}