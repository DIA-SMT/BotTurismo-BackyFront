const postgres = require('postgres');

// Misma base que el sitio (PostgreSQL de la VPS). Los tipos se leen como los
// devolvía Supabase: date como 'YYYY-MM-DD' y bigint como number.
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 5,
  idle_timeout: 30,
  connect_timeout: 10,
  onnotice: () => {},
  connection: { TimeZone: 'UTC' },
  types: {
    bigint: { to: 20, from: [20], serialize: value => String(value), parse: value => Number(value) },
    date: { to: 1082, from: [1082], serialize: value => value, parse: value => value }
  }
});

async function fetchActiveFAQs() {
  try {
    const data = await sql`select * from faqs where activo = true`;

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
    await sql`
      insert into tourist_interactions ${sql({
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
      })}
    `;
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
      const data = await sql`
        select role, content from bot_chat_messages
        where chat_id = ${id}
        order by id desc
        limit ${limit}
      `;
      return [...data].reverse();
    } catch (err) {
      console.warn('Memoria persistente no disponible (¿falta la tabla bot_chat_messages?). Usando RAM.', err.message);
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
      await sql`insert into bot_chat_messages (chat_id, role, content) values (${id}, ${role}, ${content})`;
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

    const [circuits, departures] = await Promise.all([
      sql`
        select slug, name_es, summary_es, schedule_es, duration_es from tourist_circuits
        where active = true
        order by sort_order asc
      `,
      sql`
        select id, circuit_slug, title, departure_date, departure_time, capacity from tourist_departures
        where status = 'active' and departure_date >= ${today} and departure_date <= ${horizon}
        order by departure_date asc, departure_time asc
      `
    ]);

    // Cupos restantes por salida
    let remainingById = {};
    if (departures.length > 0) {
      const bookings = await sql`
        select departure_id, people_count from tourist_bookings
        where departure_id in ${sql(departures.map(d => d.id))} and status = 'confirmed'
      `;

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

module.exports = { sql, fetchActiveFAQs, logInteraction, getChatHistory, saveChatMessage, fetchTouristBusSummary };
