const { VertexAI } = require('@google-cloud/vertexai');
const textToSpeech = require('@google-cloud/text-to-speech');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    const vertex_ai = new VertexAI({ 
      project: process.env.GOOGLE_CLOUD_PROJECT_ID, 
      location: 'us-central1', 
      googleAuthOptions: { credentials } 
    });
    
    const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash' }); // Usamos 2.0 que es más estable para Vercel

    // 1. DETECCIÓN DE GÉNERO
    const resGen = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
    });
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();

    // 2. PROMPT DE RECOMENDACIÓN (Ajustado para no saturar)
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, asistente de moda. El usuario quiere ir a: ${ocasion}. 
          Analiza su estilo y compáralo con el catálogo de ${gen} que tienes en gs://auram-assets-01/auram-catalogos/${gen}/.
          
          TAREA:
          - Analiza visualmente la ropa y las caracteristicas fisicas del usuario y compárala con TODAS las imágenes disponibles en el catálogo de ${gen.toUpperCase()}.
          - Selecciona la prenda que mejor complemente su estilo o sea la opción ideal para la ocasión.
          - No te limites a un rango; busca el número de imagen (001.jpg, 002.jpg, etc.) que realmente corresponda a la mejor prenda.
 REGLAS DE RESPUESTA:
          - Escribe una recomendación cálida de máximo 60 palabras.
          - Menciona el precio exacto que aparece en la imagen seleccionada.

          
          CIERRE:
          GENERO_REF: ${gen}
          IMG_REF: [número]
          FOTO` },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const result = await model.generateContent(promptFinal);
    const textoIA = result.response.candidates[0].content.parts[0].text;

    // 3. AUDIO NEURAL
    const textoParaVoz = textoIA.replace(/GENERO_REF:.*|IMG_REF:.*|FOTO/gi, "");
    const [responseTTS] = await ttsClient.synthesizeSpeech({
      input: { text: textoParaVoz },
      voice: { languageCode: 'es-ES', name: 'es-ES-Wavenet-C', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    return res.status(200).json({ 
      texto: textoIA, 
      audio: responseTTS.audioContent.toString('base64') 
    });

  } catch (err) {
    console.error(err);
    // Enviamos el error como JSON para que el index no explote
    return res.status(500).json({ isError: true, detalle: err.message });
  }
}
