import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

export async function POST(req: Request) {

  try {

    // 🔐 TOKEN
    const token =
      req.headers
        .get("authorization")
        ?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "No token" },
        { status: 401 }
      );
    }

    // 🔐 VERIFY TOKEN
    const decoded =
      await adminAuth.verifyIdToken(token);

    const uid = decoded.uid;

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

    // 🔥 TRANSACTION SEGURA
    const result =
      await viajeRef.transaction((actual) => {

        // ❌ no existe
        if (!actual) {
          return actual;
        }

        // 🔒 YA TOMADO
        if (
          actual.driverId ||
          actual.estado !== "Pendiente"
        ) {
          return;
        }

        // ✅ ASIGNAR VIAJE
        return {

          ...actual,

          estado: "Asignado",

          fase: "asignado",

          driverId: uid,

          trackingVisible: false,

          asignadoAt: Date.now()
        };
      });

    // ❌ SI OTRO DRIVER LO TOMÓ
    if (!result.committed) {

      return NextResponse.json(
        {
          error:
            "Este viaje ya fue aceptado por otro conductor"
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
            "No se pudo asignar el viaje"
        },
        { status: 409 }
      );
    }

    // ✅ OPCIONAL:
    // guardar último viaje aceptado
    await adminDb
      .ref("drivers/" + uid)
      .update({

        ultimoViajeAceptado: viajeId,

        updatedAt: Date.now()
      });

    return NextResponse.json({
      ok: true,
      viajeId
    });

  } catch (err: any) {

    console.error(
      "ACEPTAR VIAJE ERROR:",
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