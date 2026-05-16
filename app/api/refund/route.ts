import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2026-04-22.dahlia"
  }
);

export async function POST(
  req: Request
) {

  try {

    const {
      viajeId
    } = await req.json();

    if (!viajeId) {

      return NextResponse.json(
        {
          success: false,
          error: "viajeId requerido"
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 🚗 VIAJE
    // =====================================================

    const viajeRef =
      adminDb.ref(
        "viajes/" + viajeId
      );

    const snap =
      await viajeRef.get();

    if (!snap.exists()) {

      return NextResponse.json(
        {
          success: false,
          error: "Viaje no existe"
        },
        { status: 404 }
      );
    }

    const viaje =
      snap.val();

    // =====================================================
    // 🚫 REFUND YA HECHO
    // =====================================================

    if (
      viaje.refundProcesado
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "Refund already processed"
        }
      );
    }

    // =====================================================
    // 🚫 YA TENÍA DRIVER
    // =====================================================

    if (
      viaje.asignadoAt
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "Ride already assigned"
        }
      );
    }

    // =====================================================
    // 🚫 ESTADO INVÁLIDO
    // =====================================================

    if (
      viaje.estado !==
      "Pendiente"
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "Ride not pending"
        }
      );
    }

    // =====================================================
    // 🚫 SIN PAYMENT
    // =====================================================

    if (
      viaje.metodoPago !==
        "stripe"

      ||

      !viaje.paymentIntentId
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "No Stripe payment"
        }
      );
    }

    // =====================================================
    // 🔒 BLOQUEAR REFUND
    // =====================================================

    await viajeRef.update({

      refundProcesado: true
    });

    // =====================================================
    // 💳 REFUND 100%
    // =====================================================

    const refund =
      await stripe.refunds.create({

        payment_intent:
          viaje.paymentIntentId,

        amount:
          Math.round(
            viaje.precio * 100
          )
      });

    // =====================================================
    // ✅ ACTUALIZAR VIAJE
    // =====================================================

    await viajeRef.update({

      estado:
        "Cancelado",

      estadoPago:
        "reembolsado",

      refundId:
        refund.id,

      refundAt:
        Date.now(),

      refundPercent: 1
    });

    return NextResponse.json({

      success: true,

      refund
    });

  } catch (error) {

    console.error(
      "REFUND ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false
      },
      { status: 500 }
    );
  }
}