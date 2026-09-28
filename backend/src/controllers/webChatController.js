const { processTouristMessage } = require('../services/conversation');

// Chat de Migue embebido en el sitio web. El navegador manda cada mensaje por
// POST y recibe la respuesta en el mismo request; el flujo (agente, FAQs, bus
// turístico, agenda, memoria y métricas) es el mismo que WhatsApp y Telegram.
//
// Es un endpoint público que consume el modelo, así que se limita por IP, por
// conversación y en total. Los contadores viven en memoria: el backend corre
// como un único proceso de PM2.

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_CHARS = 1000;
const MAX_CAPTION_CHARS = 500;
const MAX_MEDIA_BYTES = 6 * 1024 * 1024;

// El widget manda fotos en JPEG y audio en WAV; se aceptan también los formatos
// que Gemini entiende sin conversión.
const MEDIA_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mpeg']
};
const DATA_URL_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

function envInt(name, fallback) {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const LIMITS = {
  ipPerMinute: envInt('WEB_CHAT_MAX_PER_IP_MINUTE', 8),
  ipPerHour: envInt('WEB_CHAT_MAX_PER_IP_HOUR', 60),
  sessionPerHour: envInt('WEB_CHAT_MAX_PER_SESSION_HOUR', 40),
  globalPerHour: envInt('WEB_CHAT_MAX_GLOBAL_HOUR', 1000)
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Ventana deslizante: por cada clave, los instantes de los últimos pedidos.
const hits = new Map();

function recentHits(key, windowMs, now) {
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length) hits.set(key, list);
  else hits.delete(key);
  return list;
}

// Revisa todos los topes antes de contar el pedido, así un rechazo no consume cupo.
function checkRateLimit(ip, chatId) {
  const now = Date.now();
  const rules = [
    { key: `ip-m:${ip}`, windowMs: MINUTE, max: LIMITS.ipPerMinute },
    { key: `ip-h:${ip}`, windowMs: HOUR, max: LIMITS.ipPerHour },
    { key: `chat:${chatId}`, windowMs: HOUR, max: LIMITS.sessionPerHour },
    { key: 'global', windowMs: HOUR, max: LIMITS.globalPerHour }
  ];
  for (const rule of rules) {
    const list = recentHits(rule.key, rule.windowMs, now);
    if (list.length >= rule.max) {
      return { ok: false, retryAfter: Math.ceil((rule.windowMs - (now - list[0])) / 1000) };
    }
  }
  for (const rule of rules) {
    const list = hits.get(rule.key) || [];
    list.push(now);
    hits.set(rule.key, list);
  }
  return { ok: true };
}

// Limpieza periódica de claves viejas para que el Map no crezca sin fin.
setInterval(() => {
  const now = Date.now();
  for (const [key, list] of hits) {
    if (!list.length || now - list[list.length - 1] >= HOUR) hits.delete(key);
  }
}, 10 * MINUTE).unref();

// Por conversación los mensajes se atienden de a uno, para no pisar el
// historial; con más de uno esperando se rechaza (el widget no lo permite).
const chatQueues = new Map();
function enqueue(chatId, task) {
  const entry = chatQueues.get(chatId) || { tail: Promise.resolve(), pending: 0 };
  if (entry.pending >= 2) return null;
  entry.pending++;
  const run = entry.tail.then(task, task);
  entry.tail = run.catch(() => {}).finally(() => {
    entry.pending--;
    if (entry.pending === 0 && chatQueues.get(chatId) === entry) chatQueues.delete(chatId);
  });
  chatQueues.set(chatId, entry);
  return run;
}

function fail(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function parseMedia(dataUrl, allowedTypes) {
  if (typeof dataUrl !== 'string') return null;
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match || !allowedTypes.includes(match[1])) return null;
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
  const bytes = (match[2].length * 3) / 4 - padding;
  if (bytes <= 0 || bytes > MAX_MEDIA_BYTES) return null;
  return dataUrl;
}

// Traduce el body del widget al formato del flujo común, o devuelve el error.
function toInput(body) {
  const kind = body?.kind;

  if (kind === 'text') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return { error: ['empty_message', 'El mensaje está vacío.'] };
    if (text.length > MAX_TEXT_CHARS) return { error: ['message_too_long', `El mensaje no puede superar los ${MAX_TEXT_CHARS} caracteres.`] };
    return { input: { kind, text } };
  }

  if (kind === 'audio') {
    const mediaDataUrl = parseMedia(body.media, MEDIA_TYPES.audio);
    if (!mediaDataUrl) return { error: ['invalid_media', 'No se pudo leer la nota de voz.'] };
    return { input: { kind, mediaDataUrl } };
  }

  if (kind === 'image') {
    const mediaDataUrl = parseMedia(body.media, MEDIA_TYPES.image);
    if (!mediaDataUrl) return { error: ['invalid_media', 'No se pudo leer la foto. Probá con una imagen JPG o PNG.'] };
    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, MAX_CAPTION_CHARS) : '';
    return { input: { kind, mediaDataUrl, caption } };
  }

  return { error: ['invalid_kind', 'Tipo de mensaje no soportado.'] };
}

async function handleWebChat(req, res) {
  const sessionId = req.body?.sessionId;
  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
    return fail(res, 400, 'invalid_session', 'Sesión inválida. Recargá la página.');
  }
  const chatId = `web:${sessionId.toLowerCase()}`;

  const { input, error } = toInput(req.body);
  if (error) return fail(res, 400, error[0], error[1]);

  const limit = checkRateLimit(req.ip || 'unknown', chatId);
  if (!limit.ok) {
    res.set('Retry-After', String(limit.retryAfter));
    return fail(res, 429, 'rate_limited', 'Recibí muchos mensajes seguidos. Esperá un momento y volvé a escribirme.');
  }

  let replied = false;
  const run = enqueue(chatId, () => processTouristMessage({
    ...input,
    channel: 'web',
    chatId,
    userName: '',
    // La respuesta sale apenas está lista; memoria y métricas se guardan después.
    send: async (reply) => {
      replied = true;
      if (!res.headersSent) res.json({ reply });
    }
  }));

  if (!run) {
    return fail(res, 429, 'busy', 'Todavía estoy respondiendo tu mensaje anterior.');
  }

  try {
    await run;
    if (!replied) fail(res, 400, 'empty_message', 'No pude entender el mensaje. ¿Me lo escribís de nuevo?');
  } catch (err) {
    console.error(`[${chatId}] Error procesando mensaje web:`, err?.response?.data || err.message);
    if (!replied && !res.headersSent) {
      fail(res, 502, 'bot_error', 'Perdón, tuve un problema para responderte. Probá de nuevo en un ratito o escribinos a turismo@smt.gob.ar');
    }
  }
}

module.exports = { handleWebChat };
