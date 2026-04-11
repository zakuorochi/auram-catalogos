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
        
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        // 1. Detección de género (Limpieza mejorada)
        const resGen = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
        });
        
        // Limpiamos puntos o espacios extra que la IA pueda enviar
        const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().replace(/[^a-z]/g, "").trim();
        const urlPdf = (gen === 'mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

        // 2. PROMPT EMPÁTICO Y ESTRICTO
const promptFinal = {
    contents: [{
        role: 'user',
        parts: [
            { text: `Eres AURAM, asistente de moda empática y sofisticada. 
            TAREA: Analiza la foto del usuario y guiandote de sus caracteristicas fisicas por ejemplo color de cabello, contextura, tono de piel, estilo de vestir... etc
            y busca en el PDF de ${gen.toUpperCase()} una prenda que combine perfectamente.
            
            REGLAS ESTRICTAS:
            1. Realiza tu recomendacion de prenda de una manera dulce y amigable, y procede a dar una descripcion de la prenda y la razon por la que sientes que combina con el usuario (máx. 50 palabras).
            2. NO menciones precios ni códigos.
            3. La PAGINA_REF debe ser EXACTAMENTE la página donde aparece la prenda que acabas de describir.
            4. No pongas la palabra "FOTO" dentro de tu saludo, déjala para el final.

            ESTRUCTURA DE CIERRE (OBLIGATORIA):
            GENERO_REF: ${gen}
            PAGINA_REF: [número de página real]
            FOTO` },
            { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
            { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
    }]
};

        const result = await model.generateContent(promptFinal);
        const textoIA = result.response.candidates[0].content.parts[0].text;

        // 3. Procesamiento para el Frontend
        let textoFinal = textoIA;
        const pagMatch = textoIA.match(/PAGINA_REF:\s*(\d+)/i);
        if (pagMatch) {
            const numPdf = pagMatch[1].replace(/\D/g, ""); 
            textoFinal = textoFinal.replace(/PAGINA_REF:\s*\d+/i, `PAGINA_REF: ${numPdf}`);
        }

        // 4. VOZ FEMENINA (Wavenet-E)
        const textoParaVoz = textoIA.replace(/GENERO_REF:.*|PAGINA_REF:.*|FOTO/gi, "");
        
        const [responseTTS] = await ttsClient.synthesizeSpeech({
            input: { text: textoParaVoz },
            voice: { 
                languageCode: 'es-ES', 
                name: 'es-ES-Wavenet-E', 
                ssmlGender: 'FEMALE' 
            },
            audioConfig: { 
                audioEncoding: 'MP3',
                speakingRate: 1.0 // Velocidad natural
            },
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
// Versión Final 2.5 - Voz Femenina Activada
