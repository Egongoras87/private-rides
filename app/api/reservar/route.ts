export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("ACTION:", body.action);
console.log("LAT:", body.driverLat);
console.log("LNG:", body.driverLng);

    const res = await fetch("https://script.google.com/macros/s/AKfycbzU7UWCBVBDcW5eqZLjHtQGoUz5pcwRCWmPGIIlcq1phLVrwUovnW16G6vXuSZqLN0OKg/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...body,
        key: process.env.API_KEY
      })
    });

    const data = await res.json();

    console.log("SCRIPT RESPONSE:", data);

    return Response.json(data);

  } catch (error) {
    console.error("API ERROR:", error);
    return Response.json({ success: false });
  }
}