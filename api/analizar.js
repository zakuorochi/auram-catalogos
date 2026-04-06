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

    // --- CAMBIO A GEMINI 2.5 FLASH ---
    const generativeModel = vertex_ai.getGenerativeModel({
      model: 'gemini-2.5-flash', 
    });

    const pdfMujer = 'gs://auram-assets-01/mujer.pdf';
    const pdfHombre = 'gs://auram-assets-01/hombre.pdf';

    const request = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, el asistente de estilo inteligente.
          
          TU TAREA:
          1. Identifica el género y estilo de la persona en la foto.
          2. Abre el PDF correspondiente (${pdfMujer} o ${pdfHombre}).
          3. REGLA ESTRICTA: Lee el texto del PDF. Encuentra una prenda para "${ocasion}".
          4. EXTRAE EL PRECIO Y NOMBRE REAL: No inventes. Si el PDF dice "Blazer Azul S/ 450", no digas "Saco Azul S/ 400".
          
          ESTRUCTURA DE RESPUESTA:
          - Saludo y consejo de estilo (máx 60 palabras).
          - Nombre de prenda y precio EXACTO del catálogo.
          
          CIERRE OBLIGATORIO:
          Género: [hombre/mujer]
          Página: [Número] FOTO` 
          },
          { fileData: { mimeType: 'application/pdf', fileUri: pdfMujer } },
          { fileData: { mimeType: 'application/pdf', fileUri: pdfHombre } },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const streamingResp = await generativeModel.generateContent(request);
    const responseIA = streamingResp.response.candidates[0].content.parts[0].text;

    return res.status(200).json({ 
        candidates: [{ content: { parts: [{ text: responseIA }] } }] 
    });

  } catch (err) {
    console.error("Error en el servidor:", err);
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
