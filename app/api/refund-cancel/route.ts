import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";

export async function POST(req: Request) {
  try {
    // 🔥 VALIDAR ENV
    if (
      !process.env.FIREBASE_PROJECT_ID ||
      !process.env.FIREBASE_CLIENT_EMAIL ||
      !process.env.FIREBASE_PRIVATE_KEY ||
      !process.env.STRIPE_SECRET_KEY
    ) {
      console.log("❌ ENV ERROR:", {
        project: process.env.FIREBASE_PROJECT_ID,
        email: process.env.FIREBASE_CLIENT_EMAIL,
        key: !!process.env.FIREBASE_PRIVATE_KEY,
        stripe: !!process.env.STRIPE_SECRET_KEY
      });

      return NextResponse.json(
        { error: "Faltan variables de entorno" },
        { status: 500 }
      );
    }

    // 🔥 INIT FIREBASE (DENTRO DEL HANDLER)
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
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });

    // 📦 BODY
    const { viajeId } = await req.json();

    if (!viajeId) {
      return NextResponse.json({ error: "Falta viajeId" }, { status: 400 });
    }

    // 🔍 BUSCAR VIAJE
    const viajeRef = db.ref("viajes/" + viajeId);
    const snap = await viajeRef.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "Viaje no existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 SOLO BLOQUEAR SI FINALIZADO
    if (v.estado === "Finalizado") {
      return NextResponse.json({ error: "Viaje finalizado" }, { status: 400 });
    }

    // 💳 NO STRIPE → SOLO CANCELAR
    if (v.metodoPago !== "stripe" || !v.paymentIntentId) {
      await viajeRef.update({
        estado: "Cancelado",
        canceladoPor: "user",
        refundPercent: 0
      });

      return NextResponse.json({ refunded: false });
    }

    // 🧠 CALCULAR REFUND
    const now = Date.now();
    let refundPercent = 1;

    if (!v.driverId || v.estado === "Pendiente") {
      refundPercent = 1;
    } else if (v.asignadoAt) {
      const minutos = (now - v.asignadoAt) / 60000;

      if (minutos <= 5) refundPercent = 1;
      else if (minutos <= 10) refundPercent = 0.5;
      else refundPercent = 0;
    }

    let refund = null;

    // 💸 HACER REFUND
    if (refundPercent > 0) {
      refund = await stripe.refunds.create({
        payment_intent: v.paymentIntentId,
        amount: Math.round(v.precio * 100 * refundPercent),
      });
    }

    // 🔄 ACTUALIZAR FIREBASE
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
    console.error("🔥 REFUND ERROR:", err);

    return NextResponse.json(
      { error: "Error procesando refund" },
      { status: 500 }
    );
  }
}