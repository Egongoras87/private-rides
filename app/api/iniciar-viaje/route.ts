import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";

export async function POST(req: Request) {

  try {

    // 🔐 AUTH DRIVER
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

        // 🔒 SOLO DESDE ASIGNADO
        if (actual.estado !== "Asignado") {
          return;
        }

        // ✅ CAMBIAR ESTADO
        return {

          ...actual,

          estado: "En camino",

          fase: "pickup",

          trackingVisible: true,

          navigationActive: true,

          enCaminoAt: Date.now()
        };
      });

    // ❌ NO COMMIT
    if (!result.committed) {

      return NextResponse.json(
        {
          error:
            "No se pudo iniciar el viaje"
        },
        { status: 409 }
      );
    }

    // ✅ VALIDAR RESULTADO
    const viajeFinal =
      result.snapshot.val();

    if (
      !viajeFinal ||
      viajeFinal.driverId !== uid
    ) {

      return NextResponse.json(
        {
          error:
            "No autorizado"
        },
        { status: 403 }
      );
    }

    // ✅ OPCIONAL:
    // marcar navegación activa driver
    await adminDb
      .ref("drivers/" + uid)
      .update({

        navegando: true,

        viajeActivo: viajeId,

        updatedAt: Date.now()
      });

    return NextResponse.json({
      ok: true
    });

  } catch (err: any) {

    console.error(
      "INICIAR VIAJE ERROR:",
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