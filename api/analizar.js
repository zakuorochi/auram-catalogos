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
        
        // VOLVEMOS AL MODELO ESTÁNDAR 2.5 FLASH
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // 1. Identificar Género
        const resGen = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: "Responde solo 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
        });
        const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
        const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

        // 2. PROMPT REFORZADO: Obligamos a que ponga los datos técnicos al final
        const promptFinal = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Eres AURAM, asistente de moda de lujo. El usuario quiere un look para: ${ocasion}. 
                    Analiza su foto y busca la prenda ideal en el PDF adjunto de ${gen.toUpperCase()}.

                    REGLAS DE ORO:
                    1. Escribe una recomendación sofisticada (máx. 60 palabras). No menciones códigos de archivos en este texto.
                    2. Al final de tu respuesta, añade EXACTAMENTE este formato para que el sistema funcione:

                    GENERO_REF: ${gen}
                    PAGINA_REF: [Aquí el número de página donde viste la prenda]
                    FOTO` },
                    { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
                    { inlineData: { mimeType: 'image/jpeg', data: image } }
                ]
            }]
        };

        const result = await model.generateContent(promptFinal);
        const textoIA = result.response.candidates[0].content.parts[0].text;

        // 3. Ajuste de Offset y Limpieza
        let textoFinalParaFrontend = textoIA;
        const pagMatch = textoIA.match(/PAGINA_REF:\s*(\d+)/i);
        
        if (pagMatch) {
            const numPdf = parseInt(pagMatch[1]);
            // Ajustamos el offset: si la página 2 del PDF es tu (001).jpg, el offset es -1
            const offset = -1; 
            const numCorregido = numPdf + offset;
            textoFinalParaFrontend = textoFinalParaFrontend.replace(/PAGINA_REF:\s*\d+/i, `PAGINA_REF: ${numCorregido}`);
        }

        // Limpiamos etiquetas para que la voz no las lea
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
        console.error("Error en AURAM 2.5:", err.message);
        res.status(200).json({ isError: true, detalle: err.message });
    }
}
