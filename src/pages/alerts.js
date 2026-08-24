/* ===== /app/alertas (configuración de canales de alerta) ===== */

import { appShell, esc } from "./shell.js";

export function renderAlertsPage({ user }) {
  const content = `
    <header class="dash-head">
      <div>
        <h1 class="dash-title">Alertas 🔔</h1>
        <p class="dash-sub">Configurá cómo recibís las alertas. Se aplican a todos tus dominios.</p>
      </div>
      <a class="btn outline" href="/app">← Volver al dashboard</a>
    </header>

    <div class="alert red" id="alert-err" hidden></div>
    <div class="alert green" id="alert-ok" hidden></div>

    <section class="dash-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Canales</h2>
        <span class="badge green" id="alerts-saved" hidden>Guardado ✓</span>
      </div>
      <div class="features-grid">
        <article class="feature-card green channel-card">
          <div class="head">
            <span class="emoji">📧</span>
            <h3>Email</h3>
            <span class="badge green">Activo</span>
          </div>
          <div class="body">
            <label class="field">
              <span>Email donde querés recibir las alertas</span>
              <input type="email" id="alert-email" value="${esc(user.alertEmail || user.email)}" placeholder="vos@tudominio.com" />
            </label>
            <p class="form-note">Todas las alertas de tus dominios llegan acá, enviadas desde dns@transistemas.org.</p>
            <div class="form-actions">
              <button type="button" class="btn green btn-small" id="btn-save-alerts">Guardar</button>
              <button type="button" class="btn blue btn-small" id="btn-test-alerts">Probar</button>
            </div>
          </div>
        </article>
        <article class="feature-card pink channel-card">
          <div class="head">
            <span class="emoji">✈️</span>
            <h3>Telegram</h3>
            <span class="badge yellow" id="ch-badge-telegram">No configurado</span>
          </div>
          <div class="body">
            <label class="field">
              <span>Bot token <a class="link" href="https://t.me/BotFather" target="_blank" rel="noopener">(@BotFather)</a></span>
              <div class="pass-field">
                <input type="text" id="ch-telegram-token" autocomplete="off" placeholder="123456:ABC-DEF..." />
                <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
              </div>
            </label>
            <label class="field">
              <span>Chat ID</span>
              <input type="text" id="ch-telegram-chat" autocomplete="off" placeholder="Mandale un mensaje al bot y fijate el id" />
            </label>
            <p class="form-note">Todas tus alertas llegan acá. El bot tiene que recibir tu primer mensaje.</p>
            <div class="form-actions">
              <button type="button" class="btn green btn-small" data-channel-save="telegram">Guardar</button>
              <button type="button" class="btn blue btn-small" data-channel-test="telegram">Probar</button>
              <button type="button" class="btn red btn-small" data-channel-del="telegram" hidden>Eliminar</button>
            </div>
          </div>
        </article>
        <article class="feature-card blue channel-card">
          <div class="head">
            <span class="emoji">🎮</span>
            <h3>Discord</h3>
            <span class="badge yellow" id="ch-badge-discord">No configurado</span>
          </div>
          <div class="body">
            <label class="field">
              <span>Webhook URL</span>
              <div class="pass-field">
                <input type="text" id="ch-discord-url" autocomplete="off" placeholder="https://discord.com/api/webhooks/..." />
                <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
              </div>
            </label>
            <p class="form-note">Canal → Integraciones → Webhooks → Nuevo webhook.</p>
            <div class="form-actions">
              <button type="button" class="btn green btn-small" data-channel-save="discord">Guardar</button>
              <button type="button" class="btn blue btn-small" data-channel-test="discord">Probar</button>
              <button type="button" class="btn red btn-small" data-channel-del="discord" hidden>Eliminar</button>
            </div>
          </div>
        </article>
        <article class="feature-card purple channel-card">
          <div class="head">
            <span class="emoji">🪝</span>
            <h3>Webhook</h3>
            <span class="badge yellow" id="ch-badge-webhook">No configurado</span>
          </div>
          <div class="body">
            <label class="field">
              <span>URL del webhook (https)</span>
              <div class="pass-field">
                <input type="text" id="ch-webhook-url" autocomplete="off" placeholder="https://tu-servidor/recibir-alertas" />
                <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
              </div>
            </label>
            <label class="field">
              <span>Secret de firma (opcional, mínimo 8 caracteres)</span>
              <div class="pass-field">
                <input type="text" id="ch-webhook-secret" autocomplete="off" placeholder="Para verificar la firma X-DNS-Monitor-Signature" />
                <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
              </div>
            </label>
            <p class="form-note">Recibe un POST JSON con <code>event</code>, <code>subject</code>, <code>domain</code> y <code>sections</code>.</p>
            <div class="form-actions">
              <button type="button" class="btn green btn-small" data-channel-save="webhook">Guardar</button>
              <button type="button" class="btn blue btn-small" data-channel-test="webhook">Probar</button>
              <button type="button" class="btn red btn-small" data-channel-del="webhook" hidden>Eliminar</button>
            </div>
          </div>
        </article>
      </div>
    </section>
  `;

  const script = `
    const errBox = document.getElementById("alert-err");
    const okBox = document.getElementById("alert-ok");

    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
      );
    }
    function showErr(msg) {
      errBox.textContent = "⚠️ " + msg;
      errBox.hidden = false;
    }
    function showOk(msg) {
      okBox.textContent = "✅ " + msg;
      okBox.hidden = false;
      setTimeout(() => { okBox.hidden = true; }, 4000);
    }

    async function api(path, opts) {
      const res = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...opts,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || ("HTTP " + res.status));
      return data;
    }

    const alertEmailInput = document.getElementById("alert-email");
    const btnSaveAlerts = document.getElementById("btn-save-alerts");
    const alertsSaved = document.getElementById("alerts-saved");

    btnSaveAlerts.addEventListener("click", async () => {
      try {
        await api("/api/settings", {
          method: "PUT",
          body: JSON.stringify({ alertEmail: alertEmailInput.value }),
        });
        alertsSaved.hidden = false;
        setTimeout(() => { alertsSaved.hidden = true; }, 2500);
      } catch (err) {
        showErr(err.message);
      }
    });

    document.getElementById("btn-test-alerts").addEventListener("click", async () => {
      try {
        await api("/api/settings/test", {
          method: "POST",
          body: JSON.stringify({ alertEmail: alertEmailInput.value }),
        });
        showOk("Email de prueba enviado ✓");
      } catch (err) {
        showErr(err.message);
      }
    });

    const CHANNEL_FIELDS = {
      telegram: () => ({
        botToken: document.getElementById("ch-telegram-token").value,
        chatId: document.getElementById("ch-telegram-chat").value,
      }),
      discord: () => ({ url: document.getElementById("ch-discord-url").value }),
      webhook: () => ({
        url: document.getElementById("ch-webhook-url").value,
        signatureSecret: document.getElementById("ch-webhook-secret").value || undefined,
      }),
    };

    function setChannelStatus(type, configured) {
      const badge = document.getElementById("ch-badge-" + type);
      const del = document.querySelector('[data-channel-del="' + type + '"]');
      badge.textContent = configured ? "Configurado ✓" : "No configurado";
      badge.className = "badge " + (configured ? "green" : "yellow");
      del.hidden = !configured;
    }

    async function loadChannels() {
      try {
        const { channels } = await api("/api/channels");
        channels.forEach((c) => setChannelStatus(c.type, c.configured));
      } catch (err) {
        showErr(err.message);
      }
    }

    document.querySelectorAll("[data-channel-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.channelSave;
        try {
          await api("/api/channels/" + type, {
            method: "PUT",
            body: JSON.stringify(CHANNEL_FIELDS[type]()),
          });
          setChannelStatus(type, true);
        } catch (err) {
          showErr(err.message);
        }
      });
    });

    document.querySelectorAll("[data-channel-test]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.channelTest;
        try {
          await api("/api/channels/" + type + "/test", {
            method: "POST",
            body: JSON.stringify(CHANNEL_FIELDS[type]()),
          });
          showOk("Mensaje de prueba enviado por " + type + " ✓");
        } catch (err) {
          showErr(err.message);
        }
      });
    });

    document.querySelectorAll("[data-channel-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.channelDel;
        if (!confirm("¿Eliminar el canal de " + type + "?")) return;
        try {
          await api("/api/channels/" + type, { method: "DELETE" });
          setChannelStatus(type, false);
        } catch (err) {
          showErr(err.message);
        }
      });
    });

    loadChannels();
  `;

  return appShell({
    user,
    active: "alertas",
    title: "Alertas — DNS Monitor",
    content,
    script,
  });
}