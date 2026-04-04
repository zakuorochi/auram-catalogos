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
            1. Saluda según la hora y resalta la armonía visual del usuario.
            2. Identifica si es hombre o mujer.
            3. Da un consejo para la ocasión: ${ocasion}, basado en tendencias y atributos físicos (sin mencionarlos directamente).
            4. Recomienda 2 prendas: Nombre, Precio (Soles) y Razón.
            5. Obligatorio finalizar con este formato:
               Género: [hombre/mujer]
               Página: [Número] FOTO
            
            RESTRICCIÓN: Máximo 75 palabras. Tono empático.` },
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
