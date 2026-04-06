const { VertexAI } = require('@google-cloud/vertexai');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ isError: true, detalle: "Método no permitido" });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    
    // 1. Cargamos las credenciales desde las variables de entorno de Vercel
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    
    const vertex_ai = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: 'us-central1', // Asegúrate que sea la misma zona de tu Bucket
      googleAuthOptions: { credentials }
    });

    // 2. Usamos el modelo Flash que es experto en documentos y rápido
    const generativeModel = vertex_ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });

    // 3. Definimos las rutas de tus PDFs en Google Cloud Storage
    const pdfMujer = 'gs://auram-assets-01/mujer.pdf';
    const pdfHombre = 'gs://auram-assets-01/hombre.pdf';

  const request = {
  contents: [{
    role: 'user',
    parts: [
      { text: `Eres AURAM, el asesor de estilo de la tienda. 
      TU MISIÓN: Recomendar prendas que APARECEN REALMENTE en los PDFs adjuntos.
      
      REGLAS DE ORO:
      1. ANALIZA visualmente la foto del usuario.
      2. ESCANEA el PDF correspondiente (Hombre o Mujer).
      3. EXTRAE el nombre exacto de la prenda y el precio EXACTO que figura en el catálogo PDF.
      4. Si la prenda no está en el PDF, elige la más parecida del PDF. PROHIBIDO inventar precios o materiales que no estén escritos en el catálogo.
      
      RESPUESTA:
      - Consejo de estilo breve y empático (máx 60 palabras).
      - Menciona la prenda y el precio según el PDF.
      
      FORMATO DE CIERRE (OBLIGATORIO):
      Género: [hombre/mujer]
      Página: [Número de la página donde viste la prenda en el PDF] FOTO` 
      },
      { fileData: { mimeType: 'application/pdf', fileUri: pdfMujer } },
      { fileData: { mimeType: 'application/pdf', fileUri: pdfHombre } },
      { inlineData: { mimeType: 'image/jpeg', data: image } }
    ]
  }]
};

    const streamingResp = await generativeModel.generateContent(request);
    const responseIA = streamingResp.response.candidates[0].content.parts[0].text;

    // Enviamos la respuesta de vuelta al index.html
    return res.status(200).json({ 
        candidates: [{ content: { parts: [{ text: responseIA }] } }] 
    });

  } catch (err) {
    console.error("Error en el servidor:", err);
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
      return res.status(200).json({ isError: true, detalle: data.error.message });
    }
    
    return res.status(200).json(data);

  } catch (err) {
    return res.status(200).json({ isError: true, detalle: "Error en servidor: " + err.message });
  }
}
