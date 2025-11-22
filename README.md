# 👁️ DNS Monitor — Cloudflare Worker

### Notificaciones por email ante cualquier cambio en los registros DNS o nameservers del dominio de Transistemas

Este proyecto implementa un **Cloudflare Worker con cron** que monitorea:

- cambios en los registros DNS internos (Cloudflare)
- cambios en los nameservers reales del dominio (DNS over HTTPS)

Y envía un correo automático a `equipo@transistemas.org` cuando detecta cualquier diferencia.

<br>

## 🚀 Funcionamiento

1. El Worker se ejecuta cada 10 minutos.
2. Obtiene los registros DNS internos por API de Cloudflare.
3. Obtiene los nameservers reales del dominio vía DoH (Cloudflare DNS JSON).
4. Compara ambos estados con snapshots almacenados en KV.
5. Si hay cambios, envía un correo detallado.
6. Actualiza snapshots.

<br>

## 🔧 Requisitos previos

- Cloudflare Workers habilitado
- Acceso al dominio en Cloudflare
- Cuenta en **Resend**
- Dominio verificado en Resend y asociado a Cloudflare
- Token de Cloudflare con permisos:
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

Editar `wrangler.toml` con:

- `id` y `preview_id` reales del KV
- `CF_ZONE_ID` del dominio
- `ZONE_NAME`
- `MAIL_TO` y `MAIL_FROM`

<br>

## 🚀 Deploy

    npx wrangler deploy

<br>

## 🧪 Prueba rápida

Crear un registro DNS de prueba:

- Tipo: `TXT`
- Nombre: `dns-test`
- Contenido: `test`

Deberías recibir un correo en `equipo@transistemas.org` en un tiempo máximo de 10 minutos.

<br>

## 🔍 Logs

    npx wrangler tail

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
