const localtunnel = require('localtunnel');
const fs = require('fs');

async function setupTunnel(retryCount = 0) {
    try {
        console.log(`[Túnel] Intentando abrir túnel (Intento ${retryCount + 1})...`);
        const tunnel = await localtunnel({ 
            port: 3000,
            subdomain: 'turismosmt-test' // Intentamos usar un subdominio fijo
        });

        console.log('=========================================');
        console.log('🔗 URL BASE DEL TÚNEL:');
        console.log(tunnel.url);
        console.log('\n🚀 WEBHOOK PARA MANYCHAT:');
        console.log(`${tunnel.url}/api/webhook/manychat`);
        console.log('=========================================');

        fs.writeFileSync('tunnel_url.txt', `${tunnel.url}/api/webhook/manychat`);

        tunnel.on('close', () => {
            console.log('🔴 Túnel cerrado. Reintentando en 5 segundos...');
            setTimeout(() => setupTunnel(retryCount + 1), 5000);
        });

        tunnel.on('error', (err) => {
            console.error('❌ Error en el túnel:', err.message);
        });

    } catch (err) {
        console.error('❌ No se pudo iniciar el túnel:', err.message);
        setTimeout(() => setupTunnel(retryCount + 1), 5000);
    }
}

setupTunnel();
