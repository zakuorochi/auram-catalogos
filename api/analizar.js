export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ isError: true, detalle: "Método no permitido" });

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
           { text: `Eres AURAM, asesor de moda de lujo.
INSTRUCCIONES DE CATÁLOGO:
- Si detectas MUJER: Solo puedes recomendar páginas entre la 1 y la 15 (que es el límite de tu catálogo actual).
- Si detectas HOMBRE: Solo puedes recomendar páginas entre la 1 y la 10.
- Describe las prendas basándote en lo que vería un usuario en un catálogo de alta gama.

REGLAS DE FORMATO (ESTRICTO):
1. Saludo empático según hora.
2. Consejo de estilo para la ocasión: ${ocasion}.
3. Recomienda 2 prendas con Precio (Soles) y Razón.
4. Finaliza EXACTAMENTE con estas dos líneas:
Género: [mujer o hombre]
Página: [Número] FOTO

RESTRICCIÓN: Máximo 75 palabras.` }
            { inlineData: { mimeType: "image/jpeg", data: image } }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(200).json({ isError: true, detalle: data.error.message });
    return res.status(200).json(data);

  } catch (err) {
    return res.status(200).json({ isError: true, detalle: err.message });
  }
}
