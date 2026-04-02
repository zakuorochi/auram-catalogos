// api/analizar.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const API_KEY = process.env.GEMINI_API_KEY;

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

    // 🚨 REVISIÓN DE ERRORES DE CUOTA O SEGURIDAD
    if (data.error) {
        let mensaje = data.error.message;
        if (data.error.code === 429) mensaje = "Límite de cuota excedido. Espera un minuto.";
        if (data.error.code === 400) mensaje = "Error en el formato de imagen o modelo.";
        return res.status(200).json({ error: mensaje });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(200).json({ error: "Error de servidor: " + error.message });
  }
}
