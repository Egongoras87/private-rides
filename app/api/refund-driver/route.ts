import { NextResponse } from "next/server";
import Stripe from "stripe";
console.log("🔥 FIREBASE:", !!process.env.FIREBASE_PRIVATE_KEY);
console.log("🔥 STRIPE:", !!process.env.STRIPE_SECRET_KEY);

import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

// 🔥 INIT FIREBASE
let adminApp: App | null = null;

try {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Faltan variables de Firebase");
  }

  adminApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          }),
          databaseURL:
            "https://private-rides-52e08-default-rtdb.firebaseio.com",
        });

  console.log("✅ Firebase Admin inicializado");
} catch (err) {
  console.error("🔥 ERROR FIREBASE:", err);
}

// 🔥 INIT STRIPE
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("❌ Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

// 🚀 API
export async function POST(req: Request) {
  try {
    if (!adminApp) {
      return NextResponse.json(
        { error: "Firebase no inicializado" },
        { status: 500 }
      );
    }

    const authAdmin = getAuth(adminApp);
    const db = getDatabase(adminApp);

    // 🔒 AUTH
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = await authAdmin.verifyIdToken(token);
    const uid = decoded.uid;
console.log("🔥 UID TOKEN:", uid); 

    // 🔒 BODY
    const { viajeId } = await req.json();

    if (!viajeId) {
      return NextResponse.json(
        { error: "viajeId requerido" },
        { status: 400 }
      );
    }

    const viajeRef = db.ref("viajes/" + viajeId);
    const snap = await viajeRef.once("value");

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "Viaje no existe" },
        { status: 404 }
      );
    }

    const v = snap.val();
console.log("🔥 DRIVER ID DB:", v.driverId);

    // 🔒 VALIDAR DRIVER

if (v.estado !== "Pendiente" && v.driverId !== uid) {
  return NextResponse.json(
    { error: "No autorizado" },
    { status: 403 }
  );
}

    // 🔒 YA REEMBOLSADO
    if (v.refundId) {
      return NextResponse.json({
        success: true,
        alreadyRefunded: true,
      });
    }

    let refund = null;

    // 💳 STRIPE REFUND
    if (v.metodoPago === "stripe" && v.paymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          v.paymentIntentId
        );

        if (paymentIntent.status !== "succeeded") {
          await viajeRef.update({
            estado: "Cancelado",
            canceladoPor: "driver",
            refundPercent: 0,
            refundReason: "not_paid",
          });

          return NextResponse.json({
            success: true,
            refunded: false,
          });
        }

        refund = await stripe.refunds.create({
          payment_intent: v.paymentIntentId,
        });

      } catch (err: any) {
        console.error("🔥 STRIPE ERROR:", err);

        return NextResponse.json(
          { error: err.message || "Stripe error" },
          { status: 500 }
        );
      }
    }

    // 🔴 UPDATE FINAL
    await viajeRef.update({
      estado: "Cancelado",
      canceladoPor: "driver",
      refundId: refund?.id || null,
      refundAt: Date.now(),
      refundAmount: refund ? v.precio : 0,
      refundPercent: refund ? 1 : 0,
      refundReason: refund ? "driver_cancel" : "not_paid",
    });

    return NextResponse.json({
      success: true,
      refunded: !!refund,
    });

  } catch (error: any) {
    console.error("🔥 BACKEND ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Error refund" },
      { status: 500 }
    );
  }
}