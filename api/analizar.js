const { VertexAI } = require('@google-cloud/vertexai');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ isError: true, detalle: "Método no permitido" });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    const vertex_ai = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: 'us-central1', 
      googleAuthOptions: { credentials }
    });

    // Usamos el modelo 2.5 Flash
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 1. Identificamos género para no cargar archivos innecesarios
    const resGen = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Solo responde 'hombre' o 'mujer' según la foto." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
    });
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
    const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

    // 2. Prompt con "Anclaje de Datos" para evitar inventos
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM. Tienes el catálogo de ${gen} frente a ti. 
          TAREA: Recomienda una prenda para "${ocasion}" USANDO SOLO LOS DATOS DEL PDF.
          
          REGLAS:
          - Lee el NOMBRE y el PRECIO del PDF. PROHIBIDO inventar.
          - Si el PDF dice S/. 100, di S/. 100. No aproximes ni supongas.
          - Describe la prenda brevemente (máx 50 palabras).

          RESPUESTA:
          [Tu consejo]
          Género: ${gen}
          Página: [Número] FOTO` 
          },
          { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const result = await model.generateContent(promptFinal);
    const responseIA = result.response.candidates[0].content.parts[0].text;

    return res.status(200).json({ candidates: [{ content: { parts: [{ text: responseIA }] } }] });

  } catch (err) {
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
