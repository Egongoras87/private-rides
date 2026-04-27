export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbyaLJPd6q1iipDqwytovCyoG0wJWesWQ_93_0tPS_9L6-RaGCR0Q53HpUfWJvKYf3XnWw/exec",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(body),
      }
    );

    const text = await res.text();

    // 👇 FORZAMOS JSON seguro
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { success: false, raw: text };
    }

    return Response.json(data);

  } catch (error) {
    return Response.json({ success: false, error });
  }
}