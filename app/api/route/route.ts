import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { pickup, dropoff } = await req.json();

    if (!pickup || !dropoff) {
      return NextResponse.json(
        { error: "Origen y destino requeridos" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key no configurada" },
        { status: 500 }
      );
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      pickup
    )}&destinations=${encodeURIComponent(dropoff)}&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.rows || !data.rows[0]?.elements[0]) {
      return NextResponse.json(
        { error: "No se encontró ruta" },
        { status: 400 }
      );
    }

    const element = data.rows[0].elements[0];

    if (element.status !== "OK") {
      return NextResponse.json(
        { error: element.status },
        { status: 400 }
      );
    }

    return NextResponse.json({
      distance: element.distance.value,
      duration: element.duration.value,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Error del servidor" },
      { status: 500 }
    );
  }
}