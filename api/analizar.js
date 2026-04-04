// api/analizar.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) return res.status(200).json({ error: "Falta configurar la llave en Vercel" });

    // 🚀 USANDO EL MODELO LITE (MÁS RÁPIDO Y ESTABLE)
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-001:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Eres AURAM, asesor de moda de lujo. El usuario va a una ${ocasion}. Analiza la foto y recomienda una prenda de catálogo. Indica Página: [Número] y termina con la palabra FOTO.` },
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ]
        }],
        generationConfig: {
          temperature: 1, // Mantiene la creatividad y empatía
          topP: 0.95,
          maxOutputTokens: 800
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ error: "Google dice: " + data.error.message });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(200).json({ error: "Error de servidor: " + error.message });
  }
}
