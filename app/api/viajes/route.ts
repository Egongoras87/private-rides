export async function GET() {
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbyaLJPd6q1iipDqwytovCyoG0wJWesWQ_93_0tPS_9L6-RaGCR0Q53HpUfWJvKYf3XnWw/exec"
    );

    const text = await res.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error("Error parseando:", text);
      return Response.json([]);
    }

    return Response.json(data);

  } catch (error) {
    console.error("Error fetch:", error);
    return Response.json([]);
  }
}