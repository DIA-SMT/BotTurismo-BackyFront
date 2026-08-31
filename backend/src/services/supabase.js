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

// ── Memoria conversacional PERSISTENTE (tabla bot_chat_messages) ──
// Si la tabla todavía no existe (migración pendiente), cae a memoria RAM
// para que el bot siga funcionando.
const dynamicMemory = new Map();
let persistentMemoryAvailable = true;

async function getChatHistory(chatId, limit = 6) {
  const id = String(chatId);

  if (persistentMemoryAvailable) {
    try {
      const { data, error } = await supabase
        .from('bot_chat_messages')
        .select('role, content')
        .eq('chat_id', id)
        .order('id', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).reverse();
    } catch (err) {
      console.warn('Memoria persistente no disponible (¿falta supabase_bot_migration.sql?). Usando RAM.', err.message);
      persistentMemoryAvailable = false;
    }
  }

  const history = dynamicMemory.get(id) || [];
  return history.slice(-limit);
}

async function saveChatMessage(chatId, role, content) {
  const id = String(chatId);
  if (!content) return;

  if (persistentMemoryAvailable) {
    try {
      const { error } = await supabase
        .from('bot_chat_messages')
        .insert([{ chat_id: id, role, content }]);
      if (error) throw error;
      return;
    } catch (err) {
      console.warn('No se pudo guardar en memoria persistente. Usando RAM.', err.message);
      persistentMemoryAvailable = false;
    }
  }

  if (!dynamicMemory.has(id)) dynamicMemory.set(id, []);
  const history = dynamicMemory.get(id);
  history.push({ role, content });
  if (history.length > 20) dynamicMemory.set(id, history.slice(-20));
}

// ── Bus Turístico en tiempo real ──
// Resume el catálogo de circuitos activos y las próximas salidas con cupos
// para inyectarlo en el prompt del agente. Es la misma base que usa la web.
async function fetchTouristBusSummary() {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const horizon = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

    const [circuitsResult, departuresResult] = await Promise.all([
      supabase
        .from('tourist_circuits')
        .select('slug, name_es, summary_es, schedule_es, duration_es')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('tourist_departures')
        .select('id, circuit_slug, title, departure_date, departure_time, capacity')
        .eq('status', 'active')
        .gte('departure_date', today)
        .lte('departure_date', horizon)
        .order('departure_date', { ascending: true })
        .order('departure_time', { ascending: true })
    ]);

    if (circuitsResult.error) throw circuitsResult.error;
    if (departuresResult.error) throw departuresResult.error;

    const circuits = circuitsResult.data || [];
    const departures = departuresResult.data || [];

    // Cupos restantes por salida
    let remainingById = {};
    if (departures.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('tourist_bookings')
        .select('departure_id, people_count')
        .in('departure_id', departures.map(d => d.id))
        .eq('status', 'confirmed');
      if (bookingsError) throw bookingsError;

      const reserved = {};
      (bookings || []).forEach(b => {
        reserved[b.departure_id] = (reserved[b.departure_id] || 0) + b.people_count;
      });
      departures.forEach(d => {
        remainingById[d.id] = Math.max(d.capacity - (reserved[d.id] || 0), 0);
      });
    }

    const circuitNames = {};
    circuits.forEach(c => { circuitNames[c.slug] = c.name_es; });

    const catalogText = circuits
      .map(c => {
        const parts = [`• ${c.name_es}`];
        if (c.summary_es) parts.push(`— ${c.summary_es}`);
        if (c.schedule_es) parts.push(`(${c.schedule_es})`);
        return parts.join(' ');
      })
      .join('\n');

    const upcoming = departures.filter(d => (remainingById[d.id] ?? 0) > 0).slice(0, 12);
    const departuresText = upcoming.length > 0
      ? upcoming.map(d => {
          const name = (d.circuit_slug && circuitNames[d.circuit_slug]) || d.title;
          const [year, month, day] = String(d.departure_date).split('-');
          const time = String(d.departure_time).slice(0, 5);
          const remaining = remainingById[d.id];
          return `• ${name}: ${day}/${month}/${year} a las ${time} h — quedan ${remaining} lugares`;
        }).join('\n')
      : 'Por el momento no hay salidas con inscripción abierta publicadas. Recomendá consultar la página de reservas o la Oficina de Turismo.';

    return `CIRCUITOS DISPONIBLES:\n${catalogText}\n\nPRÓXIMAS SALIDAS CON CUPO (datos en tiempo real, la reserva es GRATUITA y se hace online):\n${departuresText}`;
  } catch (err) {
    console.error('Error fetching tourist bus summary:', err.message);
    return 'No se pudo consultar la información de salidas en este momento. Recomendá visitar la página oficial de reservas o la Oficina de Turismo (Congreso de Tucumán 141).';
  }
}

module.exports = { supabase, fetchActiveFAQs, logInteraction, getChatHistory, saveChatMessage, fetchTouristBusSummary };
