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
        
        // Usamos el modelo que ya te funciona
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 1. Identificar Género
        const resGen = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
        });
        const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
        const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

        // 2. Prompt Reformulado para ocultar datos técnicos y corregir desfase
        const promptFinal = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Eres AURAM, asistente de moda de lujo. Analiza la foto para: ${ocasion}. Usa el PDF adjunto de ${gen.toUpperCase()}.
          
                    TAREA:
                    - Selecciona la prenda ideal en el PDF.
                    - Escribe una recomendación empática de máx. 60 palabras.
                    - Menciona nombre y precio real del catálogo.

                    REGLAS CRÍTICAS DE FORMATO:
                    1. NO menciones números de página, nombres de archivo (como "imagen 113.jpg") o la palabra "referencia" en la recomendación.
                    2. Al final de tu respuesta, SIEMPRE incluye este bloque técnico exacto:

                    GENERO_REF: ${gen}
                    PAGINA_REF: [Aquí pon el número de página real del PDF]
                    FOTO` },
                    { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
                    { inlineData: { mimeType: 'image/jpeg', data: image } }
                ]
            }]
        };

        const result = await model.generateContent(promptFinal);
        const textoIA = result.response.candidates[0].content.parts[0].text;

        // --- 3. CORRECCIÓN MATEMÁTICA DEL DESFASE (OFFSET) ---
        let textoFinalParaFrontend = textoIA;
        
        // Buscamos el número de página que dio la IA (ej: 113)
        const pagMatch = textoIA.match(/PAGINA_REF:\s*(\d+)/i);
        
        if (pagMatch) {
            const numPdf = parseInt(pagMatch[1]); // 113
            
            // AJUSTE: Si el PDF tiene carátula y tus JPG no, restamos 1.
            // Página 2 del PDF -> Archivo (001).jpg
            // Página 113 del PDF -> Archivo (112).jpg
            const offset = -1; 
            const numCorregido = numPdf + offset;
            
            // Reemplazamos el número técnico para el frontend (index.html)
            textoFinalParaFrontend = textoFinalParaFrontend.replace(
                /PAGINA_REF:\s*\d+/i, 
                `PAGINA_REF: ${numCorregido}`
            );
            
            console.log(`Página PDF: ${numPdf} -> Corregida para JPG: ${numCorregido}`);
        }

        // 4. Voz Neural (Limpia de códigos técnicos)
        const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");
        const [responseTTS] = await ttsClient.synthesizeSpeech({
            input: { text: textoParaVoz },
            voice: { languageCode: 'es-ES', name: 'es-ES-Wavenet-B', ssmlGender: 'MALE' },
            audioConfig: { audioEncoding: 'MP3' },
        });

        // 5. RESPUESTA AL FRONTEND
        res.status(200).json({ 
            texto: textoFinalParaFrontend, // Enviamos el texto con el número ya corregido
            audio: responseTTS.audioContent.toString('base64') 
        });

    } catch (err) {
        console.error("Error en AURAM:", err.message);
        res.status(200).json({ isError: true, detalle: err.message });
    }
}
