const express = require('express');
const router = express.Router();
const { verifyWhatsAppWebhook, handleWhatsAppWebhook } = require('../controllers/whatsappController');

// WhatsApp Cloud API (Meta):
// - GET: verificación del webhook al configurarlo en developers.facebook.com
// - POST: mensajes entrantes
router.get('/webhook/whatsapp', verifyWhatsAppWebhook);
router.post('/webhook/whatsapp', handleWhatsAppWebhook);

module.exports = router;
