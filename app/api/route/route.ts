import { NextResponse } from "next/server";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwYmAl_thVEeB3vJ6kAw7MxLsLej5Vt2JuzEgoXO83pkMLc9EQohRJ6EzzmoVeF6gG9yg/exec";

// 🟢 GET: Verificación rápida de estado
export async function GET() {
  return NextResponse.json({ 
    status: "API Operativa ✅",
    timestamp: new Date().toISOString()
  });
}

// 🔥 POST MAESTRO: Maneja Reservas, Estados y Ubicación (Arreglo 3)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // --- LÓGICA ARREGLO 3: DETECCIÓN DE TIPO DE ACCIÓN ---
    
    // 1. Si es actualización de ubicación (Driver enviando GPS)
    if (body.updateLocation) {
      if (!body.tripId || !body.lat || !body.lng) {
        return NextResponse.json({ success: false, message: "Datos de GPS incompletos" }, { status: 400 });
      }
      return await forwardToGoogle(body);
    }

    // 2. Si es actualización de estado (Driver cambiando a "En camino", "Finalizado", etc.)
    if (body.updateStatus) {
      if (!body.tripId || !body.status) {
        return NextResponse.json({ success: false, message: "Falta ID o Estado" }, { status: 400 });
      }
      return await forwardToGoogle(body);
    }

    // 3. Si no es ninguna de las anteriores, procesamos como NUEVA RESERVA (Usuario)
    const { tripId, name, phone, pickup, dropoff, price, distance, dateTime } = body;

    // VALIDACIÓN ESTRICTA
    if (!tripId || !name || !phone || !pickup || !dropoff || !dateTime) {
      return NextResponse.json(
        { success: false, message: "Error: Faltan campos obligatorios para la reserva." },
        { status: 400 }
      );
    }

    // 🧹 LIMPIEZA DE DATOS (Arreglo 3: Sanitización para CSV)
    const payload = {
      tripId: tripId.trim(),
      name: name.trim(),
      phone: phone.trim().replace(/\s/g, ""),
      pickup: pickup.replace(/,/g, " -"), 
      dropoff: dropoff.replace(/,/g, " -"),
      price: price || 0,
      distance: distance || 0,
      dateTime: dateTime,
      status: "Pendiente"
    };

    return await forwardToGoogle(payload);

  } catch (error: any) {
    console.error("CRITICAL API ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor", error: error.message },
      { status: 500 }
    );
  }
}

// 🚀 FUNCIÓN AUXILIAR DE ENVÍO A GOOGLE APPS SCRIPT
async function forwardToGoogle(payload: any) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8", 
      },
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();
    let result;
    
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { success: res.ok, message: res.ok ? "Operación exitosa" : "Error en Google Script" };
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ success: false, message: "Error de conexión con el motor de base de datos" }, { status: 502 });
  }
}