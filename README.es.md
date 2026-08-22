<h1 align="center">🛰️ DNS Monitor</h1>

<p align="center">
  <a href="README.md">🇬🇧 English</a> - 🇪🇸 Español
</p>

<p align="center">Monitor de dominios e infraestructura con alertas por email: detecta cambios en DNS, nameservers, registrador, DNSSEC, certificados, configuración de email, disponibilidad web y salud del monitor.</p>

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

Este proyecto implementa un **Cloudflare Worker con cron** que monitorea:

- cambios en los registros DNS internos (Cloudflare)
- cambios en los nameservers reales del dominio (DNS over HTTPS)
- **quién** hizo cada cambio DNS (Audit Logs de Cloudflare)
- vencimiento del dominio (RDAP, gratis, sin API key), incluyendo **cambios de registrador** y **estados críticos** (`pendingDelete`, `redemptionPeriod`, `clientHold`)
- registros de email: **MX, SPF, DMARC, DKIM** (DNS over HTTPS), más el **límite de DNS lookups del SPF** (RFC 7208) y las **direcciones de reporte rua/ruf** del DMARC
- estado **DNSSEC** (Cloudflare + registros DS públicos)
- registros **CAA** (_opcional_, `expectCAA`)
- registro **HTTPS (SVCB)** en el apex
- **consistencia de nameservers** entre resolvers 1.1.1.1 y 8.8.8.8 (posible secuestro/fragmentación de DNS)
- **web check** (_opcional_, `expectWeb`): ¿el sitio responde por HTTPS?
- salud del propio monitor: corridas perdidas y errores recurrentes (heartbeat)

Y envía un correo automático cuando detecta cualquier diferencia o problema. Puede monitorear **múltiples dominios**, cada uno con su propio correo destinatario.

<br>

## 🚀 Funcionamiento

1. El Worker se ejecuta cada 10 minutos.
2. Obtiene los registros DNS internos por API de Cloudflare y los nameservers reales vía DoH, y los compara con snapshots en KV. Si hay cambios, adjunta quién los hizo consultando los Audit Logs de Cloudflare.
3. Los checks de estado (vencimiento, registros de email, DNSSEC) corren **1 vez por día** (frescura controlada por timestamps en KV).
4. El heartbeat detecta corridas perdidas del cron y errores recurrentes por dominio.
5. Si hay novedades, envía un correo combinado con todas las secciones del dominio.

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
└──────────────┘          │
                          │
               ┌──────────┼───────────┐
               ▼          ▼           ▼
             DNS       RDAP/DoH    HTTPS
               │          │           │
               └──────────┼───────────┘
                          ▼
                   ┌────────────┐
                   │ Alert      │
                   │ Engine     │
                   └─────┬──────┘
                         ▼
                      Email
```

<br>

## 🔧 Requisitos previos

- Cloudflare Workers habilitado
- Acceso a los dominios a monitorear en Cloudflare
- Cuenta en **Resend**
- Dominio(s) verificados en Resend (el remitente `mailFrom` debe estar verificado)
- Token de Cloudflare con permisos sobre **todas** las zonas a monitorear:
  - `Zone → DNS → Read`
  - `Zone → Zone → Read`
  - `Zone → Logs → Read` (requerido para la sección "Quién lo cambió"; si falta, se omite sin romper el resto)

<br>

## ⚙️ Instalación

Clonar el repositorio:

    git clone https://github.com/Transistemas-ac/dns-monitor

Instalar dependencias:

    npm install

Crear el namespace de KV:

    npx wrangler kv namespace create DNS_MONITOR

El comando devuelve un JSON con un `id`. Copialo en `wrangler.toml`:

    kv_namespaces = [
      { binding = "DNS_MONITOR", id = "<id del comando>" }
    ]

Configurar los secretos:

    npx wrangler secret put CF_API_TOKEN
    npx wrangler secret put RESEND_API_KEY

Opcional — watchdog externo (cubre la muerte total del Worker, que el heartbeat interno no puede detectar). Configuración paso a paso:

1. Crea una cuenta gratis en [healthchecks.io](https://healthchecks.io) y entrá a **My Checks → Add Check**.
2. Elegí **"Ping-only"** como tipo de check (sin proyecto, sin almacenamiento).
3. Configurá el **Period** en `10` minutos y el **Grace** en `1` día (o más, si no querés correos de madrugada). El Worker hace ping al final de cada corrida exitosa; Healthchecks alerta si los pings se detienen.
4. Copiá la URL de ping del check (ej. `https://hc-ping.com/<uuid>`) y configurala como secreto:

   npx wrangler secret put HEALTHCHECKS_URL

