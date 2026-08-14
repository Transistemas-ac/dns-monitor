# 👁️ DNS Monitor - Cloudflare Worker

### Notificaciones por email ante cualquier cambio en los registros DNS o nameservers de uno o más dominios

Este proyecto implementa un **Cloudflare Worker con cron** que monitorea:

- cambios en los registros DNS internos (Cloudflare)
- cambios en los nameservers reales del dominio (DNS over HTTPS)

Y envía un correo automático cuando detecta cualquier diferencia. Puede monitorear **múltiples dominios**, cada uno con su propio correo destinatario.

<br>

## 🚀 Funcionamiento

1. El Worker se ejecuta cada 10 minutos.
2. Obtiene los registros DNS internos por API de Cloudflare.
3. Obtiene los nameservers reales de cada dominio vía DoH (Cloudflare DNS JSON).
4. Compara ambos estados con snapshots almacenados en KV.
5. Si hay cambios, envía un correo detallado.
6. Actualiza snapshots.

<br>

## 🔧 Requisitos previos

- Cloudflare Workers habilitado
- Acceso a los dominios a monitorear en Cloudflare
- Cuenta en **Resend**
- Dominio(s) verificados en Resend (el remitente `mailFrom` debe estar verificado)
- Token de Cloudflare con permisos sobre **todas** las zonas a monitorear:
  - `Zone → DNS → Read`
  - `Zone → Zone → Read`

<br>

## ⚙️ Instalación

    npm install

Crear el namespace de KV:

    npx wrangler kv namespace create DNS_MONITOR
    npx wrangler kv namespace create DNS_MONITOR --preview

Configurar los secretos:

    npx wrangler secret put CF_API_TOKEN
    npx wrangler secret put RESEND_API_KEY

Editar `wrangler.toml`:

- `id` y `preview_id` reales del KV
- la variable `DOMAINS` con la lista de dominios a monitorear (JSON array)

> ⚠️ **Importante:** la variable `DOMAINS` viene configurada por defecto con los valores de **transistemas.org** como ejemplo. Debes reemplazarla con **tu propio dominio** y **tus propios correos** antes de desplegar.

Formato de `DOMAINS` — por cada dominio:

| Campo      | Descripción                                           |
| ---------- | ----------------------------------------------------- |
| `zoneId`   | ID de la zona en Cloudflare                           |
| `zoneName` | El dominio a monitorear                               |
| `mailTo`   | Destinatario de las alertas                           |
| `mailFrom` | Remitente (debe estar verificado en tu cuenta Resend) |

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
    "mailFrom": "dns@example.org"
  }
]"""
```

> Nota: `mailFrom` no tiene que pertenecer al dominio monitoreado, pero sí debe ser un remitente verificado en tu cuenta de Resend.

<br>

## 🚀 Deploy

    npx wrangler deploy

<br>

## 🧪 Prueba rápida

Crear un registro DNS de prueba en cualquiera de los dominios monitoreados:

- Tipo: `TXT`
- Nombre: `dns-test`
- Contenido: `test`

Deberías recibir un correo en el `mailTo` configurado para ese dominio en un tiempo máximo de 10 minutos.

<br>

## 🔍 Logs

    npx wrangler tail

<br>

## ⚡ Funciones

- `scheduled(event, env, ctx)`: Punto de entrada del Worker programado; dispara la ejecución periódica de `runCheck` usando el cron configurado. Garantiza que la verificación de DNS corra en background con `ctx.waitUntil`.

- `runCheck(env)`: Lee la lista de dominios desde `DOMAINS` y ejecuta el chequeo de cada uno. Si un dominio falla, el error se registra en logs y el resto continúa.

- `getDomains(env)`: Parsea y valida la variable `DOMAINS` (acepta JSON string o array ya parseado) y devuelve la lista de dominios con `zoneId`, `zoneName`, `mailTo` y `mailFrom`.

- `checkDomain(env, domain)`: Orquesta el flujo de monitoreo de un solo dominio: obtiene DNS internos y nameservers externos, calcula diferencias con el estado previo y decide si debe enviar un correo de alerta.

- `fetchAllDnsRecords(zoneId, apiToken)`: Consulta la API de Cloudflare paginando todos los registros DNS de la zona. Devuelve un array completo con los registros actuales para usarlos como snapshot.

- `normalizeRecords(records)`: Normaliza los registros DNS a un formato reducido y ordenado. Esto permite compararlos de forma determinista entre ejecuciones para detectar cambios reales.

- `diffRecords(previous, current)`: Calcula las diferencias entre el snapshot anterior y el actual, clasificando registros en creados, eliminados y modificados. Expone una marca `hasChanges` para simplificar la lógica de decisión.

- `buildEmailBody(diffDNS, diffNS, zoneName)`: Construye el cuerpo de texto del email de alerta con un resumen legible de todos los cambios detectados. Incluye detalles de registros nuevos, eliminados y modificados, así como cambios en nameservers.

- `sendEmail(env, { from, to, subject, body })`: Envía el correo de notificación usando la API de Resend. Valida la respuesta HTTP y lanza un error si el envío falla para facilitar el debugging en logs.

<br>

## 🛡️ Seguridad

Este repositorio **no contiene secretos**.  
Los tokens se manejan exclusivamente con:

    npx wrangler secret put ...

El `.gitignore` evita accidentalmente subir variables, logs o credenciales.

<br>

## 📝 Licencia

MIT.
Se puede usar este Worker para monitorear cualquier dominio que necesite alertas por cambios DNS y/o nameservers.

<br>

---

_🌈 Creado con orgullo por el Equipo de Desarrollo de Transistemas ❤_
