<h1 align="center">🛰️ DNS Monitor</h1>

<p align="center">
  🇪🇸 Español - <a href="README.en.md">🇬🇧 English</a>
</p>

<p align="center">
  Monitor de dominios e infraestructura con alertas en tiempo real: detecta cambios en DNS, nameservers, registrador, DNSSEC, configuración de email, disponibilidad web y salud del monitor.
</p>
<p align="center">
Construido en Cloudflare Workers con scheduled cron checks, KV storage y DNS-over-HTTPS lookups.
</p>

<br>

## 📸 Screenshots

<table>
  <tr>
    <td align="center"><img src="./docs/1.png" alt="Landing" /></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/2.png" alt="Landing" /></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/3.png" alt="Landing" /></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/4.png" alt="Landing" /></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/5.png" alt="Landing" /></td>
  </tr>
  <tr>
    <td align="center"><img src="./docs/6.png" alt="Landing" /></td>
  </tr>
</table>

<br>

## ⚙️ Funcionalidades

**SaaS multi-tenant** (modo por defecto):

- 🧑‍💻 **Registro y login** con verificación por email (welcome email + link de confirmación), recuperación de contraseña y cambio de contraseña desde el dashboard
- 🌍 **Dashboard por usuario**: dominios con estado en vivo (última corrida, errores), alta/edición/eliminación con validación real del token contra la API de Cloudflare, y emoji personalizable por dominio (picker optimista, sin refresh)
- 📊 **Historial de alertas** por dominio con paginación
- 🔔 **Canales de alerta globales**: email (destino configurable), **Telegram** (bot + chat id), **Discord** (webhook) y **Webhook genérico** (POST JSON + firma HMAC opcional) — todos con botón "Probar"
- 🔐 Los tokens de cada usuario se cifran con **AES-256-GCM** (`MASTER_KEY` del operador) y nunca se muestran de nuevo

**Motor de monitoreo** (un Cloudflare Worker con cron `*/10 * * * *`):

- cambios en los registros DNS internos (Cloudflare)
- cambios en los nameservers reales del dominio (DNS over HTTPS)
- **quién** hizo cada cambio DNS (Audit Logs de Cloudflare)
- vencimiento del dominio (RDAP, gratis, sin API key), incluyendo **cambios de registrador** y **estados críticos** (`pendingDelete`, `redemptionPeriod`, `clientHold`)
- registros de email: **MX, SPF, DMARC, DKIM** (DoH), más el **límite de DNS lookups del SPF** (RFC 7208) y las **direcciones rua/ruf** del DMARC
- estado **DNSSEC** (Cloudflare + registros DS públicos)
- registros **CAA** (opcional) y **HTTPS (SVCB)** en el apex
- **consistencia de nameservers** entre 1.1.1.1 y 8.8.8.8 (posible secuestro/fragmentación)
- **web check** (opcional): ¿el sitio responde por HTTPS?
- salud del propio monitor: corridas perdidas y errores recurrentes (heartbeat)

Cada alerta se envía por los canales configurados (email + Telegram/Discord/webhook) y queda registrada en el historial.

<br>

## 🚀 Cómo funciona

1. **Te registrás** — email + contraseña, confirmás tu email.
2. **Conectás tu Cloudflare** — pegás tu token de solo lectura; se cifra y se valida al instante.
3. **Agregás tus dominios** — zone ID y dominio; 3 dominios gratis por cuenta.
4. **Configurás tus alertas** — elegís el email destino y tus canales (email, Telegram, Discord o webhook, con botón "Probar").
5. El cron corre **cada 10 minutos**: compara snapshots en KV, corre los checks diarios (vencimiento, email, DNSSEC) y, si hay novedades, las despacha a tus canales y las guarda en el historial.

<br>

## 🏗️ Arquitectura

