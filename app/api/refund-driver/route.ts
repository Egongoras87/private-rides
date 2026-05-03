import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase, ref, get, update } from "firebase/database";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// 🔥 INICIALIZAR FIREBASE ADMIN (solo una vez)
if (!getApps().length) {
 let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY || "{}");
} catch (e) {
  console.error("Error parsing FIREBASE_ADMIN_KEY", e);
}

if (!getApps().length && serviceAccount?.project_id) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  try {
    // 🔒 PASO 1 — LEER TOKEN
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "No token" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];

    // 🔒 PASO 2 — VALIDAR TOKEN
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    // 🔒 PASO 3 — OBTENER VIAJE
    const { viajeId } = await req.json();

    const db = getDatabase();
    const viajeRef = ref(db, "viajes/" + viajeId);
    const snap = await get(viajeRef);

    if (!snap.exists()) {
      return NextResponse.json(
        { error: "Viaje no existe" },
        { status: 404 }
      );
    }

    const v = snap.val();

    // 🔒 PASO 4 — VALIDAR DRIVER REAL
    if (v.driverId !== uid) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 403 }
      );
    }

    // 🔒 PASO 5 — EVITAR DOBLE REFUND
    if (v.refundId) {
      return NextResponse.json({
        success: true,
        alreadyRefunded: true
      });
    }

    // 🔒 PASO 6 — VALIDAR ESTADO
    if (
      v.estado === "Cancelado" ||
      v.estado === "Finalizado" ||
      v.estado === "En viaje"
    ) {
      return NextResponse.json(
        { error: "Estado no válido para refund" },
        { status: 400 }
      );
    }

    // 🔒 PASO 7 — VALIDAR MONTO CONTRA STRIPE
    if (v.metodoPago === "stripe" && v.paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(v.paymentIntentId);

      if (!paymentIntent || paymentIntent.amount !== Math.round(v.precio * 100)) {
        return NextResponse.json(
          { error: "Monto inconsistente" },
          { status: 400 }
        );
      }
    }

    let refund = null;

    // 💳 REFUND REAL
    if (v.metodoPago === "stripe" && v.paymentIntentId) {
      refund = await stripe.refunds.create({
        payment_intent: v.paymentIntentId,
      });
    }

    // 🔴 GUARDAR LOG FINANCIERO
    await update(viajeRef, {
      estado: "Cancelado",
      canceladoPor: "driver",
      refundId: refund?.id || null,
      refundAt: Date.now(),
      refundAmount: v.precio,
      refundPercent: refund ? 1 : 0,
      refundReason: "driver_cancel"
    });

    return NextResponse.json({
      success: true,
      refunded: !!refund
    });

  } catch (error) {
    console.error("REFUND DRIVER ERROR:", error);
    return NextResponse.json(
      { error: "Error refund" },
      { status: 500 }
    );
  }
}