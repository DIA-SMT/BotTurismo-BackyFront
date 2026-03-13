#!/bin/bash
# Script Maestro de Preparación VPS Multi-Bot 🚀

# 1. Actualización e Instalación de Core
echo "📦 Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

echo "🐢 Instalando Node.js v20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "🚀 Instalando PM2, Git y Nginx..."
sudo npm install -g pm2
sudo apt install -y nginx git certbot python3-certbot-nginx -y

# 2. Estructura de Carpetas Multi-Bot
echo "📂 Creando estructura de carpetas (/var/www/bots)..."
sudo mkdir -p /var/www/bots
sudo chown -R $USER:$USER /var/www/bots

# 3. Firewall (UFW)
echo "🛡️ Configurando Firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw --force enable

echo "✅ VPS preparada para múltiples bots."
echo "Próximo paso: Clonar cada bot en /var/www/bots/nombre-del-bot"
