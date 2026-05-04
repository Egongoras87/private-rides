import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";

export async function POST(req: Request) {
  try {
    const { viajeId } = await req.json();

    if (!viajeId) {
      return NextResponse.json(
        { error: "Missing viajeId" },
        { status: 400 }
      );
    }

    // 🔥 VALIDAR ENV
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      throw new Error("Faltan variables Firebase");
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Falta STRIPE_SECRET_KEY");
    }

    // 🔥 INIT FIREBASE
    const adminApp =
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

    const db = getDatabase(adminApp);

    // 🔥 INIT STRIPE
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 🔥 OBTENER VIAJE
    const viajeRef = db.ref("viajes/" + viajeId);
    const snap = await viajeRef.once("value");

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "Viaje no existe" },
        { status: 404 }
      );
    }

    const v = snap.val();

    // 🔒 evitar doble cancel
    if (v.estado === "Cancelado" || v.estado === "Finalizado") {
      return NextResponse.json(
        { error: "Ya cerrado" },
        { status: 400 }
      );
    }

    // 💵 CASH → solo cancelar
    if (v.metodoPago !== "stripe" || !v.paymentIntentId) {
      await viajeRef.update({
        estado: "Cancelado",
        canceladoPor: "user",
        refundPercent: 0,
        refundId: null,
        refundAt: Date.now(),
      });

      return NextResponse.json({
        refunded: false,
        percent: 0,
      });
    }

    // 🔥 CALCULAR REEMBOLSO
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

// 🔥 REEMBOLSO LIMPIO
if (refundPercent > 0) {
  const precio = Number(v.precio || 0);

  if (isNaN(precio)) {
    throw new Error("Precio inválido");
  }

  const amount = Math.floor(precio * 100 * refundPercent);

  console.log("💳 DEBUG:", {
    precio,
    refundPercent,
    amount,
    paymentIntentId: v.paymentIntentId,
  });

  if (amount <= 0) {
    throw new Error("Monto inválido");
  }

  refund = await stripe.refunds.create({
    payment_intent: v.paymentIntentId,
    amount,
  });

  console.log("💳 REFUND OK:", refund.id);
}

    // 🔥 ACTUALIZAR VIAJE
    await viajeRef.update({
      estado: "Cancelado",
      canceladoPor: "user",
      refundPercent,
      refundId: refund?.id || null,
      refundAt: Date.now(),
    });

    return NextResponse.json({
      refunded: refundPercent > 0,
      percent: refundPercent,
    });

  } catch (err: any) {
    console.error("🔥 REFUND ERROR DETALLE:", err);
    console.error("🔥 STACK:", err?.stack);

    return NextResponse.json(
      {
        error: err.message || "Internal error",
      },
      { status: 500 }
    );
  }
}