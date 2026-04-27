export async function GET() {
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbyaLJPd6q1iipDqwytovCyoG0wJWesWQ_93_0tPS_9L6-RaGCR0Q53HpUfWJvKYf3XnWw/exec"
    );

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return Response.json({ disponible: true });
    }

    if (!Array.isArray(data) || data.length < 2) {
      return Response.json({ disponible: true });
    }

    const ultimo = data[data.length - 1];

    const estado = ultimo[11];
    const fecha = new Date(ultimo[12]);
    const distancia = Number(ultimo[9]) || 0;

    const duracionMin = distancia * 2; // estimación
    const finViaje = new Date(fecha.getTime() + duracionMin * 60000);

    const ahora = new Date();
    const diffMin = (ahora.getTime() - finViaje.getTime()) / 60000;

    const disponible =
      (estado === "Finalizado" || estado === "Cancelado") &&
      diffMin >= 30;

    return Response.json({ disponible });

  } catch (error) {
    return Response.json({ disponible: true });
  }
}