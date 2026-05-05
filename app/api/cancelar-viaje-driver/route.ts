import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireDriver } from "@/lib/auth-helpers";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: Request) {
  try {
    // 🔐 SOLO DRIVERS
    const { uid } = await requireDriver(req);

    const { viajeId } = await req.json();
    if (!viajeId) {
      return NextResponse.json({ error: "viajeId requerido" }, { status: 400 });
    }

    const refViaje = adminDb.ref("viajes/" + viajeId);
    const snap = await refViaje.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "No existe" }, { status: 404 });
    }

    const v = snap.val();

    // 🔒 SOLO EL DRIVER ASIGNADO
    if (v.driverId !== uid) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // 🔒 SOLO ANTES DE RECOGER
    // ❌ NO permitir en "En viaje"
    if (v.estado !== "Asignado" && v.estado !== "En camino") {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    // 🔒 IDEMPOTENCIA (evita doble cancelación / doble refund)
    if (v.estado === "Cancelado") {
      return NextResponse.json({ ok: true, already: true });
    }

    let refundId: string | null = null;

    // 💳 REFUND SOLO SI APLICA Y NO EXISTE YA
    if (
      v.metodoPago === "stripe" &&
      v.pagado &&
      v.paymentIntentId &&
      !v.refundId
    ) {
      try {
        const refund = await stripe.refunds.create({
          payment_intent: v.paymentIntentId,
        });

        refundId = refund.id;
      } catch (err: any) {
        console.error("❌ ERROR REFUND:", err.message);
        return NextResponse.json(
          { error: "Error procesando refund" },
          { status: 500 }
        );
      }
    }

    // 🔥 ACTUALIZAR VIAJE
    await refViaje.update({
      estado: "Cancelado",
      canceladoPor: "driver",
      refundId: refundId || v.refundId || null,
      canceladoAt: Date.now()
    });
    if (v.telefono) {
  const telefono = "1" + String(v.telefono).replace(/\D/g, "");

  const mensaje =
    "❌ Your trip has been canceled by the driver..\n\n" +
    (v.metodoPago === "stripe"
      ? "💳 Your payment will be refunded automatically."
      : "You can request a new ride.");

  console.log("📲 WhatsApp:", `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`);
}

    // 🧹 LIBERAR DRIVER (MUY IMPORTANTE)
    await adminDb.ref("drivers/" + uid).update({
      viajeActivo: null
    });

    return NextResponse.json({ ok: true });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Error cancelando" },
      { status: 500 }
    );
  }
}