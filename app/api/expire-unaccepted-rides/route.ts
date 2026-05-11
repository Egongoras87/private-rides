import { NextResponse }
from "next/server";

import {
  adminDb
} from "@/lib/firebase-admin";

import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion:
      "2024-04-10" as any
  }
);

export async function POST() {

  try {

    const snap =
      await adminDb
        .ref("viajes")
        .once("value");

    if (!snap.exists()) {

      return NextResponse.json({
        ok: true
      });
    }

    const viajes =
      snap.val();

    const ahora =
      Date.now();

    for (const id in viajes) {

      const viaje =
        viajes[id];

      // 🔥 SOLO PENDIENTES
      if (
        viaje.estado !==
        "Pendiente"
      ) continue;

      // 🔥 SOLO STRIPE
      if (
        viaje.metodoPago !==
        "stripe"
      ) continue;

      // 🔥 YA PAGADO
      if (
        viaje.estadoPago !==
        "pagado"
      ) continue;

      // ⏱️ 2 MINUTOS
      const expirado =

        ahora -
        viaje.timestamp >

        2 * 60 * 1000;

      if (!expirado)
        continue;

      // 🚨 YA TIENE DRIVER
      if (viaje.driverId)
        continue;

      // =================================================
      // 💸 REFUND
      // =================================================

      if (
        viaje.paymentIntentId
      ) {

        try {

          await stripe.refunds.create({

            payment_intent:
              viaje.paymentIntentId
          });

          console.log(
            "✅ REFUND:",
            id
          );

        } catch (err) {

          console.error(
            "REFUND ERROR:",
            err
          );
        }
      }

      // =================================================
      // ❌ CANCELAR VIAJE
      // =================================================

      await adminDb
        .ref("viajes/" + id)
        .update({

          estado:
            "Cancelado",

          estadoPago:
            "reembolsado",

          canceladoAutomatico:
            true,

          canceladoAt:
            Date.now()
        });
    }

    return NextResponse.json({
      ok: true
    });

  } catch (err: any) {

    console.error(err);

    return NextResponse.json(
      {
        error:
          err.message
      },
      { status: 500 }
    );
  }
}