import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();

const db =
  admin.database();

  const stripeSecret =
  defineSecret(
    "STRIPE_SECRET_KEY"
  );



// =====================================================
// 🔥 AUTO REFUND EXPIRED RIDES
// =====================================================

export const autoRefundExpiredRides =

  onSchedule(

    {
      schedule:
        "every 1 minutes",

      region:
        "us-central1",

      timeoutSeconds: 540,

      memory:
        "256MiB",
        secrets:
      [stripeSecret]
    },

    async () => {
        const stripe =
      new Stripe(

         stripeSecret.value(),

    {
      apiVersion:
        "2026-04-22.dahlia"
    }
  );

      try {

        console.log(
          "⏳ CHECKING EXPIRED RIDES..."
        );

        const now =
          Date.now();

        // =====================================================
        // 🚗 BUSCAR VIAJES
        // =====================================================

        const snap =

          await db
            .ref("viajes")
            .once("value");

        if (!snap.exists()) {

          console.log(
            "❌ NO RIDES"
          );

          return;
        }

        const viajes =
          snap.val();

        for (const id in viajes) {

          const v =
            viajes[id];

          // =====================================================
          // 🚫 SOLO PENDIENTES
          // =====================================================

          if (
            v.estado !==
            "Pendiente"
          ) {

            continue;
          }

          // =====================================================
          // 🚫 YA REFUND
          // =====================================================

          if (
            v.refundProcesado
          ) {

            continue;
          }

          // =====================================================
          // 🚫 YA ACEPTADO
          // =====================================================

          if (
            v.asignadoAt
          ) {

            continue;
          }

          // =====================================================
          // 🚫 NO EXPIRADO
          // =====================================================

          if (
            !v.expiraAt ||
            v.expiraAt > now
          ) {

            continue;
          }

          console.log(
            "💸 EXPIRED:",
            id
          );

          // =====================================================
          // 🔒 BLOQUEAR
          // =====================================================

          await db
            .ref(
              "viajes/" + id
            )
            .update({

              refundProcesado:
                true
            });

          // =====================================================
          // 💳 REFUND STRIPE
          // =====================================================

          let refund =
            null;

          if (

            v.metodoPago ===
              "stripe"

            &&

            v.paymentIntentId
          ) {

            refund =

              await stripe
                .refunds
                .create({

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

          await db
            .ref(
              "viajes/" + id
            )
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

                refund
                  ? 1
                  : 0,

              canceladoPor:
                "timeout_no_drivers",

              canceladoAt:
                Date.now()
            });

          console.log(
            "✅ REFUND DONE:",
            id
          );
        }

      } catch (err) {

        console.error(
          "🔥 SCHEDULER ERROR:",
          err
        );
      }
    }
  );