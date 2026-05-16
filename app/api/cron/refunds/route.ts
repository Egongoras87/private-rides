import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2026-04-22.dahlia"
  }
);

export async function GET() {

  try {

    const now =
      Date.now();

    // =====================================================
    // 🚗 VIAJES PENDIENTES
    // =====================================================

    const snap =
      await adminDb
        .ref("viajes")
        .orderByChild("estado")
        .equalTo("Pendiente")
        .get();

    if (!snap.exists()) {

      return NextResponse.json({
        success: true,
        processed: 0
      });
    }

    const viajes =
      snap.val();

    let processed = 0;

    for (const id in viajes) {

      const v =
        viajes[id];

      // =====================================================
      // 🚫 YA REFUND
      // =====================================================

      if (
        v.refundProcesado
      ) {

        continue;
      }

      // =====================================================
      // 🚫 YA ASIGNADO
      // =====================================================

      if (
        v.asignadoAt
      ) {

        continue;
      }

      // =====================================================
      // 🚫 SIN EXPIRAR
      // =====================================================

      if (
        !v.expiraAt ||
        v.expiraAt > now
      ) {

        continue;
      }

      console.log(
        "💸 AUTO REFUND:",
        id
      );

      // =====================================================
      // 🔒 BLOQUEAR
      // =====================================================

      await adminDb
        .ref("viajes/" + id)
        .update({
          refundProcesado: true
        });

      // =====================================================
      // 💳 REFUND STRIPE
      // =====================================================

      let refund = null;

      if (
        v.metodoPago === "stripe" &&
        v.paymentIntentId
      ) {

        refund =
          await stripe.refunds.create({

            payment_intent:
              v.paymentIntentId,

            amount:
              Math.round(
                v.precio * 100
              )
          });
      }

      // =====================================================
      // ❌ CANCELAR VIAJE
      // =====================================================

      await adminDb
        .ref("viajes/" + id)
        .update({

          estado:
            "Cancelado",

          estadoPago:
            refund
              ? "reembolsado"
              : v.estadoPago,

          refundId:
            refund?.id || null,

          refundPercent:
            refund ? 1 : 0,

          canceladoPor:
            "timeout_no_drivers",

          canceladoAt:
            Date.now()
        });

      processed++;
    }

    return NextResponse.json({

      success: true,

      processed
    });

  } catch (error) {

    console.error(
      "CRON REFUND ERROR:",
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