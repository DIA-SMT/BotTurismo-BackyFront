const express = require('express');
const router = express.Router();
const { handleManyChatWebhook } = require('../controllers/webhookController');

// ManyChat manda un POST a esta ruta con cada mensaje nuevo
router.post('/webhook/manychat', handleManyChatWebhook);

module.exports = router;
