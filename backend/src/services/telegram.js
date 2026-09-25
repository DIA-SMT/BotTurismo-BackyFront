const axios = require('axios');

// Telegram Bot API — envio con parse_mode HTML.
// Se usa HTML y no MarkdownV2: en MarkdownV2 un solo '-', '(' o '.' sin escapar
// hace fallar el envio entero, y las respuestas del modelo estan llenas de
// direcciones como "Congreso 151 (frente a la plaza) - centro".

const MAX_CHARS = 4000; // tope de Telegram: 4096, con margen para las etiquetas

// Parte por parrafos y despues por lineas, para no cortar una oracion al medio.
// Se hace ANTES de convertir a HTML, asi ninguna parte queda con una etiqueta abierta.
function splitIntoChunks(fullText) {
  if (!fullText) return [];
  const paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks = [];
  let current = '';

  const push = () => { if (current.trim()) chunks.push(current.trim()); current = ''; };

  for (const para of paragraphs.length ? paragraphs : [fullText]) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= MAX_CHARS) { current = candidate; continue; }
    push();
    if (para.length <= MAX_CHARS) { current = para; continue; }
    for (const line of para.split('\n')) {
      if (current && (current + '\n' + line).length > MAX_CHARS) push();
      // Una linea sola mas larga que el tope se corta en el ultimo espacio,
      // o si no hay, sin partir un emoji (par sustituto UTF-16) al medio.
      let rest = current ? `${current}\n${line}` : line;
      while (rest.length > MAX_CHARS) {
        let cut = MAX_CHARS;
        const space = rest.lastIndexOf(' ', MAX_CHARS - 1);
        if (space > MAX_CHARS / 2) {
          cut = space + 1;
        } else {
          const code = rest.charCodeAt(cut - 1);
          if (code >= 0xD800 && code <= 0xDBFF) cut--;
        }
        chunks.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      current = rest;
    }
  }
  push();
  return chunks;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Convierte el formato que suele devolver el modelo (estilo WhatsApp/Markdown)
// al subconjunto de HTML que acepta Telegram. El orden importa: primero se
// escapa TODO el texto y recien despues se agregan las etiquetas propias.
function toTelegramHtml(text) {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => `<a href="${url.replace(/"/g, '&quot;')}">${label}</a>`);
  s = s.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*(?!\s)([^*\n]+?)(?<!\s)\*/g, '<b>$1</b>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/^\s*[-*]\s+/gm, '• ');
  return s;
}

// Version sin marcado, para el reenvio si Telegram rechaza el HTML.
function toPlainText(text) {
  return text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*(?!\s)([^*\n]+?)(?<!\s)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ');
}

async function sendTelegramText(api, chatId, fullText) {
  for (const chunk of splitIntoChunks(fullText)) {
    try {
      await api.sendMessage(chatId, toTelegramHtml(chunk), { parse_mode: 'HTML', link_preview_options: { is_disabled: false } });
    } catch (err) {
      // Perder una negrita es aceptable; perder la respuesta, no.
      if (err?.error_code === 400) {
        console.warn(`[Telegram] HTML rechazado (${err.description}), reenviando en texto plano.`);
        await api.sendMessage(chatId, toPlainText(chunk));
      } else {
        throw err;
      }
    }
  }
}

// Bajar un archivo son dos pasos: getFile y la descarga del host de archivos.
// Telegram no deja bajar mas de 20 MB. Devuelve un data URL base64 para los
// modelos multimodales, igual que downloadWhatsAppMedia.
async function downloadTelegramFile(api, token, fileId, fallbackMime) {
  const file = await api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });

  const mimeType = fallbackMime || response.headers['content-type'] || 'application/octet-stream';
  const base64 = Buffer.from(response.data).toString('base64');
  return { mimeType, dataUrl: `data:${mimeType};base64,${base64}` };
}

module.exports = { sendTelegramText, downloadTelegramFile, toTelegramHtml, splitIntoChunks };
