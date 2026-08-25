/* ===== Dashboard /app (dominios + historial de alertas) ===== */

import { appShell, esc } from "./shell.js";

export function renderDashboardPage({ user }) {
  const content = `
    <div class="dash-top">
    <header class="dash-head">
      <div>
        <h1 class="dash-title">Tu monitor 🛰️</h1>
        <p class="dash-sub">Estado de tus dominios e historial de alertas. El monitor corre cada 10 minutos.</p>
      </div>
    </header>

    <div class="alert red" id="alert-err" hidden></div>
    <div class="alert green" id="alert-ok" hidden></div>

    <section class="domain-form-inline">
      <form id="domain-form" class="auth-form inline-form">
        <input type="hidden" name="id" value="" />
        <div class="inline-inputs">
          <label class="field">
            <span>Dominio</span>
            <input type="text" name="zoneName" required placeholder="example.com" />
          </label>
        </div>
        <button type="submit" class="btn pink">Agregar</button>
      </form>
    </section>
    </div>

    <section class="dash-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Tus dominios</h2>
      </div>
      <div class="features-grid" id="domains-grid">
        <p class="empty-state" id="empty-state">Todavía no agregaste dominios. Agregá uno arriba. 🚀</p>
      </div>
    </section>

    <section class="dash-section" id="alerts-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Historial de alertas</h2>
      </div>
      <div class="filter-badges" id="alert-filters"></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr><th>Fecha</th><th>Dominio</th><th>Alerta</th></tr>
          </thead>
          <tbody id="alerts-body"></tbody>
        </table>
      </div>
      <div class="pager" id="alerts-pager"></div>
    </section>

    <div class="modal-overlay" id="token-modal" hidden>
      <div class="modal">
        <div class="modal-head">
          <span class="modal-emoji">🔑</span>
          <h2>Token de Cloudflare requerido</h2>
        </div>
        <p>Para agregar un dominio necesitás configurar tu token de Cloudflare. El token se usa para verificar que tenés acceso a la zona.</p>
        <div class="modal-actions">
          <button type="button" class="btn outline" id="modal-cancel">Cancelar</button>
          <a href="/app/token" class="btn pink">Configurar token →</a>
        </div>
      </div>
    </div>
  `;

  const script = `
    const grid = document.getElementById("domains-grid");
    const empty = document.getElementById("empty-state");
    const errBox = document.getElementById("alert-err");
    const form = document.getElementById("domain-form");
    const tokenModal = document.getElementById("token-modal");
    const modalCancel = document.getElementById("modal-cancel");
    let hasCfToken = ${user.cf_token_enc ? "true" : "false"};

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
      const s = d.summary || {};
      const card = document.createElement("article");
      card.className = "feature-card pink domain-card";

      /* --- Health Score --- */
      let score = 100;
      let scoreIssues = [];
      if (s.expiry && s.expiry.daysLeft !== null) {
        if (s.expiry.daysLeft <= 0) { score -= 50; scoreIssues.push("Expirado"); }
        else if (s.expiry.daysLeft <= 7) { score -= 30; scoreIssues.push("Expira pronto"); }
        else if (s.expiry.daysLeft <= 30) { score -= 15; }
        else if (s.expiry.daysLeft <= 60) { score -= 5; }
      }
      if (s.dnssec && !s.dnssec.active) { score -= 10; scoreIssues.push("Sin DNSSEC"); }
      if (s.spf && !s.spf.ok) { score -= 10; scoreIssues.push("SPF"); }
      if (s.dmarc && !s.dmarc.ok) { score -= 10; scoreIssues.push("DMARC"); }
      if (s.dmarc && s.dmarc.policy === "none") { score -= 5; }
      if (s.web && !s.web.ok) { score -= 15; scoreIssues.push("Web caída"); }
      if (s.nsConsistent === false) { score -= 5; scoreIssues.push("NS inconsistente"); }
      if (d.lastError) { score -= 20; scoreIssues.push("Error"); }
      score = Math.max(0, score);

      var scoreColor = score >= 80 ? "var(--success)" : score >= 50 ? "var(--yellow)" : "var(--danger)";

      /* --- Header --- */
      var html = '<div class="head">';
      html += '<button type="button" class="emoji-btn" data-emoji-open="' + d.id + '" title="Cambiar emoji">' + esc(d.emoji || "🌍") + "</button>";
      html += "<h3>" + esc(d.zoneName) + "</h3>";
      html += '<div class="domain-head-right">';
      html += statusBadge(d);
      if (s.expiry && s.expiry.daysLeft !== null) {
        var expColor = s.expiry.daysLeft <= 7 ? "red" : s.expiry.daysLeft <= 30 ? "yellow" : "green";
        html += '<span class="badge ' + expColor + '">⏱ ' + s.expiry.daysLeft + "d</span>";
      }
      if (s.hasHttpsRecord) {
        html += '<span class="badge green">🔒 HTTPS</span>';
      }
      html += "</div></div>";

      /* --- Body --- */
      html += '<div class="body domain-body">';

      /* Error row */
      if (d.lastError) {
        html += '<div class="domain-row domain-error">⚠️ ' + esc(d.lastError) + "</div>";
      }

      /* Health Score bar */
      html += '<div class="domain-health">';
      html += '<div class="health-bar-wrap"><div class="health-bar" style="width:' + score + "%;background:" + scoreColor + '"></div></div>';
      html += '<span class="health-label" style="color:' + scoreColor + '">' + score + "%</span>";
      if (scoreIssues.length > 0) {
        html += '<span class="health-issues">· ' + esc(scoreIssues.join(", ")) + "</span>";
      }
      html += "</div>";

      /* Grid de status */
      html += '<div class="domain-status-grid">';

      /* Email column */
      if (d.expectMX || d.expectSPF || d.expectDMARC || d.expectDKIM) {
        html += '<div class="status-col"><div class="status-col-title">📧 Email</div>';
        if (d.expectMX) {
          var mxOk = s.mx && s.mx.length > 0;
          html += '<div class="status-item"><span class="status-dot ' + (mxOk ? "ok" : "err") + '"></span>MX ' + (mxOk ? "(" + s.mx.length + ")" : "⚠️") + "</div>";
        }
        if (d.expectSPF) {
          var spfOk = s.spf && s.spf.ok;
          html += '<div class="status-item"><span class="status-dot ' + (spfOk === null ? "na" : spfOk ? "ok" : "err") + '"></span>SPF ' + (spfOk === null ? "—" : spfOk ? "✓" : "⚠️") + "</div>";
        }
        if (d.expectDMARC) {
          var dmOk = s.dmarc && s.dmarc.ok;
          var dmPolicy = s.dmarc ? s.dmarc.policy : null;
          html += '<div class="status-item"><span class="status-dot ' + (dmOk === null ? "na" : dmOk ? "ok" : "err") + '"></span>DMARC ' + (dmOk === null ? "—" : dmOk ? (dmPolicy === "none" ? "p=none" : "✓") : "⚠️") + "</div>";
        }
        if (d.expectDKIM) {
          var dkFound = s.dkimFound !== null ? s.dkimFound : null;
          html += '<div class="status-item"><span class="status-dot ' + (dkFound === null ? "na" : dkFound > 0 ? "ok" : "warn") + '"></span>DKIM ' + (dkFound === null ? "—" : dkFound + "/" + s.dkimTotal) + "</div>";
        }
        html += "</div>";
      }

      /* Seguridad column */
      html += '<div class="status-col"><div class="status-col-title">🔒 Seguridad</div>';
      if (s.dnssec) {
        html += '<div class="status-item"><span class="status-dot ' + (s.dnssec.active ? "ok" : "err") + '"></span>DNSSEC ' + (s.dnssec.active ? "✓" : "✗") + "</div>";
      } else {
        html += '<div class="status-item"><span class="status-dot na"></span>DNSSEC —</div>';
      }
      if (d.expectCAA) {
        var caaCount = s.caa ? s.caa.length : 0;
        html += '<div class="status-item"><span class="status-dot ' + (caaCount > 0 ? "ok" : "warn") + '"></span>CAA ' + (caaCount > 0 ? caaCount + " reg" : "⚠️") + "</div>";
      }
      html += "</div>";

      /* Web column */
      if (d.expectWeb || s.web) {
        html += '<div class="status-col"><div class="status-col-title">🌐 Web</div>';
        if (s.web) {
          html += '<div class="status-item"><span class="status-dot ' + (s.web.ok ? "ok" : "err") + '"></span>HTTP ' + (s.web.status || "—") + "</div>";
        }
        if (s.hasHttpsRecord) {
          html += '<div class="status-item"><span class="status-dot ok"></span>SVCB ✓</div>';
        }
        html += "</div>";
      }

      html += "</div>"; /* end grid */

      /* IPs */
      if (s.ips && s.ips.length > 0) {
        html += '<div class="domain-row domain-ips"><span class="domain-label">IPs</span> ';
        var shown = s.ips.slice(0, 4);
        html += shown.map(function (ip) { return '<code>' + esc(ip.type + " " + ip.content) + "</code>"; }).join(" ");
        if (s.ips.length > 4) html += ' <span class="dim">+' + (s.ips.length - 4) + " más</span>";
        html += "</div>";
      }

      /* NS */
      if (s.ns && s.ns.length > 0) {
        html += '<div class="domain-row domain-ns"><span class="domain-label">NS</span> ';
        html += s.ns.map(function (n) { return '<code>' + esc(n.replace(/\.$/, "")) + "</code>"; }).join(" ");
        if (s.nsConsistent === false) {
          html += ' <span class="badge yellow" title="Los resolvers 1.1.1.1 y 8.8.8.8 devuelven NS distintos">⚠️ Inconsistente</span>';
        }
        html += "</div>";
      }

      /* Expiry detail */
      if (s.expiry) {
        html += '<div class="domain-row"><span class="domain-label">Expira</span> ' + esc(s.expiry.date || "—");
        if (s.expiry.registrar) html += ' <span class="dim">· ' + esc(s.expiry.registrar) + "</span>";
        if (s.expiry.dangerous && s.expiry.dangerous.length > 0) {
          html += ' <span class="badge red">⚠️ ' + esc(s.expiry.dangerous.join(", ")) + "</span>";
        }
        html += "</div>";
      }

      /* Actions */
      html += '<div class="domain-actions">';
      html += '<button type="button" class="btn blue btn-small" data-act="history" data-id="' + d.id + '">Historial</button>';
      html += '<button type="button" class="btn red btn-small" data-act="delete" data-id="' + d.id + '">Eliminar</button>';
      html += "</div>";

      html += "</div>"; /* end body */

      card.innerHTML = html;
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

    let alertDomains = [];
    let selectedDomainIds = new Set();
    let currentAlertsPage = 1;

    async function loadDomains() {
      try {
        clearErr();
        const { domains } = await api("/api/domains");
        grid.querySelectorAll(".domain-card").forEach((n) => n.remove());
        empty.hidden = domains.length > 0;
        domains.forEach(renderDomain);
        await syncAlertDomains(domains);
      } catch (err) {
        showErr(err.message);
      }
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      clearErr();
      const zoneName = form.elements.zoneName.value.trim();
      if (!zoneName) return;
      if (!hasCfToken) {
        tokenModal.hidden = false;
        return;
      }
      try {
        await api("/api/domains", { method: "POST", body: JSON.stringify({ zoneName }) });
        form.reset();
        form.elements.id.value = "";
        await loadDomains();
      } catch (err) {
        showErr(err.message);
      }
    });

    modalCancel.addEventListener("click", () => { tokenModal.hidden = true; });
    tokenModal.addEventListener("click", (ev) => {
      if (ev.target === tokenModal) tokenModal.hidden = true;
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") tokenModal.hidden = true;
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
        if (btn.dataset.act === "delete") {
          const { domains } = await api("/api/domains");
          const d = domains.find((x) => String(x.id) === String(id));
          if (d && confirm("¿Eliminar " + d.zoneName + "? Se borran sus snapshots y su historial.")) {
            await api("/api/domains/" + id, { method: "DELETE" });
            await loadDomains();
          }
        } else if (btn.dataset.act === "history") {
          selectedDomainIds = new Set([parseInt(id, 10)]);
          renderFilterBadges();
          currentAlertsPage = 1;
          await loadAlertsPage();
          document.getElementById("alerts-section").scrollIntoView({ behavior: "smooth" });
        }
      } catch (err) {
        showErr(err.message);
      }
    });

    async function loadAlertsPage() {
      const body = document.getElementById("alerts-body");
      const pager = document.getElementById("alerts-pager");
      try {
        const ids = [...selectedDomainIds].join(",");
        const qs = "page=" + currentAlertsPage + "&per_page=20" + (ids ? "&domain_ids=" + encodeURIComponent(ids) : "");
        const data = await api("/api/alerts?" + qs);
        const nameById = new Map(alertDomains.map((d) => [d.id, d]));
        body.innerHTML = "";
        if (data.alerts.length === 0) {
          body.innerHTML = '<tr><td colspan="3" class="empty-row">Sin alertas todavía 🎉</td></tr>';
        } else {
          data.alerts.forEach((a) => {
            const tr = document.createElement("tr");
            const dname = nameById.get(a.domainId) || { emoji: "🌍", zoneName: "—" };
            tr.innerHTML = "<td>" + esc(fmtDate(a.createdAt)) + "</td><td>" + esc(dname.emoji + " " + dname.zoneName) + "</td><td>" + esc(a.subject) + "</td>";
            body.appendChild(tr);
          });
        }
        const totalPages = Math.max(1, Math.ceil(data.total / data.perPage));
        pager.innerHTML =
          '<button type="button" class="btn outline btn-small" ' + (currentAlertsPage <= 1 ? "disabled" : "") + ' data-page="' + (currentAlertsPage - 1) + '">← Anterior</button>' +
          '<span class="pager-info">Página ' + currentAlertsPage + " de " + totalPages + " · " + data.total + " alertas</span>' +
          '<button type="button" class="btn outline btn-small" ' + (currentAlertsPage >= totalPages ? "disabled" : "") + ' data-page="' + (currentAlertsPage + 1) + '">Siguiente →</button>';
      } catch (err) {
        showErr(err.message);
      }
    }

    function renderFilterBadges() {
      const wrap = document.getElementById("alert-filters");
      wrap.innerHTML = "";
      if (alertDomains.length === 0) return;
      alertDomains.forEach((d) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-badge" + (selectedDomainIds.has(d.id) ? " selected" : "");
        btn.dataset.domainId = d.id;
        btn.textContent = (d.emoji || "🌍") + " " + d.zoneName;
        wrap.appendChild(btn);
      });
    }

    document.getElementById("alert-filters").addEventListener("click", (ev) => {
      const badge = ev.target.closest(".filter-badge");
      if (!badge) return;
      const id = parseInt(badge.dataset.domainId, 10);
      if (selectedDomainIds.has(id)) selectedDomainIds.delete(id);
      else selectedDomainIds.add(id);
      badge.classList.toggle("selected");
      currentAlertsPage = 1;
      loadAlertsPage();
    });

    document.getElementById("alerts-pager").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      currentAlertsPage = parseInt(btn.dataset.page, 10);
      loadAlertsPage();
    });

    async function syncAlertDomains(domains) {
      alertDomains = domains.map((d) => ({ id: d.id, zoneName: d.zoneName, emoji: d.emoji || "🌍" }));
      const validIds = new Set(alertDomains.map((d) => d.id));
      for (const id of [...selectedDomainIds]) {
        if (!validIds.has(id)) selectedDomainIds.delete(id);
      }
      renderFilterBadges();
    }

    document.addEventListener("click", (ev) => {
      if (!ev.target.closest(".emoji-picker") && !ev.target.closest("[data-emoji-open]")) {
        closeEmojiPicker();
      }
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") closeEmojiPicker();
    });

    loadDomains();
    loadAlertsPage();
  `;

  return appShell({
    user,
    active: "dashboard",
    title: "Dashboard — DNS Monitor",
    content,
    script,
  });
}
