/* ===== Dashboard /app (dominios + historial de alertas) ===== */

import { appShell, esc } from "./shell.js";

export function renderDashboardPage({ user }) {
  const content = `
    <header class="dash-head">
      <div>
        <h1 class="dash-title">Tu monitor 🛰️</h1>
        <p class="dash-sub">Estado de tus dominios e historial de alertas. El monitor corre cada 10 minutos.</p>
      </div>
      <button type="button" class="btn pink" id="btn-new">＋ Agregar dominio</button>
    </header>

    <div class="alert red" id="alert-err" hidden></div>
    <div class="alert green" id="alert-ok" hidden></div>

    <section class="domain-form-card" id="form-panel" hidden>
      <div class="head">
        <span class="emoji">🌍</span>
        <h3 id="form-title">Agregar dominio</h3>
      </div>
      <form id="domain-form" class="auth-form">
        <input type="hidden" name="id" />
        <div class="form-grid">
          <label class="field">
            <span>Dominio</span>
            <input type="text" name="zoneName" required placeholder="example.com" />
          </label>
          <label class="field">
            <span>Token de Cloudflare</span>
            <div class="pass-field">
              <input type="password" name="cfToken" id="cfToken" autocomplete="new-password" placeholder="Pegá tu token (solo lectura)" />
              <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
            </div>
          </label>
          <label class="field">
            <span>Días de alerta de vencimiento</span>
            <input type="text" name="expiryAlertDays" value="60,30,14,7,1" placeholder="60,30,14,7,1" />
          </label>
        </div>
        <div class="flag-grid" id="flag-grid">
          <label class="flag"><input type="checkbox" name="expectMX" checked disabled /> Verificar MX</label>
          <label class="flag"><input type="checkbox" name="expectSPF" checked disabled /> Verificar SPF</label>
          <label class="flag"><input type="checkbox" name="expectDMARC" checked disabled /> Verificar DMARC</label>
          <label class="flag"><input type="checkbox" name="expectDKIM" checked disabled /> Verificar DKIM</label>
          <label class="flag"><input type="checkbox" name="expectCAA" checked disabled /> Alertar sin CAA</label>
          <label class="flag"><input type="checkbox" name="expectWeb" checked disabled /> Web check (HTTPS)</label>
        </div>
        <p class="form-note">Todas las alertas están activas por defecto: MX, SPF, DMARC, DKIM, CAA y Web check.</p>
        <p class="form-note" id="secrets-note">🔐 El token se cifra con AES-256 y nunca se muestra de nuevo. Solo se usa para leer tus zonas.</p>
        <div class="form-actions">
          <button type="submit" class="btn pink" id="btn-save">Guardar dominio</button>
          <button type="button" class="btn outline" id="btn-cancel">Cancelar</button>
        </div>
      </form>
    </section>

    <section class="dash-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Tus dominios</h2>
      </div>
      <div class="features-grid" id="domains-grid">
        <p class="empty-state" id="empty-state">Todavía no agregaste dominios. Hacé clic en "Agregar dominio" para empezar. 🚀</p>
      </div>
    </section>

    <section class="dash-section" id="alerts-section" hidden>
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Historial de alertas</h2>
        <span class="badge pink" id="alerts-domain"></span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Fecha</th><th>Alerta</th></tr>
          </thead>
          <tbody id="alerts-body"></tbody>
        </table>
      </div>
      <div class="pager" id="alerts-pager"></div>
      <button type="button" class="btn outline" id="btn-close-alerts">Cerrar historial</button>
    </section>
  `;

  const script = `
    const grid = document.getElementById("domains-grid");
    const empty = document.getElementById("empty-state");
    const errBox = document.getElementById("alert-err");
    const formPanel = document.getElementById("form-panel");
    const form = document.getElementById("domain-form");
    const formTitle = document.getElementById("form-title");
    
    

    function esc(v) {
      return String(v ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
      );
    }
    function fmtTs(ts) {
      if (!ts) return "Aún sin verificar";
      const diff = Math.round((Date.now() - ts) / 60000);
      if (diff < 1) return "recién";
      if (diff < 60) return "hace " + diff + " min";
      const h = Math.floor(diff / 60);
      if (h < 24) return "hace " + h + " h";
      return new Date(ts).toLocaleDateString("es-AR");
    }
    function fmtDate(ts) {
      return new Date(ts).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    }
    function showErr(msg) {
      errBox.textContent = "⚠️ " + msg;
      errBox.hidden = false;
    }
    function clearErr() {
      errBox.hidden = true;
    }
    const okBox = document.getElementById("alert-ok");
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

    function statusBadge(d) {
      if (d.lastError) return '<span class="badge red">Error</span>';
      if (!d.lastCheckTs) return '<span class="badge yellow">Sin verificar</span>';
      return '<span class="badge green">OK — ' + esc(fmtTs(d.lastCheckTs)) + "</span>";
    }

    function renderDomain(d) {
      const flags = [];
      if (d.expectMX) flags.push("MX");
      if (d.expectSPF) flags.push("SPF");
      if (d.expectDMARC) flags.push("DMARC");
      if (d.expectDKIM) flags.push("DKIM");
      if (d.expectCAA) flags.push("CAA");
      if (d.expectWeb) flags.push("Web");
      const card = document.createElement("article");
      card.className = "feature-card pink domain-card";
      card.innerHTML =
        '<div class="head">' +
        '<button type="button" class="emoji-btn" data-emoji-open="' + d.id + '" title="Cambiar emoji">' + esc(d.emoji || "🌍") + "</button>" +
        "<h3>" + esc(d.zoneName) + "</h3></div>" +
        '<div class="body domain-body">' +
        '<div class="domain-row">' + statusBadge(d) + "</div>" +
        (d.lastError ? '<div class="domain-row domain-error">' + esc(d.lastError) + "</div>" : "") +
        '<div class="domain-row">🏷️ ' + esc(flags.join(", ") || "—") + "</div>" +
        '<div class="domain-actions">' +
        '<button type="button" class="btn blue btn-small" data-act="history" data-id="' + d.id + '">Historial</button>' +
        '<button type="button" class="btn outline btn-small" data-act="edit" data-id="' + d.id + '">Editar</button>' +
        '<button type="button" class="btn red btn-small" data-act="delete" data-id="' + d.id + '">Eliminar</button>' +
        "</div>" +
        "</div>";
      grid.appendChild(card);
    }

    const EMOJIS = ["🌍","🌐","🌏","🛰️","🚀","⭐","🌟","💫","⚡","🔥","💧","🌈","🦄","💜","💙","💚","💛","❤️","🧡","🖤","🤍","💎","🍀","🎯","🔔","📬","✉️","📧","🔑","🛡️","🧭","🧠","👀","🕵️","☁️","🌊"];

    function closeEmojiPicker() {
      const p = document.querySelector(".emoji-picker");
      if (p) p.remove();
    }

    function openEmojiPicker(btn, domainId) {
      closeEmojiPicker();
      const picker = document.createElement("div");
      picker.className = "emoji-picker";
      picker.innerHTML = EMOJIS.map((e) =>
        '<button type="button" class="emoji-option" data-emoji="' + e + '">' + e + "</button>"
      ).join("");
      const rect = btn.getBoundingClientRect();
      picker.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 320)) + "px";
      picker.style.top = rect.bottom + 8 + "px";
      document.body.appendChild(picker);

      picker.addEventListener("click", async (ev) => {
        const opt = ev.target.closest("[data-emoji]");
        if (!opt) return;
        const chosen = opt.dataset.emoji;
        const previous = btn.textContent;
        closeEmojiPicker();
        btn.textContent = chosen;
        try {
          await api("/api/domains/" + domainId, {
            method: "PUT",
            body: JSON.stringify({ emoji: chosen }),
          });
        } catch (err) {
          btn.textContent = previous;
          showErr(err.message);
        }
      });
    }

    async function loadDomains() {
      try {
        clearErr();
        const { domains } = await api("/api/domains");
        grid.querySelectorAll(".domain-card").forEach((n) => n.remove());
        empty.hidden = domains.length > 0;
        domains.forEach(renderDomain);
        
      } catch (err) {
        showErr(err.message);
      }
    }

    function resetFields() {
      form.reset();
      form.elements.id.value = "";
      form.elements.cfToken.required = true;
      form.elements.zoneId.disabled = false;
      form.elements.zoneName.disabled = false;
      document.getElementById("secrets-note").textContent =
        "🔐 El token se cifra con AES-256 y nunca se muestra de nuevo. Solo se usa para leer tus zonas.";
      formTitle.textContent = "Agregar dominio";
      document.getElementById("btn-save").textContent = "Guardar dominio";
    }

    function resetForm() {
      resetFields();
      formPanel.hidden = true;
    }

    function openForm(domain) {
      clearErr();
      formPanel.hidden = false;
      if (!domain) {
        resetFields();
        return;
      }
      form.elements.id.value = domain.id;
      form.elements.zoneId.value = domain.zoneId;
      form.elements.zoneName.value = domain.zoneName;
      form.elements.expiryAlertDays.value = (domain.expiryAlertDays || []).join(",");
      form.elements.expectMX.checked = domain.expectMX;
      form.elements.expectSPF.checked = domain.expectSPF;
      form.elements.expectDMARC.checked = domain.expectDMARC;
      form.elements.expectDKIM.checked = domain.expectDKIM;
      form.elements.expectCAA.checked = domain.expectCAA;
      form.elements.expectWeb.checked = domain.expectWeb;
      form.elements.cfToken.required = false;
      form.elements.zoneId.disabled = true;
      form.elements.zoneName.disabled = true;
      document.getElementById("secrets-note").textContent =
        "🔐 Dejá el campo de token vacío para mantener el actual. Completalo solo para rotarlo.";
      formTitle.textContent = "Editar " + domain.zoneName;
      document.getElementById("btn-save").textContent = "Guardar cambios";
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const id = form.elements.id.value;
      const payload = {
        zoneId: form.elements.zoneId.value,
        zoneName: form.elements.zoneName.value,
        cfToken: form.elements.cfToken.value || undefined,
        expiryAlertDays: String(form.elements.expiryAlertDays.value || "60,30,14,7,1")
          .split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)),
        expectMX: form.elements.expectMX.checked,
        expectSPF: form.elements.expectSPF.checked,
        expectDMARC: form.elements.expectDMARC.checked,
        expectDKIM: form.elements.expectDKIM.checked,
        expectCAA: form.elements.expectCAA.checked,
        expectWeb: form.elements.expectWeb.checked,
      };
      try {
        const path = id ? "/api/domains/" + id : "/api/domains";
        const method = id ? "PUT" : "POST";
        await api(path, { method, body: JSON.stringify(payload) });
        resetForm();
        await loadDomains();
      } catch (err) {
        showErr(err.message);
      }
    });

    grid.addEventListener("click", async (ev) => {
      const emojiBtn = ev.target.closest("button[data-emoji-open]");
      if (emojiBtn) {
        ev.stopPropagation();
        openEmojiPicker(emojiBtn, emojiBtn.dataset.emojiOpen);
        return;
      }
      const btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      try {
        if (btn.dataset.act === "edit") {
          const { domains } = await api("/api/domains");
          openForm(domains.find((d) => String(d.id) === String(id)));
        } else if (btn.dataset.act === "delete") {
          const { domains } = await api("/api/domains");
          const d = domains.find((x) => String(x.id) === String(id));
          if (d && confirm("¿Eliminar " + d.zoneName + "? Se borran sus snapshots y su historial.")) {
            await api("/api/domains/" + id, { method: "DELETE" });
            await loadDomains();
          }
        } else if (btn.dataset.act === "history") {
          await openAlerts(id);
        }
      } catch (err) {
        showErr(err.message);
      }
    });

    let currentAlertsDomain = null;
    let currentAlertsPage = 1;

    async function openAlerts(domainId) {
      currentAlertsDomain = domainId;
      currentAlertsPage = 1;
      await loadAlertsPage();
      document.getElementById("alerts-section").hidden = false;
      document.getElementById("alerts-section").scrollIntoView({ behavior: "smooth" });
    }

    async function loadAlertsPage() {
      const body = document.getElementById("alerts-body");
      const pager = document.getElementById("alerts-pager");
      try {
        const data = await api("/api/domains/" + currentAlertsDomain + "/alerts?page=" + currentAlertsPage + "&per_page=20");
        document.getElementById("alerts-domain").textContent = data.domain.zoneName;
        body.innerHTML = "";
        if (data.alerts.length === 0) {
          body.innerHTML = '<tr><td colspan="2" class="empty-row">Sin alertas todavía 🎉</td></tr>';
        } else {
          data.alerts.forEach((a) => {
            const tr = document.createElement("tr");
            tr.innerHTML = "<td>" + esc(fmtDate(a.createdAt)) + "</td><td>" + esc(a.subject) + "</td>";
            body.appendChild(tr);
          });
        }
        const totalPages = Math.max(1, Math.ceil(data.total / data.perPage));
        pager.innerHTML =
          '<button type="button" class="btn outline btn-small" ' + (currentAlertsPage <= 1 ? "disabled" : "") + ' data-page="' + (currentAlertsPage - 1) + '">← Anterior</button>' +
          '<span class="pager-info">Página ' + currentAlertsPage + " de " + totalPages + " · " + data.total + " alertas</span>" +
          '<button type="button" class="btn outline btn-small" ' + (currentAlertsPage >= totalPages ? "disabled" : "") + ' data-page="' + (currentAlertsPage + 1) + '">Siguiente →</button>';
      } catch (err) {
        showErr(err.message);
      }
    }

    document.getElementById("alerts-pager").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      currentAlertsPage = parseInt(btn.dataset.page, 10);
      loadAlertsPage();
    });

    document.getElementById("btn-close-alerts").addEventListener("click", () => {
      document.getElementById("alerts-section").hidden = true;
    });

    document.getElementById("btn-new").addEventListener("click", () => openForm(null));
    document.getElementById("btn-cancel").addEventListener("click", resetForm);

    document.addEventListener("click", (ev) => {
      if (!ev.target.closest(".emoji-picker") && !ev.target.closest("[data-emoji-open]")) {
        closeEmojiPicker();
      }
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeEmojiPicker();
    });

    loadDomains();
  `;

  return appShell({
    user,
    active: "dashboard",
    title: "Dashboard — DNS Monitor",
    content,
    script,
  });
}