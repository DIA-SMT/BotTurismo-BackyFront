const crypto = require('crypto');
const { fetchActiveFAQs, getChatHistory, saveChatMessage, logInteraction, fetchTouristBusSummary } = require('../services/supabase');
const { fetchCulturalEvents } = require('../services/api');
const { sendWhatsAppText, markMessageAsRead, downloadWhatsAppMedia } = require('../services/whatsapp');
const { mainAgentProcess } = require('../ai/agent');
const { visionAnalyzeImage } = require('../ai/vision');
const { transcribeAudio } = require('../ai/audio');

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

  let inputText = '';
  let hasPhoto = false;
  let finalResponseJson = null;

  markMessageAsRead(message.id);

  // 1. Normalizar la entrada según el tipo de mensaje
  if (message.type === 'text') {
    inputText = message.text?.body || '';
  } else if (message.type === 'audio' || message.type === 'voice') {
    console.log(`[${chatId}] Audio recibido, transcribiendo...`);
    const media = await downloadWhatsAppMedia(message.audio?.id || message.voice?.id);
    inputText = await transcribeAudio(media.dataUrl);
    console.log(`[${chatId}] Transcripción: ${inputText.substring(0, 120)}`);
  } else if (message.type === 'image') {
    console.log(`[${chatId}] Imagen recibida, analizando (geo-quiz)...`);
    hasPhoto = true;
    const media = await downloadWhatsAppMedia(message.image?.id);
    const caption = message.image?.caption || '';
    finalResponseJson = await visionAnalyzeImage(media.dataUrl, caption);
    inputText = caption ? `[Foto] ${caption}` : '[El usuario envió una imagen]';
  } else {
    // Stickers, ubicaciones, documentos, etc.
    console.log(`[${chatId}] Tipo de mensaje no soportado: ${message.type}`);
    await sendWhatsAppText(chatId, 'Por ahora entiendo mensajes de texto, notas de voz y fotos de lugares de la ciudad 🏛️. ¡Contame en qué te puedo ayudar!');
    return;
  }

  // 2. Si no fue imagen, procesar con el agente principal con todo el contexto
  if (!finalResponseJson) {
    if (!inputText.trim()) return;

    console.log(`[${chatId}] Buscando contexto (FAQs, eventos, bus turístico)...`);
    const [faqsSummary, eventsSummary, busSummary, chatHistory] = await Promise.all([
      fetchActiveFAQs(),
      fetchCulturalEvents(),
      fetchTouristBusSummary(),
      getChatHistory(chatId, 6)
    ]);

    console.log(`[${chatId}] Consultando al agente principal...`);
    finalResponseJson = await mainAgentProcess(inputText, hasPhoto, faqsSummary, eventsSummary, busSummary, chatHistory);
  }

  console.log(`[${chatId}] Respuesta generada: "${finalResponseJson.additional_info.substring(0, 100)}..."`);

  // 3. Responder por WhatsApp
  await sendWhatsAppText(chatId, finalResponseJson.additional_info);

  // 4. Memoria conversacional persistente
  await saveChatMessage(chatId, 'user', inputText);
  await saveChatMessage(chatId, 'assistant', finalResponseJson.additional_info);

  // 5. Log para analíticas del dashboard
  await logInteraction({
    chat_id: chatId,
    user_name: userName,
    intent: finalResponseJson.intent || 'consulta_general',
    language: finalResponseJson.language || 'es',
    origen_provincia: finalResponseJson.origen_provincia || null,
    medio_transporte: finalResponseJson.medio_transporte || null,
    query_text: inputText,
    bot_response: finalResponseJson.additional_info,
    has_photo: hasPhoto,
    budget: finalResponseJson.budget || null,
    live_chat_url: ''
  });

  console.log(`[${chatId}] Flujo completado.`);
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

      // Ignorar acuses de entrega/lectura
      if (value.statuses) continue;

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
