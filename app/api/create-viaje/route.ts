import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2026-04-22.dahlia"
  }
);

// 🔥 TARIFAS
const BASE_FARE = 8;
const PRICE_PER_MILE = 2.0;
const MIN_FARE = 12;

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