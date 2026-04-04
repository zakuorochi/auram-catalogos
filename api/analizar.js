export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Solo POST permitido' } });

  try {
    const { image, ocasion } = JSON.parse(req.body);
    const API_KEY = process.env.GEMINI_API_KEY;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Eres AURAM, asesor de moda de lujo. Recomienda algo para ${ocasion}. Indica Página: [Número] y la palabra FOTO.` },
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();

    // Si Google responde con un error, lo enviamos tal cual
    if (data.error) {
      return res.status(200).json({ 
        isError: true, 
        detalle: data.error.message,
        codigo: data.error.code 
      });
    }

    res.status(200).json(data);

  } catch (error) {
    res.status(200).json({ 
      isError: true, 
      detalle: "Error de conexión servidor: " + error.message 
    });
  }
}