5. Desplegá y verificá: tras la próxima corrida deberías ver el check actualizado en la lista **Pings**, y actividad del ping en `wrangler tail`. Si el cron muere del todo, Healthchecks manda la alerta.

Editar `wrangler.toml`:

- el `id` devuelto por el comando de KV de arriba (bloque `kv_namespaces`)
- la variable `DOMAINS` con la lista de dominios a monitorear (JSON array)

> ⚠️ **Importante:** la variable `DOMAINS` viene configurada por defecto con los valores de **transistemas.org** como ejemplo. Debes reemplazarla con **tu propio dominio** y **tus propios correos** antes de desplegar.

Formato de `DOMAINS` — por cada dominio:

| Campo             | Descripción                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- |
| `zoneId`          | ID de la zona en Cloudflare                                                           |
| `zoneName`        | El dominio a monitorear                                                               |
| `mailTo`          | Destinatario de las alertas                                                           |
| `mailFrom`        | Remitente (debe estar verificado en tu cuenta Resend)                                 |
| `expiryAlertDays` | _(opcional)_ Umbrales de días para alertar vencimiento. Default: `[60, 30, 14, 7, 1]` |
| `expectMX`        | _(opcional)_ Verificar MX. Default: `true`                                            |
| `expectSPF`       | _(opcional)_ Verificar SPF. Default: `true`                                           |
| `expectDMARC`     | _(opcional)_ Verificar DMARC. Default: `true`                                         |
| `expectDKIM`      | _(opcional)_ Verificar DKIM. Default: `true`                                          |
| `expectCAA`       | _(opcional)_ Alertar si no hay registros CAA. Default: `false`                        |
| `expectWeb`       | _(opcional)_ Verificar que el sitio responda por HTTPS. Default: `false`              |

Ejemplo con dos dominios (JSON multilinea con comillas triples `"""`):

```toml
[vars]
DOMAINS = """[
  {
    "zoneId": "<ZONE_ID>",
    "zoneName": "example.com",
    "mailTo": "admin@example.com",
    "mailFrom": "dns@example.com"
  },
  {
    "zoneId": "<ZONE_ID_2>",
    "zoneName": "example.org",
    "mailTo": "ops@example.org",
    "mailFrom": "dns@example.org",
    "expiryAlertDays": [30, 14, 7],
    "expectDKIM": false
  }
]"""
```

> Nota: `mailFrom` no tiene que pertenecer al dominio monitoreado, pero sí debe ser un remitente verificado en tu cuenta de Resend.

<br>

## 🚀 Deploy

    npx wrangler deploy

La landing se sirve en **https://dns.transistemas.org** (dominio custom configurado en `wrangler.toml`). El cron (`*/10 * * * *`) corre a la par; desplegás una vez y listo.

<br>

## 🧪 Prueba rápida

Crear un registro DNS de prueba en cualquiera de los dominios monitoreados:

- Tipo: `TXT`
- Nombre: `dns-test`
- Contenido: `test`

Deberías recibir un correo en el `mailTo` configurado para ese dominio en un tiempo máximo de 10 minutos, incluyendo la sección "Quién lo cambió" (si el token tiene `Zone → Logs → Read`).

Para disparar el cron manualmente en desarrollo:

    npx wrangler dev --test-scheduled
    curl "http://localhost:8787/__scheduled?cron=*/10+*+*+*+*"

> Los checks diarios (vencimiento, email, DNSSEC) corren una vez cada 24 h. Para forzarlos en el primer deploy, borra las claves `last_expiry_ts_<zoneId>`, `last_email_ts_<zoneId>` y `last_dnssec_ts_<zoneId>` del KV (o simplemente espera a la primera corrida diaria).

<br>

## 🔍 Logs

    npx wrangler tail

<br>

## ⚡ Funciones

- `scheduled(event, env, ctx)`: Punto de entrada del Worker programado; dispara la ejecución periódica de `runCheck` usando el cron configurado. Garantiza que la verificación corra en background con `ctx.waitUntil`.

- `runCheck(env)`: Orquesta la corrida completa: heartbeat de corridas perdidas, chequeo de cada dominio, recuperación de errores, ping a Healthchecks.io y envío de alertas globales. Si un dominio falla, el error se registra y el resto continúa.

- `getDomains(env)`: Lee y valida la variable `DOMAINS` (acepta JSON string o array ya parseado) y devuelve la lista de dominios.

