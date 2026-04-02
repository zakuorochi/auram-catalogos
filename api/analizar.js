export default async function handler(req, res) {
  const { image, ocasion } = JSON.parse(req.body);
  const API_KEY = process.env.GEMINI_API_KEY; // Vercel toma la llave de la caja fuerte

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [{
      parts: [
        { text: `Eres AURAM, asesor de moda empático. Recomienda algo para ${ocasion}. Indica Página: [Número] y la palabra FOTO.` },
        { inlineData: { mimeType: "image/jpeg", data: image } }
      ]
    }]
  };

  try {
    const response = await fetch(url, { method: 'POST', body: JSON.stringify(payload) });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
