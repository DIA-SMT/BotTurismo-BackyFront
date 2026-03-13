const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE credentials in .env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fetchActiveFAQs() {
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('activo', true);

    if (error) throw error;
    
    // Agrupar por categoría
    const catLabels = {
      excursiones:'EXCURSIONES', transporte:'TRANSPORTE', gastronomia:'GASTRONOMÍA',
      alojamiento:'ALOJAMIENTO', atracciones:'ATRACCIONES', servicios:'SERVICIOS',
      nocturna:'VIDA NOCTURNA', salud:'SALUD', compras:'COMPRAS', festivales:'FESTIVALES', general:'GENERAL'
    };
    
    const groups = {};
    (data || []).forEach(f => {
      const cat = f.categoria || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    });

    return Object.entries(groups).map(([cat, items]) => {
      const label = catLabels[cat] || cat.toUpperCase();
      const qs = items.map(f => `  P: ${f.pregunta}\n  R: ${f.respuesta}`).join('\n');
      return `[${label}]\n${qs}`;
    }).join('\n\n');

  } catch (err) {
    console.error('Error fetching FAQs:', err);
    return '';
  }
}

async function logInteraction(logData) {
  try {
    const { error } = await supabase
      .from('tourist_interactions')
      .insert([{
        chat_id: logData.chat_id || null,
        user_name: logData.user_name || null,
        intent: logData.intent || 'consulta_general',
        language: logData.language || 'es',
        origen_provincia: logData.origen_provincia || null,
        medio_transporte: logData.medio_transporte || null,
        query_text: logData.query_text || null,
        bot_response: logData.bot_response || null,
        has_photo: logData.has_photo || false,
        budget: logData.budget || null,
        live_chat_url: logData.live_chat_url || null
      }]);
    if (error) throw error;
  } catch (err) {
    console.error('Error logging interaction:', err);
  }
}

// ── Manejo de Memoria DINÁMICA (In-Memory) ──
// Usamos un Map simple. Se borra si reinicias el server, pero es "dinámico" como pediste.
const dynamicMemory = new Map();

async function getChatHistory(subscriberId, limit = 6) {
  const history = dynamicMemory.get(String(subscriberId)) || [];
  return history.slice(-limit);
}

async function saveChatMessage(subscriberId, role, content) {
  const id = String(subscriberId);
  if (!dynamicMemory.has(id)) {
    dynamicMemory.set(id, []);
  }
  const history = dynamicMemory.get(id);
  history.push({ role, content });
  
  // Limitar a los últimos 20 mensajes para no saturar la RAM
  if (history.length > 20) {
    dynamicMemory.set(id, history.slice(-20));
  }
}

module.exports = { supabase, fetchActiveFAQs, logInteraction, getChatHistory, saveChatMessage };
