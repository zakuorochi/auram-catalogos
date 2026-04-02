// api/analizar.js
export default async function handler(req, res) {
  // Manejar el caso de que Vercel reciba la petición
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const API_KEY = process.env.GEMINI_API_KEY;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{
        parts: [
          { text: `Eres AURAM, asesor de moda empático. El usuario va a una ${ocasion}. Analiza la foto y recomienda una prenda de catálogo. Indica Página: [Número] y la palabra FOTO al final.` },
          { inlineData: { mimeType: "image/jpeg", data: image } }
        ]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
