export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const API_KEY = process.env.GEMINI_API_KEY;

    // EL NOMBRE QUE ENCONTRAMOS MANUALMENTE
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Eres AURAM, asesor de moda empático. El usuario va a una ${ocasion}. Analiza la foto y recomienda una prenda de catálogo. Indica Página: [Número] y la palabra FOTO al final.` },
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();

    // Si Google nos dice qué falló, lo enviamos para leerlo en pantalla
    if (data.error) {
        return res.status(200).json({ error: data.error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(200).json({ error: "Error de servidor: " + error.message });
  }
}
