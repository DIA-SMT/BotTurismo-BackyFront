const axios = require('axios');

async function visionAnalyzeImage(imageUrl) {
  const promptText = `Analizá esta fotografía con mucho cuidado y determiná si muestra un edificio, plaza, monumento o lugar de San Miguel de Tucumán, Argentina.

PROCESO DE ANÁLISIS:
1. Primero describí brevemente lo que ves en la imagen (arquitectura, estilo, elementos visuales clave).
2. Luego identificá el lugar.

CRITERIOS DE RESPUESTA:
A) Si identificás el lugar con ALTA CONFIANZA:
   → Decí el nombre del lugar, su historia, importancia y datos turísticos prácticos (horarios, acceso, curiosidades). Tono entusiasta y cálido. Sin preguntas al final.

B) Si el lugar PODRÍA ser de Tucumán pero no lo identificás con certeza:
   → Describí lo que ves arquitectónicamente y pedí amablemente más contexto: "Veo [descripción]. ¿Podés decirme el nombre o la dirección?"

C) Si la imagen CLARAMENTE no muestra un lugar de Tucumán (objeto común, persona, lugar de otra ciudad, etc.):
   → Decilo directamente: "Esta foto no muestra un lugar de Tucumán. ¡Mandame una foto de algún edificio o lugar de la ciudad y te cuento su historia! 📸"

IMPORTANTE: Nunca inventes ni fuerces una identificación. Es mejor admitir que no lo reconocés que confirmar algo incorrecto.

LUGARES DE TUCUMÁN MÁS FOTOGRAFIADOS:
[BASE DE DATOS ACORTADA APLICADA AL PROMPT AQUÍ COMO EN EL N8N...]
🏛️ CASA HISTÓRICA DE LA INDEPENDENCIA (Congreso 151)
🏛️ CASA DE GOBIERNO DE TUCUMÁN (Plaza Independencia)
⛪ CATEDRAL METROPOLITANA (Plaza Independencia)
🏛️ MUSEO DE LA INDUSTRIA AZUCARERA — MIA (Parque 9 de Julio)
🏛️ CASA NATAL DE MERCEDES SOSA (Pasaje Crisóstomo Alvarez)
🏛️ CASA SOLAR BELGRANIANA (Congreso 23)
🏛️ CASA MUSEO DE LA CIUDAD (Centro histórico)
🏛️ MUSEO SANMARTINIANO DE BURRUYACÚ (Ruta Provincial 317)
🌳 PARQUE 9 DE JULIO (Av. Mate de Luna)
🏛️ TEATRO MERCEDES SOSA (Marcos Paz 330)
🏛️ TEATRO ALBERDI (Córdoba 550)
🏛️ IGLESIA SAN FRANCISCO (25 de Mayo y Junín)
🏛️ IGLESIA SANTO DOMINGO (9 de Julio 21)
🏛️ IGLESIA DE LA MERCED (Las Heras 182) 
🏛️ PASAJE 24 DE SEPTIEMBRE
🌟 CIUDADELA HISTÓRICA`;

  try {
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'google/gemini-2.5-pro-preview-03-25',
      max_tokens: 2500,
      messages: [
        {
          role: 'system',
          content: 'Sos el asistente de reconocimiento visual del Bot Turístico de San Miguel de Tucumán, Argentina. Analizás fotos para identificar edificios, monumentos y lugares de Tucumán y brindás información histórica y turística. El mensaje generado será enviado por whatsapp, por lo que la respuesta debe ser breve'
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: promptText }
          ]
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let text = response.data?.choices?.[0]?.message?.content || 'Error procesando la imagen.';
    
    // Devolvemos el JSON con la misma estrucura que devolvería el LangChain mainAgent
    return {
      intent: 'geo_quiz',
      language: 'es',
      cuisine_type: null,
      budget: null,
      origen_provincia: null,
      medio_transporte: null,
      has_photo: true,
      additional_info: text
    };
  } catch (err) {
    console.error('Error in Vision AI:', err?.response?.data || err.message);
    throw err;
  }
}

module.exports = { visionAnalyzeImage };
