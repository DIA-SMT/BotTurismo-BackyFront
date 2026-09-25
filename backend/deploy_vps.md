# Guía de Despliegue Multi-Bot en VPS 🚀

Seguí este método para tener una infraestructura escalable en tu IP `77.37.126.249`.

### 1. Preparar el Servidor (Una sola vez)
Conectate por SSH y ejecutá este bloque para instalar todo lo necesario:
```bash
# Instalación de herramientas base
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git pm2 certbot python3-certbot-nginx -y

# Organización de carpetas
sudo mkdir -p /var/www/bots
sudo chown -R $USER:$USER /var/www/bots
```

### 2. Desplegar un nuevo Bot (Ej: turismo)
Por cada bot que quieras agregar, hacés esto:
```bash
cd /var/www/bots
git clone <URL_REPO> bot-turismo
cd bot-turismo/backend
npm install
nano .env # Pegás tus claves y te asegurás que el PORT sea 3000
```

### 3. Encender con PM2 (Multiproceso)
```bash
pm2 start ecosystem.config.js --name bot-turismo
pm2 save
pm2 startup
```

### 4. Configurar Nginx para Multi-Bot
Para cada bot, creamos un archivo de configuración separado:
`sudo nano /etc/nginx/sites-available/bot-turismo`

**Ejemplo si usás subdominios (Recomendado):**
```nginx
server {
    listen 80;
    server_name turismo.tudominio.com; # Cambialo por tu subdominio

    location / {
        proxy_pass http://localhost:3000; # El puerto del bot específico
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Ejemplo si usás la misma IP con diferentes rutas:**
*(Configurar en el archivo /etc/nginx/sites-available/default)*
```nginx
location /turismo/ {
    proxy_pass http://localhost:3000/;
}
location /vecino/ {
    proxy_pass http://localhost:3001/;
}
```

### 5. Activar y HTTPS
```bash
sudo ln -s /etc/nginx/sites-available/bot-turismo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d turismo.tudominio.com
```

### 6. Bot de Telegram (proceso aparte)
El bot de Telegram vive en el mismo backend (comparte agente, Supabase y métricas) pero corre como otro proceso de PM2. Usa long polling: **no necesita nginx, dominio ni puerto**.

```bash
cd /var/www/bots/bot-turismo
git pull
cd backend
npm install
nano .env   # agregar TELEGRAM_BOT_TOKEN=<token completo de @BotFather>

# Probar el arranque a mano (Ctrl+C para cortar). Tiene que decir "escuchando como @...".
node src/telegram.js

# Levantar SOLO el bot de Telegram, sin reiniciar el de WhatsApp
pm2 start ecosystem.config.js --only bot-turismo-telegram
pm2 save
pm2 logs bot-turismo-telegram --lines 30 --nostream
```

- `--only` es importante: `pm2 start ecosystem.config.js` a secas intentaría levantar también el backend de WhatsApp.
- Solo puede haber **una** instancia por token. Si da error 409, ya hay otra corriendo: `pm2 restart bot-turismo-telegram` en vez de levantar otra.
- Para actualizarlo después: `pm2 restart bot-turismo-telegram` (no toca el de WhatsApp).
- En el dashboard, las conversaciones de Telegram aparecen con `chat_id` `tg:<id>`.
