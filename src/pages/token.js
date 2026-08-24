/* ===== /app/token (configuración del token de Cloudflare) ===== */

import { appShell, esc } from "./shell.js";

export function renderTokenPage({ user }) {
  const hasToken = !!(user.cf_token_enc && user.cf_token_iv);

  const content = `
    <header class="dash-head">
      <div>
        <h1 class="dash-title">Token Cloudflare 🔑</h1>
        <p class="dash-sub">Tu token se guarda cifrado y se usa para leer la configuración DNS de tus dominios. Necesitás uno solo para todos tus dominios.</p>
      </div>
    </header>

    <div class="alert red" id="alert-err" hidden></div>
    <div class="alert green" id="alert-ok" hidden></div>

    <section class="dash-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">Estado del token</h2>
        <span class="badge ${hasToken ? "green" : "yellow"}" id="token-status">${hasToken ? "Configurado ✓" : "No configurado"}</span>
      </div>

      <article class="feature-card ${hasToken ? "green" : "pink"}">
        <div class="body">
          <form id="token-form" class="auth-form">
            <label class="field">
              <span>Token de Cloudflare</span>
              <div class="pass-field">
                <input type="password" name="cfToken" id="cfToken" autocomplete="new-password"
                  placeholder="${hasToken ? "Dejar vacío para mantener el actual" : "Pegá tu token aquí"}" />
                <button type="button" class="pass-toggle" aria-label="Mostrar contraseña">👁️</button>
              </div>
            </label>
            <p class="form-note">El token se guarda cifrado en tu cuenta. Si ya tenés uno configurado, podés dejar el campo vacío para no cambiarlo, o ingresar uno nuevo para reemplazarlo.</p>
            <div class="token-actions">
              <button type="submit" class="btn pink">${hasToken ? "Actualizar token" : "Guardar token"}</button>
              ${hasToken ? '<button type="button" class="btn red" id="btn-delete-token">Eliminar token</button>' : ""}
            </div>
          </form>
        </div>
      </article>
    </section>

    <section class="dash-section">
      <div class="dash-head-inline">
        <h2 class="dash-subtitle">¿Cómo crear el token?</h2>
      </div>
      <article class="feature-card blue">
        <div class="body">
          <ol class="token-steps">
            <li>Ingresá a tu cuenta de Cloudflare y andá a <strong>My Profile → API Tokens</strong>
            </li>
            <li>Tocá <strong>"Create Token"</strong>.</li>
            <li>Elegí <strong>"Create Custom Token"</strong>.</li>
            <li>Configurá los siguientes permisos (todos de solo lectura):</li>
          </ol>
          <ul class="token-perms">
            <li><strong>Zone → Zone → Read</strong> — para buscar y listar tus zonas.</li>
            <li><strong>Zone → DNS → Read</strong> — para leer los registros DNS.</li>
            <li><strong>Zone → DNSSEC → Read</strong> — para verificar el estado de DNSSEC.</li>
            <li><strong>Zone → Audit Logs → Read</strong> — para leer los logs de auditoría de la zona.</li>
          </ul>
          <p class="form-note">En <strong>Zone Resources</strong> seleccioná <strong>All zones</strong> (o zonas específicas si preferís limitar el acceso). El token nunca se usa para escribir, solo para leer.</p>
          <p class="form-note">Cuando lo tengas, pegalo en el campo de arriba y guardá.</p>
        </div>
      </article>
    </section>
  `;

  const script = `
    const errBox = document.getElementById("alert-err");
    const okBox = document.getElementById("alert-ok");
    const form = document.getElementById("token-form");
    const statusBadge = document.getElementById("token-status");
    const btnDelete = document.getElementById("btn-delete-token");

    function showErr(msg) {
      errBox.textContent = "⚠️ " + msg;
      errBox.hidden = false;
    }
    function showOk(msg) {
      okBox.textContent = "✅ " + msg;
      okBox.hidden = false;
      setTimeout(() => { okBox.hidden = true; }, 4000);
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

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      clearErr();
      const cfToken = document.getElementById("cfToken").value;
      if (!cfToken) {
        showErr("Ingresá un token. Si querés mantener el actual, no hace falta guardar de nuevo.");
        return;
      }
      try {
        await api("/api/token", {
          method: "PUT",
          body: JSON.stringify({ cfToken }),
        });
        showOk("Token guardado ✓");
        document.getElementById("cfToken").value = "";
        document.getElementById("cfToken").placeholder = "Dejar vacío para mantener el actual";
        statusBadge.textContent = "Configurado ✓";
        statusBadge.className = "badge green";
      } catch (err) {
        showErr(err.message);
      }
    });

    if (btnDelete) {
      btnDelete.addEventListener("click", async () => {
        if (!confirm("¿Eliminar el token de Cloudflare? El monitor no podrá revisar tus dominios hasta que agregues uno nuevo.")) return;
        try {
          await api("/api/token", { method: "DELETE" });
          showOk("Token eliminado ✓");
          document.getElementById("cfToken").placeholder = "Pegá tu token aquí";
          statusBadge.textContent = "No configurado";
          statusBadge.className = "badge yellow";
          btnDelete.remove();
        } catch (err) {
          showErr(err.message);
        }
      });
    }
  `;

  return appShell({
    user,
    active: "token",
    title: "Token Cloudflare — DNS Monitor",
    content,
    script,
  });
}
