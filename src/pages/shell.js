/* ===== Shell compartido de las páginas de la app (navbar + base JS) ===== */

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function appShell({ user, active = "", content, script, title }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1b1b1a" />
  <title>${esc(title || "DNS Monitor")}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛰️</text></svg>" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <nav class="navbar">
    <a class="wordmark" href="/" title="DNS Monitor">DNS MONITOR</a>
    <ul class="nav-links">
      <li><a href="/app" class="${active === "dashboard" ? "nav-active" : ""}">Monitor</a></li>
      <li><a href="/app/alertas" class="${active === "alertas" ? "nav-active" : ""}">Alertas</a></li>
      <li>
        <div class="nav-user-wrap">
          <button type="button" class="nav-user-btn" id="user-menu-btn">👤 ${esc(user.email)}</button>
          <div class="user-menu" id="user-menu" hidden>
            <a href="/change-password">🔑 Cambiar contraseña</a>
            <a href="/logout">🚪 Cerrar sesión</a>
          </div>
        </div>
      </li>
    </ul>
  </nav>

  <main class="container dash-wrap">
    ${content}
  </main>

  <script>
    (function () {
      const menuBtn = document.getElementById("user-menu-btn");
      const menu = document.getElementById("user-menu");
      menuBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        menu.hidden = !menu.hidden;
      });
      document.addEventListener("click", function (ev) {
        if (!ev.target.closest(".nav-user-wrap")) menu.hidden = true;
      });

      document.querySelectorAll(".pass-toggle").forEach(function (btn) {
        btn.addEventListener("click", function () {
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

      ${script || ""}
    })();
  </script>
</body>
</html>`;
}