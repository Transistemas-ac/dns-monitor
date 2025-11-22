# 👁️ DNS Monitor — Cloudflare Worker  
### Notificaciones por email ante cualquier cambio en los registros DNS del dominio de Transistemas

Este proyecto implementa un **Cloudflare Worker con cron** que monitorea los registros DNS del dominio de Transistemas y **envía un email automático** cada vez que detecta:

- creación de un registro  
- eliminación  
- modificación en contenido, TTL o estado de proxy

Usa:

- **Cloudflare Workers**  
- **KV Storage** para snapshots  
- **Cron Triggers** cada 10 minutos  
- **Resend** para el envío de correos  
- **Cloudflare API** para leer los DNS

<br>

## 🚀 Funcionamiento

1. El Worker se ejecuta cada `*/10 * * * *`.
2. Obtiene todos los registros DNS de la zona por API.
3. Los compara con el snapshot previo almacenado en KV.
4. Si hay cambios, envía un correo a `equipo@transistemas.org`.
5. Actualiza el snapshot.


<br>

## 🔧 Requisitos previos

- Cloudflare Workers habilitado  
- Acceso al dominio en Cloudflare  
- Cuenta en **Resend**
- Registro del domino en **Resend**
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

Tail para ver logs:

    npx wrangler tail

Deberías recibir un correo en `equipo@transistemas.org`.

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

MIT. Puedes usar este Worker para monitorear cualquier dominio que necesite alertas por cambios DNS.

<br>

---

_🌈 Creado con orgullo por el Equipo de Desarrollo de Transistemas ❤_

