// ... (mismo inicio de importaciones y cabeceras) ...

try {
    const { image, ocasion } = JSON.parse(req.body);
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const project = process.env.GOOGLE_CLOUD_PROJECT_ID;

    const vertex_ai = new VertexAI({ project, location: 'us-central1', googleAuthOptions: { credentials } });
    const ttsClient = new textToSpeech.TextToSpeechClient({ credentials });
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // 1. DETECCIÓN DE GÉNERO (OBLIGATORIO)
    // Analizamos la foto del usuario para saber si es hombre o mujer
    const resGen = await model.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [
          { text: "Analiza a la persona de la foto y responde ÚNICAMENTE con la palabra 'hombre' o 'mujer' según su apariencia física." }, 
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ] 
      }]
    });
    
    const gen = resGen.response.candidates[0].content.parts[0].text.toLowerCase().trim();
    
    // Definimos la ruta de la carpeta según el género detectado
    const folderPath = `gs://auram-assets-01/auram-catalogos/${gen}/`;

    // 2. ANÁLISIS DINÁMICO (Sin límites de página)
    const promptFinal = {
      contents: [{
        role: 'user',
        parts: [
          { text: `Eres AURAM, asistente de moda. 
          
          CONTEXTO:
          1. El usuario se ha tomado una foto y quiere ir a: ${ocasion}.
          2. Tienes acceso a todas las imágenes del catálogo en la ruta: ${folderPath}.
          
          TAREA:
          - Analiza visualmente la ropa y las caracteristicas fisicas del usuario y compárala con TODAS las imágenes disponibles en el catálogo de ${gen.toUpperCase()}.
          - Selecciona la prenda que mejor complemente su estilo o sea la opción ideal para la ocasión.
          - No te limites a un rango; busca el número de imagen (001.jpg, 002.jpg, etc.) que realmente corresponda a la mejor prenda.
          
          REGLAS DE RESPUESTA:
          - Escribe una recomendación cálida de máximo 60 palabras.
          - Menciona el precio exacto que aparece en la imagen seleccionada.

          CIERRE OBLIGATORIO (Para el sistema):
          GENERO_REF: ${gen}
          IMG_REF: [Número de la imagen seleccionada sin ceros a la izquierda innecesarios, ej: 15, 120, 5]
          FOTO` },
          { inlineData: { mimeType: 'image/jpeg', data: image } }
        ]
      }]
    };

    const result = await model.generateContent(promptFinal);
    const textoIA = result.response.candidates[0].content.parts[0].text;

    // ... (Sigue con el TTS y el envío de respuesta que ya tenemos) ...
