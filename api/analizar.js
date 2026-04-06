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
          { text: `Eres AURAM, un Personal Shopper de lujo. 
          INSTRUCCIONES:
          1. Analiza el género y estilo de la persona en la imagen.
          2. BUSCA en los PDFs adjuntos la prenda ideal para la ocasión: ${ocasion}.
          3. Da un consejo empático y sofisticado (máx 70 palabras).
          4. Indica la PÁGINA EXACTA del PDF donde está la prenda.
          
          FORMATO DE SALIDA (ESTRICTO):
          [Tu consejo de estilo]
          Género: [hombre/mujer]
          Página: [Número] FOTO` },
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
