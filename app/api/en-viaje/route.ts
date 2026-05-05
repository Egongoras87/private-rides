import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    // 🔐 SOLO DRIVERS AUTORIZADOS
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

    // 🔒 SOLO EL DRIVER ASIGNADO
    if (v.driverId !== uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 🔒 TRANSICIÓN VÁLIDA
    // Debe venir de "En camino"
    if (v.estado !== "En camino") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    await refViaje.update({
      estado: "En viaje",
      enViajeAt: Date.now()
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error" },
      { status: 500 }
    );
  }
}