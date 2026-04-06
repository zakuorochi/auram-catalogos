const { VertexAI } = require('@google-cloud/vertexai');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ isError: true, detalle: "Método no permitido" });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    const vertex_ai = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: 'us-central1', 
      googleAuthOptions: { credentials }
    });

    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // --- PASO 1: DETECTAR GÉNERO ---
    const promptGenero = {
      contents: [{
        role: 'user',
        parts: [
          { text: "Responde solo una palabra: 'hombre' o 'mujer' según la persona en la foto." },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };
    const resGenero = await model.generateContent(promptGenero);
    const generoDetectado = resGenero.response.candidates[0].content.parts[0].text.toLowerCase().trim();

    // Seleccionamos solo el PDF necesario
    const urlPdf = generoDetectado.includes('mujer') 
                   ? 'gs://auram-assets-01/mujer.pdf' 
                   : 'gs://auram-assets-01/hombre.pdf';

    // --- PASO 2: RECOMENDACIÓN REAL BASADA EN EL PDF ---
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, experto en moda. Tienes abierto el catálogo de ${generoDetectado}.
          
          INSTRUCCIONES CRÍTICAS:
          1. Lee las páginas del PDF adjunto.
          2. Busca una prenda para la ocasión: ${ocasion}.
          3. EXTRAE EL NOMBRE Y PRECIO LITERAL. Si el PDF dice "Camisa Oxford S/ 120", NO digas "Polo casual S/ 100".
          4. Tu respuesta debe basarse 100% en el texto que VEAS en el PDF. Si no estás seguro, cita la página.

          RESPUESTA:
          - Consejo empático (máx 50 palabras).
          - Prenda y Precio EXACTOS del PDF.
          
          CIERRE:
          Género: ${generoDetectado}
          Página: [Número de página del PDF] FOTO` 
          },
          { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const resFinal = await model.generateContent(promptFinal);
    const textoFinal = resFinal.response.candidates[0].content.parts[0].text;

    return res.status(200).json({ 
        candidates: [{ content: { parts: [{ text: textoFinal }] } }] 
    });

  } catch (err) {
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
