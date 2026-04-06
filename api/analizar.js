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
   // ... dentro de tu api/analizar.js en la parte del prompt ...
const request = {
  contents: [{
    role: 'user',
    parts: [
      { text: `Actúa como AURAM, un asistente de estilo personal altamente empático y sofisticado. 
      Tu objetivo es que el usuario se sienta inspirado y seguro de sí mismo.
      
      INSTRUCCIONES DE ESTILO:
      1. Analiza profundamente la imagen del usuario.
      2. Busca en el catálogo PDF la prenda perfecta para: ${ocasion}.
      3. Tu recomendación debe ser detallada, cálida y agradable (exactamente 100 palabras). 
      4. Explica por qué esa prenda armoniza con su presencia y cómo elevará su "aura" en ese evento.
      5. Cita el nombre de la prenda y el precio exacto que lees en el PDF.

      REGLA TÉCNICA CRÍTICA:
      Al final de tu consejo, DEBES escribir exactamente estas dos líneas:
      Género: [hombre/mujer]
      Página: [Número de página] FOTO` 
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
