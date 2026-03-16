const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();
const config = {
  host: '77.37.126.249',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync(path.join(__dirname, 'id_rsa_node')),
};

conn.on('ready', () => {
  console.log('✅ Connection Ready. Deploying fix...');
  // 1. Git pull to get latest code from GitHub
  // 2. PM2 restart
  const cmd = `cd /var/www/bots/bot-turismo && git pull origin main && pm2 restart bot-turismo-smt`;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('🎉 Deploy finished with code', code);
      conn.end();
    }).on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).on('error', (err) => {
  console.error('❌ SSH Error:', err);
}).connect(config);
