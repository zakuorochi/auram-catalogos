const { VertexAI } = require('@google-cloud/vertexai');
const textToSpeech = require('@google-cloud/text-to-speech'); // Necesitas añadir esto al package.json

export default async function handler(req, res) {
  // ... (Tus cabeceras CORS de antes) ...

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    // 1. GENERAR TEXTO CON GEMINI (80 PALABRAS)
    const vertex_ai = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT_ID, location: 'us-central1', googleAuthOptions: { credentials } });
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // ... (Aquí va tu prompt de Gemini de 80 palabras que ya tenemos) ...
    const result = await model.generateContent(promptFinal);
    const textoIA = result.response.candidates[0].content.parts[0].text;

    // 2. CONVERTIR TEXTO A AUDIO CON GOOGLE TTS
    const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
    
    // Limpiamos códigos técnicos para que no los locute
    const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");

    const [responseTTS] = await ttsClient.synthesizeSpeech({
      input: { text: textoParaVoz },
      voice: { 
        languageCode: 'es-ES', 
        name: 'es-ES-Neural2-F', // Voz femenina de alta calidad
        ssmlGender: 'FEMALE' 
      },
      audioConfig: { audioEncoding: 'MP3' },
    });

    const audioBase64 = responseTTS.audioContent.toString('base64');

    // Enviamos texto y audio al frontend
    return res.status(200).json({ 
        texto: textoIA, 
        audio: audioBase64 
    });

  } catch (err) {
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