- `checkDomain(env, domain)`: Orquesta el flujo de un solo dominio: DNS internos, nameservers externos, audit logs (si hubo diff DNS) y los checks diarios con control de frescura por timestamps en KV. Devuelve las secciones de alerta del dominio.

- `fetchAuditSection(env, domain)`: Consulta los Audit Logs de la zona desde el cursor guardado en KV, filtra eventos `dns_record.*` y extrae `email`, `acción` y `fecha` de cada autor. Avanza el cursor solo si la consulta fue exitosa; ante 403 (sin permiso) se omite sin romper el flujo.

- `checkMissedRuns(env)`: Heartbeat interno. Marca `last_run_ts` en KV y, si la corrida anterior superó los 25 min de antigüedad, genera una alerta de "corridas perdidas" (cubre fallos silenciosos del cron).

- `pingHealthchecks(env)`: Hace ping a `HEALTHCHECKS_URL` (si está configurada) al final de cada corrida exitosa — watchdog externo que cubre la muerte total del Worker.

- `recordDomainError(env, domain)` / `clearDomainError(env, domain)`: Llevan un contador de errores consecutivos por dominio en KV. Alerta al llegar a 3 (y cada 3 corridas siguientes); avisa "Dominio recuperado" cuando vuelve a funcionar.

- `checkDomainExpiry(env, domain)`: Consulta RDAP (`rdap.org/domain/...`) para obtener la fecha de expiración real del dominio y alerta al cruzar cada umbral de `expiryAlertDays`. Detecta renovaciones y avisa cuando la fecha cambia con una alerta activa. También alerta cuando **cambia el registrador** y cuando aparecen **estados críticos** (`pendingDelete`, `redemptionPeriod`, `clientHold`).

- `checkEmailRecords(env, domain)`: Verifica vía DoH los registros MX, SPF (faltante/duplicado/sin `all`/más de 10 DNS lookups según RFC 7208), DMARC (faltante/`p=none`/duplicado/sin `rua`/`ruf`) y DKIM (selectores comunes). Alerta **solo cuando el estado cambia** respecto al snapshot en KV, no cada día.

- `checkDnssec(env, domain)`: Compara el estado DNSSEC de Cloudflare (`active/pending/disabled` + DS esperado) con los registros DS públicos vía DoH. Detecta DS no propagado, DS huérfano y mismatch de DS.

- `checkCaa(env, domain)`: Consulta los registros CAA (tipo 257) vía DoH y alerta ante cambios. Con `expectCAA: true`, avisa una vez si no existen registros CAA.

- `checkWeb(env, domain)`: Con `expectWeb: true`, hace fetch a `https://<dominio>` (timeout 15 s) y alerta cuando el sitio deja/resume de responder o cambia su estado HTTP.

- `checkNsConsistency(env, domain)`: Compara los registros NS devueltos por 1.1.1.1 (Cloudflare) y 8.8.8.8 (Google) y alerta si los resolvers no coinciden — posible secuestro o fragmentación de DNS.

- `checkHttpsRecord(env, domain)`: Sigue el registro HTTPS (SVCB, tipo 65) del apex vía DoH y alerta ante cambios.

- `dohQuery(name, type)`: Helper de consultas DNS sobre HTTPS (Cloudflare DNS JSON) usado por los checks de nameservers, email y DNSSEC.

- `fetchAllDnsRecords(zoneId, apiToken)`: Consulta la API de Cloudflare paginando todos los registros DNS de la zona.

- `normalizeRecords(records)`: Normaliza los registros DNS a un formato reducido y ordenado para compararlos de forma determinista.

- `diffRecords(previous, current)`: Calcula las diferencias entre snapshots (creados, eliminados, modificados) y expone `hasChanges`.

- `buildEmailBody(zoneName, sections)`: Construye el cuerpo del email a partir de secciones genéricas `{title, lines}` (DNS diff, NS diff, vencimiento, email, DNSSEC, audit, heartbeat).

- `sendEmail(env, { from, to, subject, body })`: Envía el correo de notificación usando la API de Resend.

<br>

## 🛡️ Seguridad

Este repositorio **no contiene secretos**.  
Los tokens se manejan exclusivamente con:

    npx wrangler secret put ...

El `.gitignore` evita accidentalmente subir variables, logs o credenciales.

<br>

## 📝 Licencia

MIT.
Se puede usar este Worker para monitorear cualquier dominio: cambios DNS, nameservers, vencimiento, registros de email, DNSSEC y salud del monitor.

<br>

---

_🌈 Creado con orgullo por el Equipo de Desarrollo de Transistemas ❤_
