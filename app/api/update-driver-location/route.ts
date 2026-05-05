import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { viajeId, lat, lng } = await req.json();

    const refViaje = adminDb.ref("viajes/" + viajeId);
    const snap = await refViaje.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 SOLO EL DRIVER ASIGNADO
    if (v.driverId !== uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await refViaje.update({
      driverLat: lat,
      driverLng: lng,
      timestamp: Date.now()
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}