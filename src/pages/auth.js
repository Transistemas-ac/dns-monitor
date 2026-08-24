/* ===== Páginas de autenticación (server-rendered, design system de la landing) ===== */

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shell({ title, user, content }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1b1b1a" />
  <title>${esc(title)}</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛰️</text></svg>" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <nav class="navbar">
    <a class="wordmark" href="/" title="DNS Monitor">DNS MONITOR</a>
    <ul class="nav-links">
      ${
        user
          ? `<li><a href="/app">Mi dashboard</a></li>
             <li><a class="nav-cta" href="/logout">Salir</a></li>`
          : `<li><a href="/login">Ingresar</a></li>
             <li><a class="nav-cta" href="/register">🚀 Crear cuenta gratis</a></li>`
      }
    </ul>
  </nav>
  <main class="container auth-wrap">
    ${content}
  </main>
</body>
</html>`;
}

function wordmarkRainbow() {
  return `<script>
    (function () {
      const el = document.querySelector(".wordmark");
      if (!el || el.dataset.rainbow) return;
      el.dataset.rainbow = "1";
      const text = el.textContent;
      el.textContent = "";
      for (const ch of text) {
        const span = document.createElement("span");
        span.textContent = ch === " " ? "\\u00A0" : ch;
        el.appendChild(span);
      }
    })();
  </script>`;
}

export function renderRegisterPage({ error, email }) {
  return shell({
    title: "Crear cuenta — DNS Monitor",
    user: null,
    content: `
      <section class="auth-card pink">
        <span class="auth-emoji">🛰️</span>
        <h1>Crear tu cuenta</h1>
        <p class="auth-sub">Listo en un minuto. Te enviamos un email de confirmación y después conectás tu Cloudflare y Resend.</p>
        ${
          error
            ? `<div class="alert red" role="alert">⚠️ ${esc(error)}</div>`
            : ""
        }
        <form method="post" action="/register" class="auth-form">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" value="${esc(email || "")}" placeholder="vos@tudominio.com" />
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
          </label>
          <button type="submit" class="btn pink btn-block">Crear cuenta</button>
        </form>
        <p class="auth-foot">¿Ya tenés cuenta? <a class="link" href="/login">Ingresá</a></p>
      </section>
      ${wordmarkRainbow()}
    `,
  });
}

export function renderLoginPage({ error, email, unverified }) {
  return shell({
    title: "Ingresar — DNS Monitor",
    user: null,
    content: `
      <section class="auth-card blue">
        <span class="auth-emoji">🔭</span>
        <h1>Ingresar</h1>
        <p class="auth-sub">Bienvenido de vuelta a tu dashboard.</p>
        ${
          error
            ? `<div class="alert red" role="alert">⚠️ ${esc(error)}
                 ${
                   unverified && email
                     ? `<br /><a class="link" href="/resend?email=${encodeURIComponent(email)}">Reenviar email de confirmación</a>`
                     : ""
                 }
               </div>`
            : ""
        }
        <form method="post" action="/login" class="auth-form">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" value="${esc(email || "")}" placeholder="vos@tudominio.com" />
          </label>
          <label class="field">
            <span>Contraseña</span>
            <input type="password" name="password" required autocomplete="current-password" placeholder="Tu contraseña" />
          </label>
          <button type="submit" class="btn blue btn-block">Ingresar</button>
        </form>
        <p class="auth-foot"><a class="link" href="/forgot">¿Olvidaste tu contraseña?</a></p>
        <p class="auth-foot">¿No tenés cuenta? <a class="link" href="/register">Creala gratis</a></p>
      </section>
      ${wordmarkRainbow()}
    `,
  });
}

export function renderVerifySentPage({ email }) {
  return shell({
    title: "Confirmá tu email — DNS Monitor",
    user: null,
    content: `
      <section class="auth-card yellow">
        <span class="auth-emoji">📬</span>
        <h1>Revisá tu email</h1>
        <p class="auth-sub">
          Te enviamos un link de confirmación a <strong>${esc(email)}</strong>.
          Toca el link para activar tu cuenta y después ingresá.
        </p>
        <p class="auth-foot">
          ¿No llegó? Revisá spam o
          <a class="link" href="/resend?email=${encodeURIComponent(email)}">reenviá el email</a>.
        </p>
      </section>
      ${wordmarkRainbow()}
    `,
  });
}

export function renderMessagePage({ emoji, title, message, ctaHref, ctaLabel }) {
  return shell({
    title: `${title} — DNS Monitor`,
    user: null,
    content: `
      <section class="auth-card green">
        <span class="auth-emoji">${emoji}</span>
        <h1>${esc(title)}</h1>
        <p class="auth-sub">${esc(message)}</p>
        ${
          ctaHref
            ? `<p class="auth-foot"><a class="btn green" href="${ctaHref}">${esc(ctaLabel || "Continuar")}</a></p>`
            : ""
        }
      </section>
      ${wordmarkRainbow()}
    `,
  });
}

export function renderForgotPage({ error, email, sent }) {
  return shell({
    title: "Recuperar contraseña — DNS Monitor",
    user: null,
    content: `
      <section class="auth-card purple">
        <span class="auth-emoji">🔑</span>
        <h1>¿Olvidaste tu contraseña?</h1>
        ${
          sent
            ? `<p class="auth-sub">
                 Si existe una cuenta con <strong>${esc(email)}</strong>, te enviamos
                 un link para cambiarla. Revisá tu bandeja (y el spam).
               </p>
               <p class="auth-foot"><a class="link" href="/login">Volver a ingresar</a></p>`
            : `
        <p class="auth-sub">Te enviamos un link por email para crear una nueva.</p>
        ${
          error
            ? `<div class="alert red" role="alert">⚠️ ${esc(error)}</div>`
            : ""
        }
        <form method="post" action="/forgot" class="auth-form">
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" value="${esc(email || "")}" placeholder="vos@tudominio.com" />
          </label>
          <button type="submit" class="btn purple btn-block">Enviar link de recuperación</button>
        </form>
        <p class="auth-foot"><a class="link" href="/login">Volver a ingresar</a></p>`
        }
      </section>
      ${wordmarkRainbow()}
    `,
  });
}

export function renderResetPage({ error, token }) {
  return shell({
    title: "Nueva contraseña — DNS Monitor",
    user: null,
    content: `
      <section class="auth-card purple">
        <span class="auth-emoji">🔐</span>
        <h1>Crear nueva contraseña</h1>
        <p class="auth-sub">Elegí una contraseña nueva (mínimo 8 caracteres).</p>
        ${
          error
            ? `<div class="alert red" role="alert">⚠️ ${esc(error)}</div>`
            : ""
        }
        <form method="post" action="/reset" class="auth-form">
          <input type="hidden" name="token" value="${esc(token)}" />
          <label class="field">
            <span>Contraseña nueva</span>
            <input type="password" name="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
          </label>
          <label class="field">
            <span>Repetí la contraseña</span>
            <input type="password" name="password2" required minlength="8" autocomplete="new-password" placeholder="Repetí la contraseña" />
          </label>
          <button type="submit" class="btn purple btn-block">Cambiar contraseña</button>
        </form>
      </section>
      ${wordmarkRainbow()}
    `,
  });
}