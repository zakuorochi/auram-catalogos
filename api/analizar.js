export default async function handler(req, res) {
  // 1. Solo aceptamos POST
  if (req.method !== 'POST') return res.status(200).json({ isError: true, detalle: "Método no permitido" });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const API_KEY = process.env.GEMINI_API_KEY;

    // 2. Verificamos que la llave esté ahí
    if (!API_KEY) return res.status(200).json({ isError: true, detalle: "No hay API KEY configurada en Vercel" });

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

 const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Eres AURAM, un sofisticado asesor de moda empático. 
            CONTEXTOS DE ESTILO:
            - Boda/Gala: Máxima elegancia, formalidad y distinción.
            - Casual: Comodidad con estilo, relajado pero pulcro.
            - Cita: Atractivo, balance entre seguridad y magnetismo.
            - Reunión Familiar: Cálido, respetuoso y confortable.
            - Amigos: Tendencias urbanas, creativo y con personalidad.
            - Trabajo: Profesionalismo, autoridad y sobriedad moderna.

            INSTRUCCIONES:
            1. Saluda según la hora. 2. Haz una apreciación cálida de su armonía visual.
            3. Da un consejo basado en tendencias y el escenario: ${ocasion}. 
            4. Usa términos como "tonalidades que te iluminan" o "cortes que estilizan" (NO menciones peso, piel o estatura directamente).
            5. Recomienda 2 prendas: Nombre, Precio (Soles) y Razón.
            6. Finaliza con: Página: [Número] FOTO.
            
            RESTRICCIÓN: Máximo 75 palabras. Tono humano y refinado.` },
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ]
        }],
        generationConfig: {
          temperature: 0.8, // Un poco más de calidez humana
          maxOutputTokens: 250 // Suficiente para las 75 palabras
        }
      })
    });

    const data = await response.json();

    // 3. Si Google da error, lo mandamos simplificado
    if (data.error) {
      return res.status(200).json({ isError: true, detalle: data.error.message });
    }

    // 4. Si todo está bien, mandamos la data
    return res.status(200).json(data);

  } catch (err) {
    // Si el JSON falla o algo explota, mandamos texto puro
    return res.status(200).json({ isError: true, detalle: "Error en el servidor: " + err.message });
  }
}
