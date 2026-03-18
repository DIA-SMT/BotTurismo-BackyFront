# 🚀 Guía de Despliegue — Bot Turismo SMT

## Datos del Servidor
| Campo | Valor |
|-------|-------|
| **IP** | `77.37.126.249` |
| **Dominio** | `servidoria.smt.gob.ar` |
| **Ruta en VPS** | `/var/www/bots/bot-turismo/backend/` |
| **Puerto** | `3000` |
| **Proceso PM2** | `bot-turismo-smt` |
| **Webhook URL** | `https://servidoria.smt.gob.ar/turismo/api/webhook/manychat` |
| **SSH Key** | `./id_rsa_node` |

---

## Desplegar Cambios (Rápido ⚡)

Desde la carpeta `backend/` del proyecto local:

```bash
# 1. Commitear y pushear a GitHub
git add .
git commit -m "descripción del cambio"
git push origin main

# 2. Conectarse a la VPS y actualizar
ssh -i id_rsa_node root@77.37.126.249

# 3. Ya en la VPS:
cd /var/www/bots/bot-turismo/backend
git pull origin main
npm install        # Solo si cambiaste dependencias
pm2 restart bot-turismo-smt
```

---

## Primer Despliegue (Setup Inicial)

Solo necesario la primera vez en un servidor nuevo:

```bash
# En la VPS como root:
apt update && apt install -y nodejs npm nginx certbot python3-certbot-nginx
npm install -g pm2

mkdir -p /var/www/bots
cd /var/www/bots
git clone <URL_REPO> bot-turismo
cd bot-turismo/backend
npm install

# Crear el archivo .env con las credenciales
nano .env

# Iniciar con PM2
pm2 start ecosystem.config.js --name bot-turismo-smt
pm2 save
pm2 startup
```

---

## Estructura Multi-Bot en la VPS

```
/var/www/bots/
├── bot-turismo/backend/    → Puerto 3000 → /turismo/
├── bot-ambiente/           → Puerto 3001 → /ambiente/
└── (futuros bots...)       → Puerto 300X → /nombre/
```

Nginx enruta cada ruta al puerto correspondiente. La config vive en:
`/etc/nginx/sites-available/servidoria.smt.gob.ar`

---

## Comandos Útiles

```bash
# Ver estado de todos los bots
pm2 list

# Ver logs en vivo
pm2 logs bot-turismo-smt

# Reiniciar
pm2 restart bot-turismo-smt

# Ver config de Nginx
cat /etc/nginx/sites-available/servidoria.smt.gob.ar

# Probar que Nginx está OK antes de reiniciar
nginx -t && systemctl restart nginx
```

---

## ⚠️ Importante
- **Nunca sobrescribir** el archivo de Nginx sin volver a correr `certbot --nginx -d servidoria.smt.gob.ar` después, ya que Certbot inyecta las directivas SSL automáticamente.
- El archivo `.env` **no está en Git** (está en `.gitignore`). Si lo modificás localmente, copialo manualmente a la VPS.
- Si agregás un **nuevo bot**, asignarle un puerto libre (3002, 3003...) y agregar un bloque `location /nombre/` en Nginx.
