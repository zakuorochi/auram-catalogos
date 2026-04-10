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
        
        // --- CAMBIO AL MODELO PARA PRUEBA: 2.5-FLASH-LITE ---
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        // 1. Identificar Género
        const resGen = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
        });
        const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
        const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

        // 2. Prompt (Lógica base funcional)
        const promptFinal = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Eres AURAM, asistente de moda. Analiza la foto para la ocasión: ${ocasion}. Usa el PDF de ${gen} adjunto.
                    TAREA:
                    - Analiza visualmente la ropa y las caracteristicas fisicas del usuario y compárala con TODAS las imágenes disponibles en el catálogo de ${gen.toUpperCase()}.
                    - Selecciona la prenda que mejor complemente su estilo o sea la opción ideal para la ocasión.
                    - No te limites a un rango; busca el número de imagen (001.jpg, 002.jpg, etc.) que realmente corresponda a la mejor prenda.

                    REGLAS DE RESPUESTA:
                    - Escribe una recomendación cálida de máximo 60 palabras.
                    - Menciona el precio exacto que aparece en la imagen seleccionada.
                    GENERO_REF: ${gen}
                    PAGINA_REF: [número de página]
                    FOTO` },
                    { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
                    { inlineData: { mimeType: 'image/jpeg', data: image } }
                ]
            }]
        };

        const result = await model.generateContent(promptFinal);
        const textoIA = result.response.candidates[0].content.parts[0].text;

        // 3. Ajuste de Offset y Limpieza para la Voz
        let textoFinalParaFrontend = textoIA;
        const pagMatch = textoIA.match(/PAGINA_REF:\s*(\d+)/i);
        
        if (pagMatch) {
            const numPdf = parseInt(pagMatch[1]);
            const offset = -1; 
            const numCorregido = numPdf + offset;
            textoFinalParaFrontend = textoFinalParaFrontend.replace(/PAGINA_REF:\s*\d+/i, `PAGINA_REF: ${numCorregido}`);
        }

        const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");

        // 4. Voz Neural Masculina
        const [responseTTS] = await ttsClient.synthesizeSpeech({
            input: { text: textoParaVoz },
            voice: { languageCode: 'es-ES', name: 'es-ES-Wavenet-B', ssmlGender: 'MALE' },
            audioConfig: { audioEncoding: 'MP3' },
        });

        res.status(200).json({ 
            texto: textoFinalParaFrontend, 
            audio: responseTTS.audioContent.toString('base64') 
        });

    } catch (err) {
        console.error("Error en Prueba Lite:", err.message);
        res.status(200).json({ isError: true, detalle: err.message });
    }
}
