import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

// 📍 DISTANCIA EN METROS
function calcularDistancia(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {

  const R = 6371000;

  const dLat =
    (lat2 - lat1) * Math.PI / 180;

  const dLng =
    (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) *
    Math.sin(dLat / 2) +

    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *

    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

export async function POST(req: Request) {

  try {

    // 🔐 DRIVER AUTH
    const { uid } =
      await requireDriver(req);

    // 📦 BODY
    const { viajeId } =
      await req.json();

    if (!viajeId) {

      return NextResponse.json(
        { error: "viajeId requerido" },
        { status: 400 }
      );
    }

    // 📍 REF
    const viajeRef =
      adminDb.ref("viajes/" + viajeId);

    // 🔥 TRANSACTION
    const result =
      await viajeRef.transaction((actual) => {

        // ❌ no existe
        if (!actual) {
          return actual;
        }

        // 🔒 SOLO DRIVER DUEÑO
        if (actual.driverId !== uid) {
          return;
        }

        // 🔒 BLOQUEAR CANCELADO / FINALIZADO
        if (
          actual.estado === "Cancelado" ||
          actual.estado === "Finalizado"
        ) {
          return;
        }

        // 🔒 SOLO EN CAMINO
        if (
          actual.estado !== "En camino"
        ) {
          return;
        }

        // 📍 DISTANCIA PICKUP
        let distanciaPickup = 0;

        if (
          actual.driverLat &&
          actual.driverLng &&
          actual.origenLat &&
          actual.origenLng
        ) {

          distanciaPickup =
            calcularDistancia(

              Number(actual.driverLat),
              Number(actual.driverLng),

              Number(actual.origenLat),
              Number(actual.origenLng)
            );
        }

        // ⚠️ SOLO ADVERTENCIA
        const warningLejosPickup =
          distanciaPickup > 120;

        // ✅ CAMBIAR ESTADO
        return {

          ...actual,

          estado: "En viaje",

          fase: "destino",

          pickupCompletado: true,

          navigationMode: "destino",

          trackingVisible: true,

          warningLejosPickup,

          distanciaPickup,

          routeVersion:
            (actual.routeVersion || 0) + 1,

          enViajeAt: Date.now()
        };
      });

    // ❌ FALLÓ
    if (!result.committed) {

      return NextResponse.json(
        {
          error:
            "No se pudo iniciar el trayecto"
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true
    });

  } catch (err: any) {

    console.error(
      "EN VIAJE ERROR:",
      err
    );

    return NextResponse.json(
      {
        error:
          err.message || "Error interno"
      },
      { status: 500 }
    );
  }
}