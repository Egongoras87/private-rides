import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { viajeId } = await req.json();

    if (!viajeId) {
      return NextResponse.json({ error: "viajeId requerido" }, { status: 400 });
    }

    const refViaje = adminDb.ref("viajes/" + viajeId);

    // 🔥 LECTURA REAL
    const snap = await refViaje.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 VALIDACIONES FUERTES
    if (v.driverId) {
      return NextResponse.json({ error: "Ya tomado" }, { status: 409 });
    }

    if (!v.estado || v.estado.trim().toLowerCase() !== "pendiente") {
      return NextResponse.json({ error: "No disponible" }, { status: 409 });
    }

    // 🔥 UPDATE DIRECTO
    await refViaje.update({
      estado: "Asignado",
      driverId: uid,
      asignadoAt: Date.now()
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error" },
      { status: 500 }
    );
  }
}