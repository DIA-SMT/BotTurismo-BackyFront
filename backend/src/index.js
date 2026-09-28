require('dotenv').config();
const express = require('express');
const cors = require('cors');

const webhookRoutes = require('./routes/webhook');
const webChatRoutes = require('./routes/webChat');

const app = express();
const PORT = process.env.PORT || 3000;

// nginx corre en el mismo servidor: req.ip toma la IP real del turista de
// X-Forwarded-For (la usa el rate limit del chat web).
app.set('trust proxy', 'loopback');

// Logging ultra-simple para ver peticiones CRUDO
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Chat web de Migue: va antes del CORS abierto y del parser global porque
// tiene sus propios orígenes permitidos y un límite de body mayor (fotos y audio).
app.use('/api', webChatRoutes);

app.use(cors());
// rawBody se conserva para validar la firma X-Hub-Signature-256 de Meta.
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api', webhookRoutes);

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🤖 Bot Turismo SMT Backend running on port ${PORT}`);
});
