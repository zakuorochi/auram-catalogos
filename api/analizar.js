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
        const project = process.env.GOOGLE_CLOUD_PROJECT_ID;

        const vertex_ai = new VertexAI({ project, location: 'us-central1', googleAuthOptions: { credentials } });
        const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
        
        // --- USANDO ESTRICTAMENTE 2.5-FLASH-LITE ---
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        // 1. Detección de género rápida
        const resGen = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
        });
        const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
        const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

        // 2. Prompt Optimizado para Estilo y Vínculo de Imagen
        const promptFinal = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Eres AURAM, un asistente de moda de lujo con lenguaje sofisticado y cálido. 
                    Analiza la imagen del usuario para la ocasión: ${ocasion}. 
                    Busca en el catálogo de ${gen.toUpperCase()} (PDF adjunto) la prenda perfecta.

                    INSTRUCCIONES DE RESPUESTA:
                    - Redacta una recomendación de estilo elegante (máximo 60 palabras).
                    - Indica el precio exacto del catálogo.
                    - CRÍTICO: No menciones nombres de archivos o números de página en la recomendación hablada.
                    
                    ESTRUCTURA TÉCNICA OBLIGATORIA AL FINAL:
                    GENERO_REF: ${gen}
                    PAGINA_REF: [número de página del PDF]
                    FOTO` },
                    { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
                    { inlineData: { mimeType: 'image/jpeg', data: image } }
                ]
            }]
        };

        const result = await model.generateContent(promptFinal);
        const textoIA = result.response.candidates[0].content.parts[0].text;

        // 3. Procesamiento de datos para el Frontend
     // ... dentro de api/analizar.js ...

let textoFinal = textoIA;
const pagMatch = textoIA.match(/PAGINA_REF:\s*(\d+)/i);

if (pagMatch) {
    // YA NO RESTAMOS NADA. Si la IA dice 98, mandamos 98.
    const numPdf = pagMatch[1].replace(/\D/g, ""); 
    textoFinal = textoFinal.replace(/PAGINA_REF:\s*\d+/i, `PAGINA_REF: ${numPdf}`);
}
        // 4. Voz Masculina (Limpiando etiquetas técnicas)
        const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");
        const [responseTTS] = await ttsClient.synthesizeSpeech({
            input: { text: textoParaVoz },
            voice: { 
                languageCode: 'es-ES', 
                name: 'es-ES-Wavenet-B', 
                ssmlGender: 'MALE' 
            },
            audioConfig: { audioEncoding: 'MP3' },
        });

        res.status(200).json({ 
            texto: textoFinal, 
            audio: responseTTS.audioContent.toString('base64') 
        });

    } catch (err) {
        console.error("Error en AURAM 2.5 Lite:", err.message);
        res.status(200).json({ isError: true, detalle: err.message });
    }
}
