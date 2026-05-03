import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase, ref, get, update } from "firebase/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  try {
    const { viajeId } = await req.json();

    const db = getDatabase();
    const viajeRef = ref(db, "viajes/" + viajeId);
    const snap = await get(viajeRef);

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
      await update(viajeRef, { estado: "Cancelado" });
      return NextResponse.json({ refunded: false });
    }

    const now = Date.now();
    let refundPercent = 1; // default 100%

    if (!v.driverId || v.estado === "Pendiente") {
      refundPercent = 1;
    } else if (v.asignadoAt) {
      const minutos = (now - v.asignadoAt) / 60000;

      if (minutos <= 5) refundPercent = 1;
      else if (minutos <= 10) refundPercent = 0.5;
      else refundPercent = 0;
    }

    let refund = null;

    if (refundPercent > 0) {
      refund = await stripe.refunds.create({
        payment_intent: v.paymentIntentId,
        amount: Math.round(v.precio * 100 * refundPercent),
      });
    }

    await update(viajeRef, {
      estado: "Cancelado",
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