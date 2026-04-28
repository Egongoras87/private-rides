export async function POST() {
  try {
    return Response.json({ disponible: true });
  } catch {
    return Response.json({ disponible: true });
  }
}