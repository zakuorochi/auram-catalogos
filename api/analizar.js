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

        // 1. INICIALIZAR CLIENTES
        const vertex_ai = new VertexAI({ project, location: 'us-central1', googleAuthOptions: { credentials } });
        const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
        
        // Usamos el modelo estable que confirmamos
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 2. IDENTIFICAR GÉNERO PARA ELEGIR PDF
        const resGen = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
        });
        const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
        const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

        // 3. ANÁLISIS CON EL PDF (Mantenemos tu lógica exacta)
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

        // --- 4. GENERACIÓN DE VOZ NEURAL (CAMBIO DEL MARTES) ---
        // Limpiamos los códigos técnicos para que la voz no los lea
        const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");

      const [responseTTS] = await ttsClient.synthesizeSpeech({
            input: { text: textoParaVoz },
            voice: { 
                languageCode: 'es-ES', 
                name: 'es-ES-Wavenet-B', // Voz masculina premium (España)
                ssmlGender: 'MALE' 
            },
            audioConfig: { audioEncoding: 'MP3' },
        });

        // 5. RESPUESTA FINAL
        res.status(200).json({ 
            texto: textoIA, 
            audio: responseTTS.audioContent.toString('base64') 
        });

    } catch (err) {
        console.error("Error en AURAM:", err);
        res.status(200).json({ isError: true, detalle: err.message });
    }
}
