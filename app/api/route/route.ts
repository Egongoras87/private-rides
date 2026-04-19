import { NextResponse } from "next/server";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxbADQMOyzmYTPHZoLrHAZtMRYNrJjGDTQq8FbJkNlvcGEuZvAl7hUPFlrwAcHZFa-BA/exec";

// 🟢 GET (prueba API)
export async function GET() {
  return NextResponse.json({ status: "API OK ✅" });
}

// 🔥 POST (RESERVA)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      name,
      phone,
      pickup,
      dropoff,
      price,
      distance,
      dateTime
    } = body;

    // 🧠 VALIDACIÓN BÁSICA
    if (!name || !phone || !pickup || !dropoff || !dateTime) {
      return NextResponse.json(
        { success: false, message: "Datos incompletos" },
        { status: 400 }
      );
    }

    // 🚀 ENVÍO A APPS SCRIPT
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({
        name,
        phone,
        pickup,
        dropoff,
        price,
        distance,
        dateTime
      })
    });

    let result;

    try {
      result = await res.json();
    } catch {
      result = { success: true };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Error servidor" },
      { status: 500 }
    );
  }
}