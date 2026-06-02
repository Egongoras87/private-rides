import { NextResponse } from "next/server";
import { adminDb, adminAuth, adminMessaging } from "@/lib/firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2026-04-22.dahlia"
  }
);

// 🔥 TARIFAS
const BASE_FARE = 5;
const PRICE_PER_MILE = 1.5
const MIN_FARE = 10;

export async function POST(
  req: Request
) {

  try {

    // =====================================================
    // 🔐 AUTH
    // =====================================================

    const token =
      req.headers
        .get("authorization")
        ?.replace("Bearer ", "");

    if (!token) {

      return NextResponse.json(
        {
          error: "No token"
        },
        { status: 401 }
      );
    }

    const decoded =
      await adminAuth.verifyIdToken(
        token
      );

    // =====================================================
    // 📦 BODY
    // =====================================================

    const data =
      await req.json();

    const {

      metodoPago,

      distancia,

      paymentIntentId

    } = data;

    // =====================================================
    // 🛡️ VALIDAR DISTANCIA
    // =====================================================

    if (
      !distancia ||
      distancia <= 0
    ) {

      return NextResponse.json(
        {
          error:
            "Distancia inválida"
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 💰 RECALCULAR PRECIO
    // =====================================================

    const precioCalculado =

      BASE_FARE +

      (
        distancia *
        PRICE_PER_MILE
      );

    const precioFinal =

      Math.max(
        precioCalculado,
        MIN_FARE
      );

    const precioFinalFijo =

      parseFloat(
        precioFinal.toFixed(2)
      );

    // =====================================================
    // 💳 VALIDAR STRIPE
    // =====================================================

    if (metodoPago === "stripe") {

      if (!paymentIntentId) {

        return NextResponse.json(
          {
            error:
              "paymentIntentId requerido"
          },
          { status: 400 }
        );
      }

      const paymentIntent =
        await stripe.paymentIntents.retrieve(
          paymentIntentId
        );

      // 🔥 SOLO SUCCESS
      if (
        paymentIntent.status !==
        "succeeded"
      ) {

        return NextResponse.json(
          {
            error:
              "Payment not completed"
          },
          { status: 400 }
        );
      }
    }

    // =====================================================
    // 🚗 CREAR VIAJE
    // =====================================================

    const id =
      Date.now().toString();

    await adminDb
      .ref("viajes/" + id)
      .set({

        // 🔥 DATA ORIGINAL
        ...data,

        // 🔒 PRECIO REAL
        precio:
          precioFinalFijo,

        // 🔥 IDS
        id,

        userId:
          decoded.uid,

        // 🚗 ESTADO
        estado:
          "Pendiente",

        // ⏱️ TIMESTAMP
        timestamp:
          Date.now(),

        expiraAt:
          Date.now() + 120000,

        // 💳 PAYMENT
        pagado:
          metodoPago === "stripe",

        estadoPago:

          metodoPago === "cash"

            ? "cash"

            : "pagado",

        // 💳 STRIPE
        paymentIntentId:
          paymentIntentId || null,

        // 🔥 SISTEMA
        refundProcesado:
          false,

        trackingVisible:
          false,

        driversNotificados: {}
      });
    // =====================================================
// 🔥 SEND PUSH TO DRIVERS
// =====================================================

try {

  const driversSnap =

    await adminDb
      .ref("drivers")
      .once("value");

  const drivers =
    driversSnap.val();

  if (drivers) {

    await Promise.all(

      Object.keys(drivers)

        .map(async (driverId) => {

          const driver =
            drivers[driverId];

          // =============================================
          // 🔥 SOLO ACTIVOS
          // =============================================

          if (!driver?.activo)
            return;

          // =============================================
          // 🔥 TOKEN
          // =============================================

          if (!driver?.fcmToken)
            return;

          try {

            console.log(
              "🔥 SENDING PUSH TO:",
              driverId
            );

            const response =

              await adminMessaging.send({

                token:
                  driver.fcmToken,

                // =========================================
                // 🔥 DATA ONLY
                // EL SW CONTROLA TODO
                // =========================================

                data: {

                  title:
                    "🚗 New Ride Request",

                  body:
                    `${data.origen} → ${data.destino}`,

                  viajeId:
                    id,

                  url:
                    "/driver",

                  icon:
                    "/icon-512.png",

                  badge:
                    "/badge.png"
                },

                // =========================================
                // 🔥 ANDROID PRIORITY
                // =========================================

                android: {

                  priority:
                    "high"
                },

                // =========================================
                // 🔥 WEB PUSH
                // SOLO HEADERS
                // =========================================

                webpush: {

                  headers: {

                    Urgency:
                      "high",

                    TTL:
                      "30"
                  },

                  fcmOptions: {

                    link:
                      "/driver"
                  }
                }
              });

            console.log(
              "✅ PUSH SUCCESS:",
              response
            );

          } catch (err) {

            console.error(
              "❌ PUSH ERROR:",
              err
            );
          }
        })
    );
  }

} catch (err) {

  console.error(
    "❌ SEND PUSH ERROR:",
    err
  );
}
    // =====================================================
    // ✅ RESPONSE
    // =====================================================

    return NextResponse.json({

      ok: true,

      id,

      paymentIntentId:
        paymentIntentId || null
    });

  } catch (err: any) {

    console.error(
      "❌ ERROR CREATE VIAJE:",
      err
    );

    return NextResponse.json(
      {
        error:
          err.message ||
          "Error creando viaje"
      },
      { status: 500 }
    );
  }
}