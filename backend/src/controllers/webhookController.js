const { fetchActiveFAQs, getChatHistory, saveChatMessage, logInteraction } = require('../services/supabase');
const { fetchCulturalEvents } = require('../services/api');
const { sendManychatMessages } = require('../services/manychat');
const { mainAgentProcess } = require('../ai/agent');
const { visionAnalyzeImage } = require('../ai/vision');
const { transcribeAudio } = require('../ai/audio');
const fs = require('fs');
const path = require('path');

async function handleManyChatWebhook(req, res) {
  const startTime = Date.now();
  
  // LOG TEMPORAL PARA DEPUREACIÓN (SOLO LOCAL)
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      body: req.body
    };
    fs.appendFileSync(path.join(__dirname, '../../debug_webhook.log'), JSON.stringify(logEntry, null, 2) + '\n---\n');
  } catch (logErr) {
    console.error("Error writing debug log:", logErr);
  }

  console.log("---- INCOMING WEBHOOK ----");
  console.log("Headers:", req.headers);
  console.log("Body completo:", JSON.stringify(req.body, null, 2));

  const body = req.body || {};
  
  // ID Interno de ManyChat (Numérico, para API calls)
  const subscriberId = body.id || (body.subscriber ? body.subscriber.id : null) || body.subscriber_id;
  
  // Número de Teléfono/WhatsApp (Priorizando whatsapp_phone del log)
  const phoneNumber = body.whatsapp_phone || body.subscriber?.whatsapp_phone || body.subscriber?.whatsapp_id || body.subscriber?.phone || body.subscriber?.subscriber_id || subscriberId;
  
  // 1. Responder rápido con JSON a Manychat para evitar timeouts y permitir mapeo
  res.status(200).json({
    status: 'success',
    subscriber_id: subscriberId,
    phone: phoneNumber
  });

  if (!subscriberId) {
    console.log("⚠️ No se detectó subscriberId en el body!");
    return;
  }

  console.log(`[Webhook] SubscriberId: ${subscriberId}, Phone: ${phoneNumber}`);

  try {
    let lastInputText = body.last_input_text || '';
    const isImage = /\.(jpeg|jpg|png|gif|webp)$/i.test(lastInputText);
    const isAudio = /\.(ogg|mp3|m4a|mp4|wav|aac|amr|wma)($|\?)/i.test(lastInputText);

    let finalResponseJson = null;

    // 2. ¿Es un Audio?
    if (isAudio && lastInputText.startsWith('http')) {
      console.log(`[${subscriberId}] Transcribing audio...`);
      lastInputText = await transcribeAudio(lastInputText);
      console.log(`[${subscriberId}] Transcribed: ${lastInputText}`);
    }

    // 3. ¿Es una Imagen?
    if (isImage && lastInputText.startsWith('http')) {
      console.log(`[${subscriberId}] Processing vision AI...`);
      finalResponseJson = await visionAnalyzeImage(lastInputText);
      
    } else {
      // 4. Obtener Contexto Global
      console.log(`[${subscriberId}] Fetching Context (FAQs & Events)...`);
      const [faqsSummary, eventsSummary, chatHistory] = await Promise.all([
        fetchActiveFAQs(),
        fetchCulturalEvents(),
        getChatHistory(subscriberId, 6) // Últimos 6 mensajes
      ]);

      // 5. Procesar con Agente Principal
      console.log(`[${subscriberId}] Calling Main AI Agent...`);
      finalResponseJson = await mainAgentProcess(
        lastInputText, 
        isImage, 
        faqsSummary, 
        eventsSummary, 
        chatHistory
      );
    }

    console.log(`[${subscriberId}] AI Response generated: "${finalResponseJson.additional_info.substring(0, 100)}..."`);

    // 6. Enviar mensajes a ManyChat (PUSH API - Replicando n8n)
    console.log(`[${subscriberId}] Sending proactive PUSH response to ManyChat API...`);
    
    try {
      await sendManychatMessages(subscriberId, finalResponseJson.additional_info);
    } catch (pushErr) {
      console.error(`[${subscriberId}] Error in ManyChat Push API:`, pushErr.message);
      // Si falla por ventana de 24h, podrías intentar un Flow alternativo aquí si fuera necesario
    }

    // 7. Guardar en Historial (Memoria Conversacional)
    // Solo guardamos si la interacción tuvo texto válido o fue vision
    if (lastInputText && !isImage) await saveChatMessage(subscriberId, 'user', lastInputText);
    if (isImage) await saveChatMessage(subscriberId, 'user', '[El usuario envió una imagen]');
    await saveChatMessage(subscriberId, 'assistant', finalResponseJson.additional_info);

    // 8. Loggear Interacción en Supabase para analíticas
    await logInteraction({
      chat_id: String(phoneNumber).startsWith('+') ? phoneNumber : `+${phoneNumber}`,
      user_name: body.name || body.first_name || '',
      intent: finalResponseJson.intent || 'consulta_general',
      language: finalResponseJson.language || 'es',
      origen_provincia: finalResponseJson.origen_provincia || null,
      medio_transporte: finalResponseJson.medio_transporte || null,
      query_text: lastInputText,
      bot_response: finalResponseJson.additional_info,
      has_photo: finalResponseJson.has_photo || false,
      budget: finalResponseJson.budget || null,
      live_chat_url: body.live_chat_url || ''
    });

    console.log(`[${subscriberId}] Flow finished successfully.`);

  } catch (err) {
    console.error(`[${subscriberId}] Unhandled Webhook Error:`, err);
  }
}

// Helper para formatear mensajes igual que en manychat.js
function formatManyChatMessages(fullText) {
  if (!fullText) return [];
  const MAX_CHARS = 1500;
  let paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) paragraphs = [fullText];

  const chunks = [];
  for (const para of paragraphs) {
    if (para.length <= MAX_CHARS) chunks.push(para.trim());
    else {
      const lines = para.split(/\n/);
      let current = '';
      for (const line of lines) {
        if (current && (current + '\n' + line).length > MAX_CHARS) {
          chunks.push(current.trim());
          current = line;
        } else { current = current ? current + '\n' + line : line; }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }
  return chunks.map(chunk => ({ type: 'text', text: chunk }));
}

module.exports = { handleManyChatWebhook };
