/* ===== Dashboard /app (shell server-rendered + JS vanilla contra /api) ===== */

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderDashboardPage({ user }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1b1b1a" />
  <title>Dashboard — DNS Monitor</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛰️</text></svg>" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <nav class="navbar">
    <a class="wordmark" href="/" title="DNS Monitor">DNS MONITOR</a>
    <ul class="nav-links">
      <li><a href="/">Página principal</a></li>
      <li><span class="nav-user">👤 ${esc(user.email)}</span></li>
      <li><a class="nav-cta" href="/logout">Salir</a></li>
    </ul>
  </nav>

  <main class="container dash-wrap">
    <header class="dash-head">
      <div>
        <h1 class="dash-title">Tu dashboard 🛰️</h1>
        <p class="dash-sub">Estado de tus dominios y historial de alertas. El monitor corre cada 10 minutos.</p>
      </div>
      <button type="button" class="btn pink" id="btn-new">＋ Agregar dominio</button>
    </header>

    <div class="alert red" id="alert-err" hidden></div>

    <section class="domain-form-card" id="form-panel" hidden>
      <div class="head">
        <span class="emoji">🌍</span>
        <h3 id="form-title">Agregar dominio</h3>
      </div>
      <form id="domain-form" class="auth-form">
        <input type="hidden" name="id" />
        <div class="form-grid">
          <label class="field">
            <span>Zone ID (Cloudflare)</span>
            <input type="text" name="zoneId" required pattern="[0-9a-fA-F]{32}" placeholder="32 caracteres hex" />
          </label>
          <label class="field">
            <span>Dominio (zoneName)</span>
            <input type="text" name="zoneName" required placeholder="example.com" />
          </label>
          <label class="field">
            <span>Destinatario de alertas (mailTo)</span>
            <input type="email" name="mailTo" required value="${esc(user.email)}" placeholder="admin@example.com" />
          </label>
          <label class="field">
            <span>Remitente verificado en Resend (mailFrom)</span>
            <input type="email" name="mailFrom" required placeholder="dns@example.com" />
          </label>
          <label class="field">
            <span>Token de Cloudflare</span>
            <div class="pass-field">
              <input type="password" name="cfToken" id="cfToken" autocomplete="new-password" placeholder="Pegá tu token (solo lectura)" />
              <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
            </div>
          </label>
          <label class="field">
            <span>API key de Resend</span>
            <div class="pass-field">
              <input type="password" name="resendKey" id="resendKey" autocomplete="new-password" placeholder="Pegá tu key" />
              <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
            </div>
          </label>
          <label class="field">
            <span>Días de alerta de vencimiento</span>
            <input type="text" name="expiryAlertDays" value="60,30,14,7,1" placeholder="60,30,14,7,1" />
          </label>
        </div>
        <div class="flag-grid" id="flag-grid">
          <label class="flag"><input type="checkbox" name="expectMX" checked /> Verificar MX</label>
          <label class="flag"><input type="checkbox" name="expectSPF" checked /> Verificar SPF</label>
          <label class="flag"><input type="checkbox" name="expectDMARC" checked /> Verificar DMARC</label>
          <label class="flag"><input type="checkbox" name="expectDKIM" checked /> Verificar DKIM</label>
          <label class="flag"><input type="checkbox" name="expectCAA" /> Alertar sin CAA</label>
          <label class="flag"><input type="checkbox" name="expectWeb" /> Web check (HTTPS)</label>
        </div>
        <p class="form-note" id="secrets-note">🔐 Los tokens se cifran con AES-256 y nunca se muestran de nuevo. Solo se usan para leer tus zonas y enviar tus alertas.</p>
        <div class="form-actions">
          <button type="submit" class="btn pink" id="btn-save">Guardar dominio</button>
          <button type="button" class="btn outline" id="btn-cancel">Cancelar</button>
        </div>
      </form>
    </section>

    <section class="dash-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Tus dominios</h2>
        <span class="badge blue" id="quota-badge">0 / 3 dominios</span>
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
  </main>

  <script>
    (function () {
      const grid = document.getElementById("domains-grid");
      const empty = document.getElementById("empty-state");
      const errBox = document.getElementById("alert-err");
      const formPanel = document.getElementById("form-panel");
      const form = document.getElementById("domain-form");
      const formTitle = document.getElementById("form-title");
      const quotaBadge = document.getElementById("quota-badge");
      const QUOTA = 3;

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
          '<div class="head"><span class="emoji">🌍</span><h3>' + esc(d.zoneName) + "</h3></div>" +
          '<div class="body domain-body">' +
          '<div class="domain-row">' + statusBadge(d) + "</div>" +
          (d.lastError ? '<div class="domain-row domain-error">' + esc(d.lastError) + "</div>" : "") +
          '<div class="domain-row">📧 ' + esc(d.mailTo) + "</div>" +
          '<div class="domain-row">🏷️ ' + esc(flags.join(", ") || "—") + "</div>" +
          '<div class="domain-actions">' +
          '<button type="button" class="btn blue btn-small" data-act="history" data-id="' + d.id + '">Historial</button>' +
          '<button type="button" class="btn outline btn-small" data-act="edit" data-id="' + d.id + '">Editar</button>' +
          '<button type="button" class="btn red btn-small" data-act="delete" data-id="' + d.id + '">Eliminar</button>' +
          "</div>" +
          "</div>";
        grid.appendChild(card);
      }

      async function loadDomains() {
        try {
          clearErr();
          const { domains } = await api("/api/domains");
          grid.querySelectorAll(".domain-card").forEach((n) => n.remove());
          empty.hidden = domains.length > 0;
          domains.forEach(renderDomain);
          quotaBadge.textContent = domains.length + " / " + QUOTA + " dominios";
        } catch (err) {
          showErr(err.message);
        }
      }

      function resetFields() {
        form.reset();
        form.elements.id.value = "";
        form.elements.cfToken.required = true;
        form.elements.resendKey.required = true;
        form.elements.zoneId.disabled = false;
        form.elements.zoneName.disabled = false;
        document.getElementById("secrets-note").textContent =
          "🔐 Los tokens se cifran con AES-256 y nunca se muestran de nuevo. Solo se usan para leer tus zonas y enviar tus alertas.";
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
        form.elements.mailTo.value = domain.mailTo;
        form.elements.mailFrom.value = domain.mailFrom;
        form.elements.expiryAlertDays.value = (domain.expiryAlertDays || []).join(",");
        form.elements.expectMX.checked = domain.expectMX;
        form.elements.expectSPF.checked = domain.expectSPF;
        form.elements.expectDMARC.checked = domain.expectDMARC;
        form.elements.expectDKIM.checked = domain.expectDKIM;
        form.elements.expectCAA.checked = domain.expectCAA;
        form.elements.expectWeb.checked = domain.expectWeb;
        form.elements.cfToken.required = false;
        form.elements.resendKey.required = false;
        form.elements.zoneId.disabled = true;
        form.elements.zoneName.disabled = true;
        document.getElementById("secrets-note").textContent =
          "🔐 Dejá los campos de token vacíos para mantener los actuales. Completalos solo para rotarlos.";
        formTitle.textContent = "Editar " + domain.zoneName;
        document.getElementById("btn-save").textContent = "Guardar cambios";
      }

      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const id = form.elements.id.value;
        const payload = {
          zoneId: form.elements.zoneId.value,
          zoneName: form.elements.zoneName.value,
          mailTo: form.elements.mailTo.value,
          mailFrom: form.elements.mailFrom.value,
          cfToken: form.elements.cfToken.value || undefined,
          resendKey: form.elements.resendKey.value || undefined,
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
        const section = document.getElementById("alerts-section");
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

      document.querySelectorAll(".pass-toggle").forEach((btn) => {
        btn.addEventListener("click", () => {
          const input = btn.closest(".pass-field").querySelector("input");
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          btn.textContent = show ? "🙈" : "👁️";
          btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
        });
      });

      (function () {
        const el = document.querySelector(".wordmark");
        const text = el.textContent;
        el.textContent = "";
        for (const ch of text) {
          const span = document.createElement("span");
          span.textContent = ch === " " ? "\\u00A0" : ch;
          el.appendChild(span);
        }
      })();

      loadDomains();
    })();
  </script>
</body>
</html>`;
}