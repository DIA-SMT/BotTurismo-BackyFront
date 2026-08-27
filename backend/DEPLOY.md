# 🚀 Guía de Despliegue — Bot Turismo SMT (WhatsApp Cloud API)

> ⚠️ Migrado de ManyChat a la **WhatsApp Cloud API de Meta** (agosto 2026).
> Desplegado en el VPS nuevo el 25/08/2026. El VPS es COMPARTIDO con otros
> proyectos del equipo (panel en :3001): el Nginx del bot es un
> `location /turismo/` dentro de `/etc/nginx/sites-available/panel`.

## Datos del Servidor

| Campo | Valor |
|-------|-------|
| **IP** | `195.35.42.168` (Hostinger) |
| **Dominio** | `srv1915283.hstgr.cloud` (hostname del VPS, con SSL de Let's Encrypt) |
| **Ruta en VPS** | `/var/www/bots/bot-turismo/backend/` |
| **Puerto** | `3000` (loopback, detrás de Nginx) |
| **Proceso PM2** | `bot-turismo-smt` |
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

```bash
# En el VPS:
apt update && apt install -y nodejs npm nginx certbot python3-certbot-nginx
npm install -g pm2

mkdir -p /var/www/bots
cd /var/www/bots
git clone <URL_REPO> bot-turismo
cd bot-turismo/backend
npm install

# Crear el .env con TODAS las variables (ver .env.example)
nano .env

pm2 start ecosystem.config.js --name bot-turismo-smt
pm2 save && pm2 startup
```

Nginx: bloque `location /turismo/` que haga proxy a `http://localhost:3000/`,
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
pm2 logs bot-turismo-smt   # ver el flujo en vivo
```

Prueba local sin Meta (pipeline de IA):
```bash
npm run dev
node test_curl.js "¿qué salidas hay este sábado?"
```

---

## Requisitos en Supabase

- Correr `supabase_bot_migration.sql` (memoria conversacional persistente).
- Las tablas del bus (`tourist_circuits`, `tourist_departures`, `tourist_bookings`),
  `faqs` y `tourist_interactions` ya existen: el bot las lee/escribe directo.

## Actualizar el bot (deploy rápido)

```bash
ssh usuario@VPS
cd /var/www/bots/bot-turismo/backend
git pull origin main
npm install          # solo si cambiaron dependencias
pm2 restart bot-turismo-smt
```

## Notas

- **Ventana de 24 h**: la Cloud API solo permite mensajes de texto libres dentro
  de las 24 h posteriores al último mensaje del usuario. Como este bot siempre
  *responde* (nunca inicia conversaciones), no afecta el flujo actual. Para
  campañas salientes harían falta plantillas aprobadas.
- **Costos**: desde 2025/2026 Meta cobra por plantillas salientes; las
  conversaciones de servicio (responder al usuario) son gratuitas.
- El archivo `.env` **no está en Git**. Cambios locales → copiarlos a mano al VPS.
