const axios = require('axios');

// WhatsApp Cloud API (Meta) — reemplaza a ManyChat.
// Requiere en .env:
//   WHATSAPP_TOKEN           token permanente (system user de Meta Business)
//   WHATSAPP_PHONE_NUMBER_ID id del numero en la app de Meta
//   WHATSAPP_VERIFY_TOKEN    string propio para la verificacion del webhook
//   WHATSAPP_APP_SECRET      app secret para validar la firma de los webhooks

const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const api = axios.create({
  baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
  timeout: 15000,
  headers: {
    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

const MAX_CHARS = 1500;

// Divide la respuesta en mensajes cortos (por parrafos), como hacia ManyChat.
function splitIntoChunks(fullText) {
  if (!fullText) return [];
  let paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) paragraphs = [fullText];

  const chunks = [];
  for (const para of paragraphs) {
    if (para.length <= MAX_CHARS) {
      chunks.push(para.trim());
    } else {
      const lines = para.split(/\n/);
      let current = '';
      for (const line of lines) {
        if (current && (current + '\n' + line).length > MAX_CHARS) {
          chunks.push(current.trim());
          current = line;
        } else {
          current = current ? current + '\n' + line : line;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks;
}

async function sendWhatsAppText(to, fullText) {
  const chunks = splitIntoChunks(fullText);

  for (const chunk of chunks) {
    await api.post(`/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: true, body: chunk }
    });
  }
}

// Marca el mensaje como leido (doble tilde azul). Best effort.
async function markMessageAsRead(messageId) {
  try {
    await api.post(`/${PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    });
  } catch (err) {
    console.warn('[WhatsApp] markAsRead failed:', err?.response?.data?.error?.message || err.message);
  }
}

// La media de Cloud API requiere token: primero se pide la URL del media id,
// despues se descarga con el mismo Bearer. Devuelve un data URL base64 para
// pasarle a los modelos multimodales.
async function downloadWhatsAppMedia(mediaId) {
  const { data: meta } = await api.get(`/${mediaId}`);
  const mediaResponse = await axios.get(meta.url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
  });

  const mimeType = meta.mime_type || mediaResponse.headers['content-type'] || 'application/octet-stream';
  const base64 = Buffer.from(mediaResponse.data).toString('base64');

  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64}`
  };
}

module.exports = { sendWhatsAppText, markMessageAsRead, downloadWhatsAppMedia };
