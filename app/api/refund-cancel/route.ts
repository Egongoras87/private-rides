import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";

export async function POST(req: Request) {

  try {

    // =====================================================
    // 🔐 ENV
    // =====================================================

    const {
      FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY,
      STRIPE_SECRET_KEY
    } = process.env;

    if (
      !FIREBASE_PROJECT_ID ||
      !FIREBASE_CLIENT_EMAIL ||
      !FIREBASE_PRIVATE_KEY ||
      !STRIPE_SECRET_KEY
    ) {

      return NextResponse.json(
        { error: "ENV missing" },
        { status: 500 }
      );
    }

    // =====================================================
    // 🔥 FIREBASE
    // =====================================================

    const formattedKey =
      FIREBASE_PRIVATE_KEY
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim();

    const adminApp =
      getApps().length > 0

        ? getApp()

        : initializeApp({

            credential: cert({

              projectId:
                FIREBASE_PROJECT_ID,

              clientEmail:
                FIREBASE_CLIENT_EMAIL,

              privateKey:
                formattedKey
            }),

            databaseURL:
              "https://private-rides-52e08-default-rtdb.firebaseio.com"
          });

    const db =
      getDatabase(adminApp);

    // =====================================================
    // 💳 STRIPE
    // =====================================================

    const stripe =
      new Stripe(
        STRIPE_SECRET_KEY,
        {
          apiVersion:
            "2026-04-22.dahlia" as any
        }
      );

    // =====================================================
    // 📦 BODY
    // =====================================================

    const { viajeId } =
      await req.json();

    if (!viajeId) {

      return NextResponse.json(
        {
          error:
            "Falta viajeId"
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 🚗 VIAJE
    // =====================================================

    const viajeRef =
      db.ref(
        "viajes/" + viajeId
      );

    const snap =
      await viajeRef.once("value");

    if (!snap.exists()) {

      return NextResponse.json(
        {
          error:
            "Viaje no existe"
        },
        { status: 404 }
      );
    }

    const v = snap.val();

    // =====================================================
    // 🚫 YA FINALIZADO
    // =====================================================

    if (
      v.estado ===
        "Finalizado"

      ||

      v.estado ===
        "En viaje"
    ) {

      return NextResponse.json(
        {
          error:
            "Ride already started"
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 🚫 REFUND YA HECHO
    // =====================================================

    if (
      v.refundProcesado
    ) {

      return NextResponse.json({

        success: true,

        alreadyRefunded: true
      });
    }

    // =====================================================
    // 💳 CASH
    // =====================================================

    if (
      v.metodoPago !==
        "stripe"

      ||

      !v.paymentIntentId
    ) {

      await viajeRef.update({

        estado:
          "Cancelado",

        canceladoPor:
          "user",

        refundPercent: 0
      });

      return NextResponse.json({

        refunded: false
      });
    }

    // =====================================================
    // ⏳ REFUND LOGIC
    // =====================================================

    const now =
      Date.now();

    let refundPercent = 1;

    // 🚕 nadie aceptó
    if (!v.asignadoAt) {

      refundPercent = 1;

    } else {

      const minutos =

        (now - v.asignadoAt) /
        60000;

      // 🚗 usuario cancela rápido
      if (minutos <= 2) {

        refundPercent = 1;

      }

      // 🚗 cancelación media
      else if (
        minutos <= 5
      ) {

        refundPercent = 0.5;

      }

      // 🚗 muy tarde
      else {

        refundPercent = 0;
      }
    }

    // =====================================================
    // 🔒 BLOQUEAR REFUND
    // =====================================================

    await viajeRef.update({

      refundProcesado:
        refundPercent > 0
    });

    // =====================================================
    // 💳 REFUND
    // =====================================================

    let refund = null;

    if (
      refundPercent > 0
    ) {

      refund =
        await stripe.refunds.create({

          payment_intent:
            v.paymentIntentId,

          amount:
            Math.round(
              v.precio *
              100 *
              refundPercent
            )
        });
    }

    // =====================================================
// 🔴 CANCELAR VIAJE
// =====================================================

await viajeRef.update({

  estado:
    "Cancelado",

  estadoPago:
    refund
      ? "reembolsado"
      : v.estadoPago,

  canceladoPor:
    "user",

  refundPercent,

  refundId:
    refund?.id || null,

  refundAt:
    Date.now(),

  trackingVisible:
    false
});

// =====================================================
// 🚗 LIBERAR DRIVER
// =====================================================

if (v.driverId) {

  try {

    await db
      .ref(
        "drivers/" +
        v.driverId
      )
      .update({

        viajeActivo:
          null
      });

  } catch (err) {

    console.error(
      "DRIVER RELEASE ERROR:",
      err
    );
  }
}

return NextResponse.json({

  refunded:
    refundPercent > 0,

  percent:
    refundPercent
});

} catch (err: any) {

  console.error(
    "🔥 REFUND ERROR:",
    err
  );

  return NextResponse.json(
    {
      error:
        "Error procesando refund",

      details:
        err.message
    },
    { status: 500 }
  );
}
 } 