```
                    ┌─────────┐
                    │  Cron   │
                    └────┬────┘
                         ▼
┌──────────────┐   ┌──────────────┐      ┌──────────────┐
│ Cloudflare   │──►│ Check Engine │ ───► │ Snapshot KV  │
│ DNS / Audit  │   └──────┬───────┘      └──────────────┘
└──────────────┘          │                    │
                          │              ┌─────┴──────┐
               ┌──────────┼───────────┐  │   D1       │
               ▼          ▼           ▼  │ usuarios / │
             DNS       RDAP/DoH    HTTPS │ dominios / │
               │          │           │  │ alertas /  │
               └──────────┼───────────┘  │ canales    │
                          ▼              └────────────┘
                   ┌────────────┐              │
                   │ Alert      │◄─────────────┘
                   │ Engine     │
                   └─────┬──────┘
                         ▼
              Email · Telegram · Discord · Webhook
```

**Componentes**:

| Pieza | Rol |
| ----- | --- |
| `D1` | Usuarios, sesiones, dominios (con secretos cifrados), historial de alertas y canales |
| `KV` | Snapshots de DNS/NS, timestamps de frescura, audit cursors, heartbeats |
| `crypto` | PBKDF2 para passwords y AES-256-GCM para los tokens de cada usuario |
| `assets` | Landing y design system (`public/`) |

<br>

## 🚀 Para usuarios

1. Andá a **Crear cuenta gratis** → confirmá tu email.
2. En el dashboard: **Agregar dominio** con:
   - **Zone ID** de Cloudflare (Overview → sección API) — lo validamos contra la API al instante
   - Tu **token de Cloudflare** con permiso `Zone → DNS → Read` (opcionales: `Zone → Zone → Read`, `Zone → Logs → Read`)
3. En **Alertas** (navbar): elegí el **email destino** (todas las alertas de tus dominios llegan ahí, enviadas desde `dns@transistemas.org`), y configurá **Telegram** (creá un bot con @BotFather), **Discord** (webhook del canal) o un **Webhook** propio. Usá "Probar" para validar cada uno.
4. El emoji de cada dominio se puede cambiar desde su card (pickercito de emojis, guardado al instante).

> Los correos de sistema (bienvenida, confirmación, recuperación) los envía la instancia con `RESEND_API_KEY` del operador.

<br>

## 🔧 Para operadores (deploy)

Requisitos: `npm install`, cuenta de Cloudflare con Workers + D1.

```bash
# 1. Base de datos
npx wrangler d1 create dns-monitor          # copiar el id en wrangler.toml
npx wrangler d1 migrations apply dns-monitor --remote

# 2. Namespace KV
npx wrangler kv namespace create DNS_MONITOR   # copiar el id en wrangler.toml

# 3. Secretos
npx wrangler secret put MASTER_KEY          # base64 de 32 bytes: openssl rand -base64 32
npx wrangler secret put RESEND_API_KEY      # emails de sistema (bienvenida, verify, reset)

# 4. Variables (wrangler.toml)
#    SYSTEM_MAIL_FROM = "DNS Monitor <no-reply@tudominio.com>"  # remitente verificado en Resend

# 5. Deploy
npx wrangler deploy
```

- `MASTER_KEY` cifra los tokens de todos los usuarios: **no la pierdas** (no se puede recuperar).
- `RESEND_API_KEY` del operador se usa para los emails de sistema **y para todas las alertas por email** (desde `SYSTEM_MAIL_FROM`, por defecto `dns@transistemas.org`). El plan gratis de Resend incluye 3.000 emails/mes y 100/día.
- Healthchecks.io opcional: `npx wrangler secret put HEALTHCHECKS_URL`.
- Migraciones: `npx wrangler d1 migrations apply dns-monitor --remote` tras cada `migrations/*.sql` nuevo.

<br>

## 🧪 Prueba rápida

Creá un registro DNS de prueba en cualquiera de los dominios monitoreados:

- Tipo: `TXT`
- Nombre: `dns-test`
- Contenido: `test`

Deberías recibir la alerta en tus canales (email/Telegram/Discord/webhook) en un tiempo máximo de 10 minutos, con la sección "Quién lo cambió" (si el token tiene `Zone → Logs → Read`).

Para disparar el cron manualmente en desarrollo:

    npx wrangler dev --test-scheduled
    curl "http://localhost:8787/__scheduled?cron=*/10+*+*+*+*"

