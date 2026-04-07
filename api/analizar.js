const { VertexAI } = require('@google-cloud/vertexai');
const textToSpeech = require('@google-cloud/text-to-speech');

export default async function handler(req, res) {
  // --- CONFIGURACIÓN DE CABECERAS CORS ---
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ isError: true, detalle: "Método no permitido" });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    // 1. INICIALIZAR CLIENTES DE GOOGLE CLOUD
    const vertex_ai = new VertexAI({ 
        project: process.env.GOOGLE_CLOUD_PROJECT_ID, 
        location: 'us-central1', 
        googleAuthOptions: { credentials } 
    });
    const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 2. DETECCIÓN DE GÉNERO (Rápida para seleccionar catálogo)
    const resGen = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Responde 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
    });
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
    const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

    // 3. GENERAR CONSEJO EMPÁTICO (80 PALABRAS)
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, asistente de estilo. Tienes el catálogo de ${gen.toUpperCase()} abierto.
          
          TAREA:
          1. Analiza la imagen y la ocasión: ${ocasion}.
          2. Escribe una recomendación empática de MÁXIMO 60 PALABRAS.
          3. Cita el nombre y precio REAL del PDF. No inventes.

          FORMATO DE CIERRE OBLIGATORIO:
          GENERO_REF: ${gen}
          PAGINA_REF: [Número]
          FOTO` 
          },
          { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const result = await model.generateContent(promptFinal);
    const textoIA = result.response.candidates[0].content.parts[0].text;

    // 4. CONVERTIR TEXTO A VOZ NEURAL (Limpiando códigos técnicos)
    const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");

    const [responseTTS] = await ttsClient.synthesizeSpeech({
      input: { text: textoParaVoz },
     voice: { 
  languageCode: 'es-ES', 
  name: 'es-ES-Wavenet-C', // Esta voz es femenina, muy clara y elegante
  ssmlGender: 'FEMALE' 
},
      audioConfig: { audioEncoding: 'MP3' },
    });

    const audioBase64 = responseTTS.audioContent.toString('base64');

    // 5. RESPUESTA FINAL AL CELULAR
    return res.status(200).json({ 
        texto: textoIA, 
        audio: audioBase64 
    });

  } catch (err) {
    console.error("Error en backend AURAM:", err);
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
