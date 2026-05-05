import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    // 🔐 SOLO DRIVERS AUTORIZADOS
    const { uid } = await requireDriver(req);

    const { viajeId } = await req.json();

    const refViaje = adminDb.ref("viajes/" + viajeId);
    const snap = await refViaje.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 SOLO DRIVER ASIGNADO
    if (v.driverId !== uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 🔒 VALIDAR ESTADO
    if (v.estado !== "Asignado") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    await refViaje.update({
      estado: "En camino",
      enCaminoAt: Date.now()
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error" },
      { status: 500 }
    );
  }
}