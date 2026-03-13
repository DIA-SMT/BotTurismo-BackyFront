const axios = require('axios');

async function transcribeAudio(audioUrl) {
  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Sos un transcriptor experto. Tu única tarea es escuchar el audio provisto y transcribir exactamente las palabras habladas al texto. No agregues saludos, explicaciones, asunciones, ni formatos especiales.'
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: audioUrl } }, // Gemini 2.5 on OpenRouter uses image_url for multimodal
            { type: 'text', text: 'Transcribí este audio.' }
          ]
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let text = response.data?.choices?.[0]?.message?.content || '';
    if (!text || text.trim() === '') {
      return '[El audio recibido está vacío o no pudo ser transcrito]';
    }
    return text;
  } catch (err) {
    console.error('Error in Audio Transcription AI:', err?.response?.data || err.message);
    return '[Error al transcribir el audio]';
  }
}

module.exports = { transcribeAudio };
