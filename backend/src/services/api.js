const axios = require('axios');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function fetchCulturalEvents() {
  try {
    const startStr = encodeURIComponent(new Date().toISOString().split('.')[0] + "-03:00");
    const endStr = encodeURIComponent(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('.')[0] + "-03:00");
    
    // Mimic browsers to bypass Cloudflare
    const url = `https://comunicacionsmt.gob.ar/get_events?start=${startStr}&end=${endStr}`;
    console.log(`[API] Fetching events from: ${url}`);
    
    // Usamos curl en lugar de axios para evitar el bloqueo Cloudflare
    const { stdout } = await exec(`curl -s "${url}"`, { timeout: 10000 });
    
    let rawResp;
    try {
      rawResp = JSON.parse(stdout);
    } catch (parseErr) {
      console.warn("[API] curl output wasn't valid JSON, fallback to raw string (Cloudflare block?)");
      rawResp = stdout;
    }

    const isCloudflare = typeof rawResp === 'string' || 
                         (rawResp && Object.keys(rawResp).some(k => typeof rawResp[k] === 'string' && rawResp[k].includes('Cloudflare')));
    
    let eventsData = [];
    if (!isCloudflare) {
      if (Array.isArray(rawResp)) eventsData = rawResp;
      else if (rawResp && Array.isArray(rawResp.data)) eventsData = rawResp.data;
      else if (rawResp && Array.isArray(rawResp.events)) eventsData = rawResp.events;
    }

    if (eventsData.length === 0) {
      return 'No se encontraron eventos activos. Recomendá visitar agendaculturalsmt.com';
    }

    const now = new Date();
    const upcoming = eventsData
      .filter(ev => {
        const d = new Date(ev.date || ev.fecha || ev.start_date || now);
        return (d - now) >= -86400000 && (d - now) <= 30 * 86400000;
      })
      .slice(0, 10);

    if (upcoming.length === 0) {
      return 'No hay eventos próximos via API. Recomendá visitar agendaculturalsmt.com';
    }

    return upcoming.map(ev => {
      const nombre = ev.title || 'Evento';
      const fechaInicio = ev.start || '';
      const fechaFin = (Array.isArray(ev.hasta) && ev.hasta.length > 0) ? ev.hasta[0] : '';
      const pathUrl = ev.url || '';
      const fullUrl = pathUrl ? `https://comunicacionsmt.gob.ar${pathUrl}` : '';
      
      const dateObj = fechaInicio ? new Date(fechaInicio) : null;
      const dateStr = dateObj ? dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }) : '';
      const timeStr = dateObj ? dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
      const endTimeStr = fechaFin ? new Date(fechaFin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

      let info = `• ${nombre}`;
      if (dateStr) info += ` — ${dateStr}`;
      if (timeStr) info += ` a las ${timeStr}hs`;
      if (endTimeStr) info += ` (hasta las ${endTimeStr}hs)`;
      if (fullUrl) info += `\nMás info: ${fullUrl}`;
      
      return info;
    }).join('\n\n');

  } catch (e) {
    console.error(`[API] Error fetching events: ${e.code || e.message}`);
    if (e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
      return 'El servicio de Agenda Cultural (comunicacionsmt.gob.ar) no respondió. Por favor, consultá más tarde o visitá agendaculturalsmt.com directamente.';
    }
    return 'No se pudieron obtener eventos en este momento.';
  }
}

module.exports = { fetchCulturalEvents };
