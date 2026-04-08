
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

    // CAMBIO CLAVE: Usamos el nombre de modelo más compatible
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

    // 1. DETECCIÓN DE GÉNERO
    const resGen = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
    });
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();

    // 2. PROMPT DE RECOMENDACIÓN
    // Nota: Mencionamos el bucket pero le pedimos que use su conocimiento del catálogo visual.
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, asistente de moda de lujo. El usuario quiere un look para: ${ocasion}. 
          
          Tu catálogo de ${gen.toUpperCase()} está alojado en gs://auram-assets-01/auram-catalogos/${gen}/ e incluye imágenes desde la (001).jpg hasta la (070).jpg.

          TAREA:
          1. Analiza la foto del usuario (estilo, color de piel, complexión).
          2. Selecciona la prenda del catálogo que mejor le quede.
          3. Escribe una recomendación de máx. 60 palabras, cálida y profesional.
          4. Indica el precio que aparece en la imagen.

          CIERRE OBLIGATORIO:
          GENERO_REF: ${gen}
          IMG_REF: [número de 3 dígitos, ej: 015]
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
    console.error("Error en AURAM:", err);
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
