const crypto = require('crypto');
const { sendWhatsAppText, markMessageAsRead, downloadWhatsAppMedia } = require('../services/whatsapp');
const { processTouristMessage } = require('../services/conversation');

// ── Verificación del webhook (GET de Meta al configurar la app) ──
function verifyWhatsAppWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Verificación de Meta OK');
    return res.status(200).send(challenge);
  }
  console.warn('[Webhook] Verificación de Meta RECHAZADA');
  return res.sendStatus(403);
}

// ── Firma X-Hub-Signature-256: valida que el POST venga realmente de Meta ──
function isValidSignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.warn('[Webhook] WHATSAPP_APP_SECRET no configurado: se acepta sin validar firma (configurarlo en producción).');
    return true;
  }
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !req.rawBody) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Dedupe: Cloud API reintenta webhooks; no procesar dos veces el mismo mensaje ──
const processedMessageIds = new Set();
function alreadyProcessed(messageId) {
  if (!messageId) return false;
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > 2000) {
    // Limpieza simple: conserva los últimos ~1000
    const ids = [...processedMessageIds];
    processedMessageIds.clear();
    for (const id of ids.slice(-1000)) processedMessageIds.add(id);
  }
  return false;
}

async function processIncomingMessage(message, contact) {
  const from = message.from; // teléfono sin '+'
  const chatId = from.startsWith('+') ? from : `+${from}`;
  const userName = contact?.profile?.name || '';

  markMessageAsRead(message.id);

  const base = {
    channel: 'whatsapp',
    chatId,
    userName,
    send: (text) => sendWhatsAppText(chatId, text)
  };

  // Normalizar la entrada según el tipo de mensaje y delegar al flujo común
  if (message.type === 'text') {
    await processTouristMessage({ ...base, kind: 'text', text: message.text?.body || '' });
  } else if (message.type === 'audio' || message.type === 'voice') {
    const media = await downloadWhatsAppMedia(message.audio?.id || message.voice?.id);
    await processTouristMessage({ ...base, kind: 'audio', mediaDataUrl: media.dataUrl });
  } else if (message.type === 'image') {
    const media = await downloadWhatsAppMedia(message.image?.id);
    await processTouristMessage({ ...base, kind: 'image', mediaDataUrl: media.dataUrl, caption: message.image?.caption || '' });
  } else {
    // Stickers, ubicaciones, documentos, etc.
    console.log(`[${chatId}] Tipo de mensaje no soportado: ${message.type}`);
    await sendWhatsAppText(chatId, 'Por ahora entiendo mensajes de texto, notas de voz y fotos de lugares de la ciudad 🏛️. ¡Contame en qué te puedo ayudar!');
  }
}

async function handleWhatsAppWebhook(req, res) {
  if (!isValidSignature(req)) {
    console.warn('[Webhook] Firma inválida: request descartado.');
    return res.sendStatus(403);
  }

  // Responder rápido para que Meta no reintente por timeout
  res.sendStatus(200);

  const body = req.body || {};
  if (body.object !== 'whatsapp_business_account') return;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      // Acuses de entrega/lectura: solo se loguean los fallos (sirve para
      // diagnosticar plantillas que Meta acepta pero no entrega).
      if (value.statuses) {
        for (const status of value.statuses) {
          if (status.status === 'failed') {
            console.error(
              `[Webhook] Mensaje FALLIDO a ${status.recipient_id} (${status.id}):`,
              JSON.stringify(status.errors || []),
            );
          }
        }
        continue;
      }

      const contact = value.contacts?.[0];
      for (const message of value.messages || []) {
        if (alreadyProcessed(message.id)) {
          console.log(`[Webhook] Mensaje ${message.id} ya procesado, se ignora (reintento de Meta).`);
          continue;
        }
        try {
          await processIncomingMessage(message, contact);
        } catch (err) {
          console.error(`[Webhook] Error procesando mensaje ${message.id}:`, err?.response?.data || err.message);
        }
      }
    }
  }
}

module.exports = { verifyWhatsAppWebhook, handleWhatsAppWebhook };
