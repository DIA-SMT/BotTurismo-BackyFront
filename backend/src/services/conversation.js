const { fetchActiveFAQs, getChatHistory, saveChatMessage, logInteraction, fetchTouristBusSummary } = require('./supabase');
const { fetchCulturalEvents } = require('./api');
const { mainAgentProcess } = require('../ai/agent');
const { visionAnalyzeImage } = require('../ai/vision');
const { transcribeAudio } = require('../ai/audio');

// Flujo comun a todos los canales (WhatsApp, Telegram). Cada canal solo
// traduce su formato de entrada y sabe enviar texto; el resto vive aca.
//
// input:
//   channel   'whatsapp' | 'telegram'  (se usa en el prompt)
//   chatId    identificador unico entre canales (ej: '+549...' o 'tg:123')
//   userName  nombre visible del usuario
//   kind      'text' | 'audio' | 'image'
//   text      texto del mensaje (kind 'text')
//   mediaDataUrl  data URL base64 del audio o la imagen
//   caption   texto que acompana a la imagen
//   send      async (text) => void  envia la respuesta por el canal
async function processTouristMessage({ channel, chatId, userName = '', kind, text = '', mediaDataUrl, caption = '', send }) {
  let inputText = '';
  let hasPhoto = false;
  let finalResponseJson = null;

  // 1. Normalizar la entrada segun el tipo de mensaje
  if (kind === 'text') {
    inputText = text;
  } else if (kind === 'audio') {
    console.log(`[${chatId}] Audio recibido, transcribiendo...`);
    inputText = await transcribeAudio(mediaDataUrl);
    console.log(`[${chatId}] Transcripción: ${inputText.substring(0, 120)}`);
  } else if (kind === 'image') {
    console.log(`[${chatId}] Imagen recibida, analizando (geo-quiz)...`);
    hasPhoto = true;
    finalResponseJson = await visionAnalyzeImage(mediaDataUrl, caption, channel);
    inputText = caption ? `[Foto] ${caption}` : '[El usuario envió una imagen]';
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
    finalResponseJson = await mainAgentProcess(inputText, hasPhoto, faqsSummary, eventsSummary, busSummary, chatHistory, channel);
  }

  console.log(`[${chatId}] Respuesta generada: "${finalResponseJson.additional_info.substring(0, 100)}..."`);

  // 3. Responder por el canal
  await send(finalResponseJson.additional_info);

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

module.exports = { processTouristMessage };
