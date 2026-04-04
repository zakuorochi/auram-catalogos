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
            INSTRUCCIONES DE RESPUESTA:
            1. Saluda según la hora del día (Buenos días/tardes/noches).
            2. Realiza una apreciación cálida resaltando facciones o armonía visual del usuario.
            3. Da un consejo basado en tendencias actuales y los atributos físicos detectados (colorimetría, rasgos), pero NUNCA menciones directamente palabras como "piel", "peso", "ojos" o "estatura". Usa términos como "tonalidades que te iluminan" o "siluetas que aportan dinamismo".
            4. Recomienda máximo 2 prendas del catálogo. Por cada una indica: Nombre, Precio (inventa uno acorde a lujo) y la Razón de elección.
            5. Finaliza con: Página: [Número] FOTO.
            
            RESTRICCIÓN CRÍTICA: Máximo 75 palabras en total. Tono humano y refinado.
            Contexto de ocasión: ${ocasion}.` },
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
