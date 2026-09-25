require('dotenv').config();

// Bot de Telegram del Asistente Turístico. Corre como proceso aparte del
// backend de WhatsApp (ver ecosystem.config.js) y usa long polling: no
// necesita URL pública ni nginx. Solo puede haber UNA instancia por token.

// 1. Validar todas las variables juntas: mejor no arrancar que arrancar y
//    contestar mal cuando ya hay alguien esperando.
const REQUIRED_ENV = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENROUTER_API_KEY'];
const missing = REQUIRED_ENV.filter(name => !process.env[name] || !process.env[name].trim());
if (missing.length > 0) {
  console.error(`[Telegram] Faltan variables de entorno: ${missing.join(', ')}. Revisá el .env del backend.`);
  process.exit(1);
}

const { Bot, GrammyError, HttpError } = require('grammy');
const { processTouristMessage } = require('./services/conversation');
const { sendTelegramText, downloadTelegramFile } = require('./services/telegram');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN.trim();
const bot = new Bot(TOKEN);

const WELCOME = `¡Hola! 👋 Soy el Asistente Turístico oficial de la Dirección de Turismo de San Miguel de Tucumán.

Preguntame qué visitar, dónde comer o dormir, la agenda cultural o cómo reservar el Bus Turístico (es gratis).

También podés mandarme una nota de voz, o una foto de un edificio o lugar de la ciudad y te cuento su historia 📸

Hi! You can also write to me in English.`;

const UNSUPPORTED = 'Por ahora entiendo mensajes de texto, notas de voz y fotos de lugares de la ciudad 🏛️. ¡Contame en qué te puedo ayudar!';
const FAILURE = 'Perdón, tuve un problema para responderte 😕. Probá de nuevo en un ratito o escribinos a turismo@smt.gob.ar';

// Solo chats privados: en un grupo el bot contestaría a cualquier mensaje.
bot.use(async (ctx, next) => {
  if (ctx.chat?.type !== 'private') return;
  await next();
});

bot.command(['start', 'ayuda', 'help'], (ctx) => ctx.reply(WELCOME));

// grammY procesa los updates en orden, de a uno. Una consulta al modelo tarda
// varios segundos, así que cada mensaje se atiende en segundo plano para no
// frenar al resto de los turistas; por chat se encolan para no pisar el historial.
const chatQueues = new Map();
function enqueue(chatId, task) {
  const previous = chatQueues.get(chatId) || Promise.resolve();
  const current = previous.then(task, task).finally(() => {
    if (chatQueues.get(chatId) === current) chatQueues.delete(chatId);
  });
  chatQueues.set(chatId, current);
}

// "escribiendo..." dura unos 5 segundos; se renueva mientras responde el modelo.
function keepTyping(ctx) {
  const tick = () => ctx.replyWithChatAction('typing').catch(() => {});
  tick();
  const interval = setInterval(tick, 4500);
  return () => clearInterval(interval);
}

// Traduce el mensaje de Telegram al formato del flujo común.
async function toInput(ctx) {
  const msg = ctx.message;
  if (msg.text) return { kind: 'text', text: msg.text };

  if (msg.voice || msg.audio) {
    const media = msg.voice || msg.audio;
    const { dataUrl } = await downloadTelegramFile(ctx.api, TOKEN, media.file_id, media.mime_type || 'audio/ogg');
    return { kind: 'audio', mediaDataUrl: dataUrl };
  }

  // Foto comprimida (se toma la resolución más grande) o imagen mandada como archivo
  const imageFileId = msg.photo?.at(-1)?.file_id
    || (msg.document?.mime_type?.startsWith('image/') ? msg.document.file_id : null);
  if (imageFileId) {
    const mime = msg.document?.mime_type || 'image/jpeg';
    const { dataUrl } = await downloadTelegramFile(ctx.api, TOKEN, imageFileId, mime);
    return { kind: 'image', mediaDataUrl: dataUrl, caption: msg.caption || '' };
  }

  return null;
}

bot.on('message', (ctx) => {
  // Mensajes de servicio (fijar, autoborrado, fondo del chat, permiso de escritura): no los escribió el turista.
  const msg = ctx.message;
  if (msg.pinned_message || msg.message_auto_delete_timer_changed || msg.chat_background_set || msg.write_access_allowed) return;

  const chatId = `tg:${ctx.chat.id}`;
  const userName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || ctx.from?.username || '';

  enqueue(chatId, async () => {
    const stopTyping = keepTyping(ctx);
    try {
      const input = await toInput(ctx);
      if (!input) {
        console.log(`[${chatId}] Tipo de mensaje no soportado`);
        await ctx.reply(UNSUPPORTED);
        return;
      }
      await processTouristMessage({
        ...input,
        channel: 'telegram',
        chatId,
        userName,
        send: (text) => sendTelegramText(ctx.api, ctx.chat.id, text)
      });
    } catch (err) {
      console.error(`[${chatId}] Error procesando mensaje:`, err?.description || err?.response?.data || err.message);
      await ctx.reply(FAILURE).catch(() => {});
    } finally {
      stopTyping();
    }
  });
});

bot.catch((err) => {
  const e = err.error;
  if (e instanceof GrammyError) console.error('[Telegram] Error de la API:', e.description);
  else if (e instanceof HttpError) console.error('[Telegram] No se pudo contactar a Telegram:', e.message);
  else console.error('[Telegram] Error:', e);
});

async function main() {
  // El menú ☰ de Telegram. Es idempotente; si falla, el bot arranca igual.
  await bot.api.setMyCommands([
    { command: 'start', description: 'Qué puedo hacer por vos' },
    { command: 'ayuda', description: 'Cómo usar el asistente' }
  ]).catch(err => console.warn('[Telegram] No se pudo configurar el menú de comandos:', err.description || err.message));

  // Apagado ordenado: PM2 manda SIGINT/SIGTERM al reiniciar. Telegram ya dio
  // por entregados los mensajes que se están respondiendo, así que antes de
  // salir se espera a que terminen (con tope, menor al kill_timeout de PM2).
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await bot.stop().catch(() => {});
    await Promise.race([
      Promise.allSettled([...chatQueues.values()]),
      new Promise((resolve) => setTimeout(resolve, 25000))
    ]);
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  await bot.start({
    onStart: (me) => console.log(`🤖 Bot Turismo SMT en Telegram escuchando como @${me.username}`)
  });
}

main().catch((err) => {
  if (err instanceof GrammyError && (err.error_code === 401 || err.error_code === 404)) {
    console.error(`[Telegram] Telegram rechazó el token: revisá TELEGRAM_BOT_TOKEN, tiene que ser el token completo de @BotFather (número:clave). (${err.error_code})`);
  } else if (err instanceof GrammyError && err.error_code === 409) {
    console.error('[Telegram] Ya hay otra instancia del bot escuchando con este token. Reiniciá la que corre en vez de levantar otra. (409)');
  } else {
    console.error('[Telegram] Error fatal al arrancar:', err);
  }
  process.exit(1);
});
