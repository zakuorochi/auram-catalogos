const { VertexAI } = require('@google-cloud/vertexai');

export default async function handler(req, res) {
  // 1. CABECERAS PARA EVITAR ERRORES DE CONEXIÓN (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ isError: true, detalle: "Método no permitido" });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    
    // Verificamos que las variables existan
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      return res.status(200).json({ isError: true, detalle: "Credenciales de Google no configuradas en Vercel" });
    }

    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const vertex_ai = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: 'us-central1', 
      googleAuthOptions: { credentials }
    });

    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // PASO 1: DETECCIÓN RÁPIDA DE GÉNERO
    const resGen = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Solo responde 'hombre' o 'mujer'." }, { inlineData: { mimeType: 'image/jpeg', data: image } }] }]
    });
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
    const urlPdf = gen.includes('mujer') ? 'gs://auram-assets-01/mujer.pdf' : 'gs://auram-assets-01/hombre.pdf';

    // PASO 2: RECOMENDACIÓN EMPÁTICA (100 PALABRAS)
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, un asistente de estilo personal empático y sofisticado. 
          TIENES EL CATÁLOGO DE ${gen.toUpperCase()} ABIERTO.
          
          TAREA:
          1. Analiza la imagen del usuario para la ocasión: ${ocasion}.
          2. Escribe una recomendación cálida y agradable de EXACTAMENTE 100 PALABRAS.
          3. Describe por qué elegiste la prenda y menciona su PRECIO REAL del catálogo.

          CIERRE OBLIGATORIO:
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
    console.error("Error en AURAM:", err);
    return res.status(200).json({ isError: true, detalle: "Error de servidor: " + err.message });
  }
}
