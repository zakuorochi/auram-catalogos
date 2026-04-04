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
            { text: `Eres AURAM, asesor de moda de lujo. El usuario va a una ${ocasion}. Analiza la ropa que ves y recomienda una prenda de catálogo. Indica Página: [Número] y la palabra FOTO.` },
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ]
        }]
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