> Los checks diarios (vencimiento, email, DNSSEC) corren una vez cada 24 h. Para forzarlos, borra las claves `last_*_ts_<zoneId>` del KV.

<br>

## 🔍 Logs

    npx wrangler tail

<br>

## ⚡ Funciones

**HTTP / SaaS** (`fetch`):

- `handleFetch(request, env)`: Router — páginas (`/register`, `/login`, `/logout`, `/verify`, `/resend`, `/forgot`, `/reset`, `/change-password`, `/app`, `/app/alertas`) y API JSON (`/api/domains`, `/api/channels`, `/api/settings`). Chequeo de Origin (CSRF) y rate-limit de login por KV.
- `sendVerificationEmail` / `sendWelcomeEmail` / `sendResetEmail`: Emails de sistema con token de un solo uso (24 h / 1 h) vía la Resend del operador.
- `handleApiDomains`: CRUD de dominios con validación del token contra la API de Cloudflare (`GET /zones/{id}` con fallback a `dns_records` para tokens solo-DNS); cuota de 3 dominios; rotación de secretos.
- `handleApiChannels`: Alta/test/borrado de canales con validación por tipo (Telegram `getMe`, Discord webhook, Webhook https) y cifrado de configs.
- `handleApiSettings`: Email de alertas global de la cuenta (+ endpoint de prueba `/api/settings/test`).
- `sendToChannels(env, channel, data)`: Dispatcher de alertas — Telegram (`sendMessage`, split 4096), Discord (`content`, 2000) y Webhook (POST JSON + firma HMAC-SHA256 en `X-DNS-Monitor-Signature`).

**Motor** (`scheduled`):

- `scheduled(event, env, ctx)`: Punto de entrada del cron; dispara `runCheck` en background.
- `runCheck(env)`: Orquesta la corrida: heartbeat, chequeo por dominio, recuperación de errores, ping a Healthchecks, envío por email/canales, log en el historial y estado por dominio (`last_check_ts` / `last_error`). El email de cada dominio va al `alert_email` del usuario desde el remitente del operador.
- `getDomains(env)`: Lee los dominios desde **D1** (modo SaaS, con secretos descifrados por fila) o desde la variable `DOMAINS` (modo legacy self-host).
- `checkDomain(env, domain)`: DNS internos + nameservers + audit logs + checks diarios con frescura por KV.
- `checkMissedRuns` / `pingHealthchecks` / `recordDomainError` / `clearDomainError`: Heartbeat interno, watchdog externo y contador de errores por dominio.
- `checkDomainExpiry` (RDAP), `checkEmailRecords` (MX/SPF/DMARC/DKIM), `checkDnssec` (CF + DS públicos), `checkCaa`, `checkWeb`, `checkNsConsistency` (1.1.1.1 vs 8.8.8.8), `checkHttpsRecord` (SVCB).
- `dohQuery(name, type)`: Helper de DNS sobre HTTPS.
- `fetchAllDnsRecords(zoneId, apiToken)`: Pagina los registros DNS de la zona.
- `normalizeRecords` / `diffRecords`: Snapshots deterministas y diff de registros.
- `buildEmailBody` / `buildEmailText` / `sendEmail`: Email combinado por dominio.

<br>

## 🛡️ Seguridad

- El repo **no contiene secretos**. Todo se maneja con `npx wrangler secret put ...` y `.dev.vars` (gitignored) para dev.
- Los tokens de cada usuario se cifran con **AES-256-GCM** usando `MASTER_KEY`; las configs de canales igual.
- Passwords con **PBKDF2-SHA256** (100k iteraciones), sesiones con cookie httpOnly + SameSite=Lax + chequeo de Origin.
- El aislamiento entre usuarios lo garantiza Cloudflare: cada token solo puede leer las zonas del dueño.
- El runtime de Workers bloquea conexiones a IPs privadas (mitiga SSRF del webhook genérico).

<br>

## 📝 Licencia

MIT.
Se puede usar este monitor para vigilar cualquier dominio: cambios DNS, nameservers, vencimiento, registros de email, DNSSEC y salud del monitor.

<br>

---

_🌈 Creado con orgullo por el Equipo de Desarrollo de Transistemas ❤_