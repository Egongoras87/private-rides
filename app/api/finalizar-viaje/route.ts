import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

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

        if (
         actual.refundProcesado
          ) {

  return;
          }

        // 🔒 SOLO EN VIAJE
        if (actual.estado !== "En viaje") {
          return;
        }

        // 🔒 EVITAR DOBLE FINALIZACIÓN
        if (actual.finalizadoAt) {
          return;
        }

        // ✅ FINALIZAR
       return {

  ...actual,

  estado:
    "Finalizado",

  fase:
    "finalizado",

  trackingVisible:
    false,

  navigationMode:
    null,

  navigationActive:
    false,

  routeVersion:
    (actual.routeVersion || 0) + 1,

  driverLat:
    null,

  driverLng:
    null,

  expiraAt:
    null,

  rechazos:
    null,

  finalizadoAt:
    Date.now()
};
      });

    // ❌ NO COMMIT
    if (!result.committed) {

      return NextResponse.json(
        {
          error:
            "No se pudo finalizar el viaje"
        },
        { status: 409 }
      );
    }

    // ✅ LIBERAR DRIVER
    await adminDb
      .ref("drivers/" + uid)
      .update({

        viajeActivo: null,

        navegando: false,

        updatedAt: Date.now()
      });

    return NextResponse.json({
      ok: true
    });

  } catch (err: any) {

    console.error(
      "FINALIZAR ERROR:",
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