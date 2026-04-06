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

    // Usamos Gemini 2.5 Flash
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // --- PASO 1: DETECTAR GÉNERO (RÁPIDO) ---
    const promptGenero = {
      contents: [{
        role: 'user',
        parts: [
          { text: "Responde solo una palabra: 'hombre' o 'mujer' según la persona de la foto." },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };
    const resGen = await model.generateContent(promptGenero);
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();

    // Seleccionamos el PDF correcto del Bucket
    const urlPdf = gen.includes('mujer') 
                   ? 'gs://auram-assets-01/mujer.pdf' 
                   : 'gs://auram-assets-01/hombre.pdf';

    // --- PASO 2: RECOMENDACIÓN BASADA 100% EN EL PDF ---
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, el asistente de estilo de la tienda. 
          TIENES EL CATÁLOGO DE ${gen.toUpperCase()} ABIERTO DELANTE DE TI.
          
          INSTRUCCIONES DE EXTRACCIÓN LITERAL:
          1. Mira la foto del usuario y la ocasión: ${ocasion}.
          2. BUSCA en el PDF adjunto una prenda que encaje.
          3. PROHIBIDO INVENTAR PRECIOS. Debes leer el precio que está escrito en el catálogo.
          4. PROHIBIDO INVENTAR NOMBRES. Usa el nombre exacto de la prenda del catálogo.
          
          RESPUESTA:
          - Da un consejo de estilo elegante (máx 50 palabras).
          - Escribe: "Te recomiendo [Nombre de Prenda del PDF] a [Precio del PDF]".
          
          FORMATO DE CIERRE:
          Género: ${gen}
          Página: [Número de página del PDF] FOTO` 
          },
          { fileData: { mimeType: 'application/pdf', fileUri: urlPdf } },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const result = await model.generateContent(promptFinal);
    const responseIA = result.response.candidates[0].content.parts[0].text;

    return res.status(200).json({ 
        candidates: [{ content: { parts: [{ text: responseIA }] } }] 
    });

  } catch (err) {
    console.error("Error:", err);
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
