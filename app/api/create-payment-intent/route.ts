import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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

    const {
      amount,
      paymentMethodId
    } = await req.json();

    if (
      !amount ||
      !paymentMethodId
    ) {

      return NextResponse.json(
        {
          error:
            "Missing data"
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 👤 USER
    // =====================================================

    const userRef =
      adminDb.ref(
        "usuarios/" + decoded.uid
      );

    const userSnap =
      await userRef.get();

    const userData =
      userSnap.val() || {};

    let customerId =
      userData.customerId || null;

    // =====================================================
    // 👤 CREATE CUSTOMER
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
      customer:
        customerId
    }
  );

  // =====================================================
  // 🔥 DEFAULT PAYMENT METHOD
  // =====================================================

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

  if (

    !err.message.includes(
      "already attached"
    )

  ) {

    throw err;
  }
}// =====================================================
// 💳 PAYMENT INTENT
// =====================================================

const paymentIntent =

  await stripe.paymentIntents.create({

    amount:
      Math.round(amount * 100),

    currency:
      "usd",

    customer:
      customerId,

    payment_method:
      paymentMethodId,

    confirm:
      true,

    // =================================================
    // 🔥 USER PRESENT
    // =================================================

    off_session:
      false,

    // =================================================
    // 🔥 SAVE FOR FUTURE RIDES
    // =================================================

    setup_future_usage:
      "off_session",

    automatic_payment_methods: {

      enabled:
        true,

      allow_redirects:
        "never"
    },

    payment_method_options: {

      card: {

        request_three_d_secure:
          "automatic"
      }
    },

    metadata: {

      firebaseUID:
        decoded.uid,

      type:
        "ride_payment"
    }
  });

    // =====================================================
    // ✅ RESPONSE
    // =====================================================

    return NextResponse.json({

      success: true,

      status:
        paymentIntent.status,

      clientSecret:
        paymentIntent.client_secret,

      paymentIntentId:
        paymentIntent.id
    });

  } catch (err: any) {

    console.error(
      "PAYMENT ERROR:",
      err
    );

    return NextResponse.json(
      {
        error:
          err.message
      },
      { status: 500 }
    );
  }
}