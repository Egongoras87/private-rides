import { NextResponse } from "next/server";
import Stripe from "stripe";

import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

// 🔥 INIT FIREBASE
let adminApp: App | null = null;

try {
  adminApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
          }),
          databaseURL:
            "https://private-rides-52e08-default-rtdb.firebaseio.com",
        });

  console.log("✅ Firebase Admin (REJECT)");

} catch (err) {
  console.error("🔥 Firebase error:", err);
}

// 🔥 STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

// 🚀 API
export async function POST(req: Request) {
  try {
    const { viajeId } = await req.json();

    if (!viajeId) {
      return NextResponse.json(
        { error: "viajeId requerido" },
        { status: 400 }
      );
    }

    const db = getDatabase(adminApp!);
    const viajeRef = db.ref("viajes/" + viajeId);
    const snap = await viajeRef.once("value");

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "Viaje no existe" },
        { status: 404 }
      );
    }

    const v = snap.val();

    // 🔒 SOLO PERMITIR SI ESTÁ PENDIENTE
    if (v.estado !== "Pendiente") {
      return NextResponse.json(
        { error: "Viaje ya fue tomado" },
        { status: 400 }
      );
    }

    let refund = null;

    // 💳 REFUND COMPLETO SI PAGÓ
    if (v.metodoPago === "stripe" && v.paymentIntentId) {
      refund = await stripe.refunds.create({
        payment_intent: v.paymentIntentId,
      });
    }

    // 🔴 CANCELAR VIAJE
    await viajeRef.update({
      estado: "Cancelado",
      canceladoPor: "driver_reject",
      refundId: refund?.id || null,
      refundAt: Date.now(),
      refundAmount: refund ? v.precio : 0,
      refundPercent: refund ? 1 : 0,
      refundReason: "driver_reject",
    });

    return NextResponse.json({
      success: true,
      refunded: !!refund,
    });

  } catch (error: any) {
    console.error("🔥 REJECT ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Error refund reject" },
      { status: 500 }
    );
  }
}