import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    // 🔐 SOLO DRIVER AUTORIZADO
    const { uid } = await requireDriver(req);

    const { viajeId } = await req.json();

    if (!viajeId) {
      return NextResponse.json({ error: "viajeId requerido" }, { status: 400 });
    }

    const refViaje = adminDb.ref("viajes/" + viajeId);
    const snap = await refViaje.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 VALIDAR DRIVER
    if (v.driverId !== uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 🔒 VALIDAR ESTADO (MUY IMPORTANTE)
    if (v.estado !== "En viaje") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    // 🔒 PROTEGER DOBLE FINALIZACIÓN
    if (v.finalizadoAt) {
      return NextResponse.json({ error: "Ya finalizado" }, { status: 400 });
    }

    await refViaje.update({
  estado: "Finalizado",
  finalizadoAt: Date.now(),
  driverLat: null,
  driverLng: null
});

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error" },
      { status: 500 }
    );
  }
}