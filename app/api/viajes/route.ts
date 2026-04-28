export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
      console.error("❌ API_KEY no definida");
      return Response.json({ error: "Missing API_KEY" });
    }

    const url =
      "https://script.google.com/macros/s/AKfycbzU7UWCBVBDcW5eqZLjHtQGoUz5pcwRCWmPGIIlcq1phLVrwUovnW16G6vXuSZqLN0OKg/exec?key=" +
      API_KEY;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow"
    });

    const text = await res.text();

    // 🔥 LIMPIEZA EXTRA (CLAVE)
    const cleanText = text.trim();

    // 🚨 DETECTAR HTML
    if (
      cleanText.startsWith("<!DOCTYPE") ||
      cleanText.startsWith("<html") ||
      cleanText.includes("<html")
    ) {
      console.error("❌ HTML DETECTADO:", cleanText);
      return Response.json({ error: "HTML response from script" });
    }

    // 🔥 PARSEO SEGURO
    let data;
    try {
      data = JSON.parse(cleanText);
    } catch (e) {
      console.error("❌ JSON inválido:", cleanText);
      return Response.json({ error: "Invalid JSON" });
    }

    if (!Array.isArray(data)) {
      return Response.json({ error: "Invalid format" });
    }

    const filas = data.slice(1);

    // 🎯 TRACKING
    if (id) {
      const viaje = filas.find(
        (v: any) => String(v[0]) === String(id)
      );

      return Response.json(viaje || null);
    }

    // 🚗 DRIVER
    return Response.json(data);

  } catch (error: any) {
    console.error("🔥 API ERROR:", error.message);
    return Response.json({ error: "Server error" });
  }
}