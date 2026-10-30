# 🚀 Guía de Despliegue — Bot Turismo SMT (WhatsApp Cloud API)

> ⚠️ Migrado de ManyChat a la **WhatsApp Cloud API de Meta** (agosto 2026).
> Desplegado en el VPS nuevo el 25/08/2026. El VPS es COMPARTIDO con otros
> proyectos del equipo (panel en :3001): el Nginx del bot es un
> `location /turismo/` dentro de `/etc/nginx/sites-available/panel`.
>
> Desde el 30/10/2026 el bot corre junto con el sitio bajo el usuario `turismo`
> (`/srv/turismo`) y se despliega con el mismo script. La carpeta vieja
> `/var/www/bots/bot-turismo` queda sólo como respaldo.

## Datos del Servidor

| Campo | Valor |
|-------|-------|
| **IP** | `195.35.42.168` (Hostinger) |
| **Dominio** | `srv1915283.hstgr.cloud` (hostname del VPS, con SSL de Let's Encrypt) |
| **Ruta en VPS** | `/srv/turismo/actual/backend/` (usuario `turismo`) |
| **`.env`** | `/srv/turismo/compartido/backend.env` (fuera de las versiones) |
| **Puerto** | `3000` (loopback, detrás de Nginx) |
| **Procesos PM2** | `turismo-bot` (WhatsApp + chat web) y `turismo-telegram`, en el pm2 del usuario `turismo` |
| **Webhook URL** | `https://srv1915283.hstgr.cloud/turismo/api/webhook/whatsapp` |
| **Número del bot** | `+54 9 381 389-8033` ("Migue Turista") |
| **Acceso SSH** | solo por clave (`id_ed25519_botturismo_vps`) |

---

## 1. Configurar WhatsApp Cloud API (una sola vez, en Meta)

1. Entrar a [developers.facebook.com](https://developers.facebook.com) con la cuenta Business del municipio → **Crear App** → tipo "Business".
2. Agregar el producto **WhatsApp** a la app.
3. En *WhatsApp → Configuración de API*:
   - Registrar el **número de teléfono** del bot (si era el de ManyChat, primero hay que desconectarlo de allí).
   - Copiar el **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
4. Crear un **token permanente**: Meta Business Suite → Configuración del negocio → Usuarios del sistema → crear system user (admin) → generar token con permisos `whatsapp_business_messaging` y `whatsapp_business_management` → `WHATSAPP_TOKEN`.
5. En *Configuración de la app → Básica*: copiar el **App Secret** → `WHATSAPP_APP_SECRET`.
6. Inventar un string secreto propio → `WHATSAPP_VERIFY_TOKEN` (se usa en el paso 3 del deploy).

## 2. Desplegar en el VPS

El sitio y el bot salen del mismo repo y se despliegan juntos. Cada despliegue
es una carpeta nueva en `/srv/turismo/versiones/`, y `/srv/turismo/actual`
apunta a la que está viva:

```bash
# En el VPS, como root (por defecto, rama main):
/srv/turismo/desplegar.sh
```

El script clona, instala, compila, mueve `actual` y hace `pm2 reload` de los
tres procesos de `/srv/turismo/ecosystem.config.js`. Para volver atrás, apuntá
`actual` a la versión anterior y hacé `sudo -u turismo -H pm2 reload all`.

Nginx: bloque `location /turismo/` que haga proxy a `http://127.0.0.1:3000/`,
y `certbot --nginx -d DOMINIO` para el SSL (Meta exige HTTPS).

## 3. Conectar el webhook en Meta

En *WhatsApp → Configuración → Webhook*:
- **URL de callback**: `https://DOMINIO/turismo/api/webhook/whatsapp`
- **Verify token**: el mismo string que pusiste en `WHATSAPP_VERIFY_TOKEN`
- Al guardar, Meta hace un GET de verificación (el server responde solo).
- **Suscribirse al campo `messages`** (imprescindible).

## 4. Probar

```bash
# Salud del server
curl https://DOMINIO/turismo/health

# Y desde un WhatsApp real: mandar "hola" al número del bot.
sudo -u turismo -H pm2 logs turismo-bot   # ver el flujo en vivo
```

Prueba local sin Meta (pipeline de IA):
```bash
npm run dev
node test_curl.js "¿qué salidas hay este sábado?"
```

---

## Base de datos

El bot usa la misma base PostgreSQL que el sitio (`DATABASE_URL` en
`backend.env`; ver `db/README.md`). Lee `faqs` y las tablas del bus
(`tourist_circuits`, `tourist_departures`, `tourist_bookings`), guarda la
memoria conversacional en `bot_chat_messages` y las analíticas en
`tourist_interactions`.

## Actualizar el bot

Con el mismo despliegue del sitio: `/srv/turismo/desplegar.sh`. Para
reiniciar sólo el bot, sin desplegar: `sudo -u turismo -H pm2 restart turismo-bot`.

## Chat web de Migue (widget del sitio)

El sitio del Bus Turístico muestra a Migue en un chat flotante. Usa el mismo
proceso `turismo-bot` (no es un proceso nuevo) por el endpoint
`POST https://DOMINIO/turismo/api/chat/web`. En el panel, esas conversaciones
aparecen como canal **Web** (`chat_id` `web:<uuid>`).

1. **Backend (VPS)**: ya viene en cada despliegue.
2. **`backend.env` del VPS**: `PUBLIC_SITE_URL=https://busturistico.smt.gob.ar` (de ahí
   sale el origen permitido). Si el sitio se abre desde otros dominios, listarlos en
   `WEB_CHAT_ALLOWED_ORIGINS` separados por coma. Los topes anti-abuso
   (`WEB_CHAT_MAX_*`) tienen valores por defecto; ver `.env.example`.
3. **nginx**: dentro del `location /turismo/` de `/etc/nginx/sites-available/panel`
   agregar `client_max_body_size 10m;` (fotos y notas de voz; el default de nginx
   es 1 MB y cortaría casi todas). En ese mismo bloque tienen que estar (hoy ya están):
   - `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`: el límite
     por IP usa la IP real del turista. Sin esta línea, todo el sitio compartiría
     un solo cupo y cualquiera podría saltearlo inventando el header.
   - `proxy_read_timeout 90s;`: el backend corta a los 75 s con un mensaje claro;
     con el default de nginx (60 s) el turista vería un error de conexión.

   Verificar con `nginx -T 2>/dev/null | grep -A20 'location /turismo/'` y
   después `nginx -t && systemctl reload nginx`.
4. `sudo -u turismo -H pm2 restart turismo-bot` y probar:
   ```bash
   curl -X POST https://DOMINIO/turismo/api/chat/web \
     -H 'Content-Type: application/json' -H 'Origin: https://busturistico.smt.gob.ar' \
     -d '{"sessionId":"11111111-2222-4333-8444-555555555555","kind":"text","text":"hola"}'
   ```
5. **Sitio**: variable `NEXT_PUBLIC_MIGUE_CHAT_URL=https://DOMINIO/turismo/api/chat/web`
   en `/srv/turismo/compartido/.env` y desplegar de nuevo (se lee al compilar). Sin esa variable el widget no aparece, así que
   conviene publicarla recién con el backend actualizado.

## Notas

- **Ventana de 24 h**: la Cloud API solo permite mensajes de texto libres dentro
  de las 24 h posteriores al último mensaje del usuario. Como este bot siempre
  *responde* (nunca inicia conversaciones), no afecta el flujo actual. Para
  campañas salientes harían falta plantillas aprobadas.
- **Costos**: desde 2025/2026 Meta cobra por plantillas salientes; las
  conversaciones de servicio (responder al usuario) son gratuitas.
- El archivo `.env` **no está en Git**. Cambios locales → copiarlos a mano al VPS.
