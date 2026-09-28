const express = require('express');
const cors = require('cors');
const { handleWebChat } = require('../controllers/webChatController');

const router = express.Router();

// Solo el sitio del Bus Turístico puede usar el chat desde el navegador. Por
// defecto: el dominio de PUBLIC_SITE_URL y el Next.js local.
function allowedOrigins() {
  const configured = (process.env.WEB_CHAT_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (configured.length) return configured;

  const defaults = ['http://localhost:3000'];
  try {
    if (process.env.PUBLIC_SITE_URL) defaults.push(new URL(process.env.PUBLIC_SITE_URL).origin);
  } catch {
    console.warn('[WebChat] PUBLIC_SITE_URL no es una URL válida; solo se acepta http://localhost:3000.');
  }
  return defaults;
}

const ORIGINS = allowedOrigins();
console.log(`[WebChat] Orígenes permitidos: ${ORIGINS.join(', ')}`);

const corsForSite = cors({ origin: ORIGINS, methods: ['POST'], maxAge: 600 });

// CORS solo lo aplica el navegador: un sitio ajeno igual podría disparar el
// POST y gastar modelo, así que se corta acá. Sin Origin (curl) pasa al rate limit.
function rejectForeignOrigin(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'forbidden_origin', message: 'Origen no permitido.' });
  }
  next();
}

// Las fotos y notas de voz llegan en base64 (hasta ~6 MB decodificados).
const jsonWithMedia = express.json({ limit: '9mb' });

router.options('/chat/web', corsForSite);
router.post('/chat/web', corsForSite, rejectForeignOrigin, jsonWithMedia, handleWebChat);

// Body demasiado grande o JSON roto: responder JSON (con CORS ya aplicado) en
// lugar de la página de error de Express, así el widget puede mostrar el motivo.
router.use((err, _req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload_too_large', message: 'El archivo es demasiado pesado.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: 'Mensaje inválido.' });
  }
  next(err);
});

module.exports = router;
