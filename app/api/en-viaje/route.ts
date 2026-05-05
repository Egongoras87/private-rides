import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    // 🔐 SOLO DRIVER
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

    // 🔒 BLOQUEAR SI YA TERMINÓ
    if (v.estado === "Finalizado") {
      return NextResponse.json({ error: "Viaje ya finalizado" }, { status: 400 });
    }

    // 🔒 BLOQUEAR SI CANCELADO
    if (v.estado === "Cancelado") {
      return NextResponse.json({ error: "Viaje cancelado" }, { status: 400 });
    }

    // 🔒 EVITAR DOBLE TRANSICIÓN
    if (v.estado === "En viaje") {
      return NextResponse.json({ ok: true });
    }

    // ✅ PERMITIR TRANSICIONES VÁLIDAS
    if (v.estado !== "En camino" && v.estado !== "Asignado") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    // 🔥 UPDATE
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