// Simula un webhook de WhatsApp Cloud API contra el server local.
// Uso: node test_curl.js "hola, ¿qué circuitos hay este finde?"
// (Requiere el server corriendo: npm run dev. Sin WHATSAPP_TOKEN configurado,
// el envío de la respuesta va a fallar, pero sirve para probar el pipeline
// de IA y ver la respuesta generada en los logs del server.)
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const text = process.argv[2] || 'Hola! ¿Qué circuitos del bus turístico hay disponibles?';

const payload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '0',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '5493810000000', phone_number_id: 'TEST' },
            contacts: [{ profile: { name: 'Turista de Prueba' }, wa_id: '5493811111111' }],
            messages: [
              {
                from: '5493811111111',
                id: `wamid.test-${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: 'text',
                text: { body: text }
              }
            ]
          }
        }
      ]
    }
  ]
};

axios.post(`http://localhost:${PORT}/api/webhook/whatsapp`, payload)
  .then(res => console.log('Webhook respondió:', res.status, '- mirá los logs del server para ver el flujo.'))
  .catch(err => console.error('Error:', err.message));
