const axios = require('axios');

const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY;

const api = axios.create({
  baseURL: 'https://api.manychat.com/fb',
  timeout: 8000,
  headers: {
    'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

async function sendManychatMessages(subscriberId, fullText) {
  if (!fullText) return;

  const MAX_CHARS = 1500;
  
  // 1. Split by double newlines first (natural paragraph breaks)
  let paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length === 0) paragraphs = [fullText];

  // 2. Further split paragraphs that exceed MAX_CHARS
  const chunks = [];
  for (const para of paragraphs) {
    if (para.length <= MAX_CHARS) {
      chunks.push(para.trim());
    } else {
      const lines = para.split(/\n/);
      let current = '';
      for (const line of lines) {
        if (current && (current + '\n' + line).length > MAX_CHARS) {
          chunks.push(current.trim());
          current = line;
        } else {
          current = current ? current + '\n' + line : line;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  // 3. Build ManyChat messages array (only WhatsApp-compatible types)
  const messages = chunks.map(chunk => ({ type: 'text', text: chunk }));

  // 4. Send the payload exactly as n8n did
  const payload = {
    subscriber_id: subscriberId,
    data: {
      version: "v2",
      content: {
        type: "whatsapp",
        messages: messages
      }
    }
  };

  try {
    const response = await api.post('/sending/sendContent', payload);
    return response.data;
  } catch (err) {
    console.error('Error sending ManyChat messages:', err?.response?.data || err.message);
    throw err; // Re-throw to handle in controller
  }
}

module.exports = { sendManychatMessages };
