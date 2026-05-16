import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY!,
  {
    apiVersion: "2024-04-10" as any
  }
);

// 🔥 TARIFAS
const BASE_FARE = 8;
const PRICE_PER_MILE = 2.5;
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
        { error: "No token" },
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

      paymentMethodId

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
// 💳 STRIPE
// =====================================================

let paymentIntentId: string | null = null;

let clientSecret: string | null = null;

let customerId: string | null = null;

if (metodoPago === "stripe") {

  if (!paymentMethodId) {

    return NextResponse.json(
      {
        error: "paymentMethodId requerido"
      },
      { status: 400 }
    );
  }

  // =====================================================
  // 👤 USER FIREBASE
  // =====================================================

  const userRef =
    adminDb.ref(
      "users/" + decoded.uid
    );

  const userSnap =
    await userRef.get();

  const userData =
    userSnap.val() || {};

  // =====================================================
  // 👤 CUSTOMER EXISTENTE
  // =====================================================

  customerId =
    userData.customerId || null;

  // =====================================================
  // 👤 CREAR CUSTOMER
  // =====================================================

  if (!customerId) {

    const customer =
      await stripe.customers.create({

        metadata: {
          firebaseUID:
            decoded.uid
        }
      });

    customerId =
      customer.id;

    await userRef.update({
      customerId
    });
  }

  // =====================================================
  // 🔗 ATTACH CARD
  // =====================================================

  try {

    await stripe.paymentMethods.attach(

      paymentMethodId,

      {
        customer: customerId
      }
    );
    await stripe.customers.update(
  customerId,
  {
    invoice_settings: {
      default_payment_method:
        paymentMethodId
    }
  }
);

  } catch (err: any) {

    // 🔥 ya attached
    if (
      !err.message.includes(
        "already attached"
      )
    ) {

      throw err;
    }
  }

  // =====================================================
// 💳 PAYMENT INTENT
// =====================================================

const paymentIntent =
  await stripe.paymentIntents.create({

    amount:
      Math.round(
        precioFinalFijo * 100
      ),

    currency: "usd",

    customer:
      customerId,

    payment_method:
      paymentMethodId,

    payment_method_types: [
      "card"
    ],

    confirm: true,


    setup_future_usage:
      "off_session"
  });

paymentIntentId =
  paymentIntent.id;

clientSecret =
  paymentIntent.client_secret;
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

        // 🚗 DRIVER RECONOCE
        estado:
          "Pendiente",

        // ⏱️ TIMESTAMP
        timestamp:
          Date.now(),

          expiraAt:
          Date.now() + 120000,

        // 💳 PAGO
        pagado:
        metodoPago === "stripe",

        // 📊 ESTADO PAGO
        estadoPago:
          metodoPago === "stripe"
            ? "pagado"

            : "pendiente",

        // 💳 STRIPE
        paymentIntentId:
          paymentIntentId || null,

        // 🔥 OBLIGATORIO
        driversNotificados: {}
      });

    // =====================================================
    // ✅ RESPONSE
    // =====================================================

    return NextResponse.json({

      ok: true,

      id,

      clientSecret:
        clientSecret || null,

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