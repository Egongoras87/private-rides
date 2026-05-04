import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";

// 🔥 👉 AGREGA ESTE IMPORT AQUÍ
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";

console.log("🔥 CANCEL USER ENDPOINT HIT");
console.log("🔥 FIREBASE:", !!process.env.FIREBASE_PRIVATE_KEY);
console.log("🔥 STRIPE:", !!process.env.STRIPE_SECRET_KEY);

// 🔥 👉 AGREGA TODO ESTE BLOQUE AQUÍ
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
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
          databaseURL:
            "https://private-rides-52e08-default-rtdb.firebaseio.com",
        });

  console.log("✅ Firebase Admin inicializado (USER)");

} catch (err) {
  console.error("🔥 ERROR FIREBASE USER:", err);
}

// 🔥 DESPUÉS DE FIREBASE → STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

// 🚀 API
export async function POST(req: Request) {
  try {
    const { viajeId } = await req.json();

    // 🔥 👉 USA adminApp AQUÍ
    const db = getDatabase(adminApp!);
    const viajeRef = db.ref("viajes/" + viajeId);
    const snap = await viajeRef.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "Viaje no existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 seguridad básica
    if (v.estado === "Cancelado" || v.estado === "Finalizado") {
      return NextResponse.json({ error: "Ya cerrado" }, { status: 400 });
    }

    // 💳 si no es Stripe → solo cancelar
    if (v.metodoPago !== "stripe" || !v.paymentIntentId) {
      await viajeRef.update({ estado: "Cancelado" });
      return NextResponse.json({ refunded: false });
    }

    const now = Date.now();
    let refundPercent = 1;

    if (!v.driverId || v.estado === "Pendiente") {
      refundPercent = 1;
    } else if (v.asignadoAt) {
      const minutos = (now - v.asignadoAt) / 60000;

      if (minutos <= 2) refundPercent = 1;
      else if (minutos <= 5) refundPercent = 0.5;
      else refundPercent = 0;
    }

    let refund = null;

    if (refundPercent > 0) {
      refund = await stripe.refunds.create({
        payment_intent: v.paymentIntentId,
        amount: Math.round(v.precio * 100 * refundPercent),
      });
    }

    await viajeRef.update({
      estado: "Cancelado",
      canceladoPor: "user",
      refundPercent,
      refundId: refund?.id || null,
      refundAt: Date.now()
    });

    return NextResponse.json({
      refunded: refundPercent > 0,
      percent: refundPercent
    });

  } catch (err) {
    console.error("REFUND ERROR:", err);
    return NextResponse.json({ error: "Error refund" }, { status: 500 });
  }
}