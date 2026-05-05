import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any
});

export async function POST(req: Request) {
  try {
    // 🔐 AUTH
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);

    const data = await req.json();

    const {
      metodoPago,
      precio,
      paymentMethodId
    } = data;

    let paymentIntentId: string | null = null;

    // 💳 PROCESAR PAGO SOLO SI ES STRIPE
    if (metodoPago === "stripe") {

      if (!paymentMethodId) {
        return NextResponse.json(
          { error: "paymentMethodId requerido" },
          { status: 400 }
        );
      }

      if (!precio || precio <= 0) {
        return NextResponse.json(
          { error: "Precio inválido" },
          { status: 400 }
        );
      }

      const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(precio * 100),
  currency: "usd",

  payment_method: paymentMethodId,
  confirm: true,

  // 🔥 ESTO ARREGLA EL ERROR
  automatic_payment_methods: {
    enabled: true,
    allow_redirects: "never"
  }
});

      paymentIntentId = paymentIntent.id;
    }

    // 🔥 CREAR VIAJE
    const id = Date.now().toString();

    await adminDb.ref("viajes/" + id).set({
      ...data,

      id,
      userId: decoded.uid,

      estado: "Pendiente",
      timestamp: Date.now(),

      // 🔥 ESTADO DE PAGO REAL
      pagado: metodoPago === "stripe",
      estadoPago: metodoPago === "stripe" ? "pagado" : "pendiente",

      paymentIntentId
    });

    return NextResponse.json({
      ok: true,
      id,
      paymentIntentId
    });

  } catch (err: any) {
    console.error("❌ ERROR CREATE VIAJE:", err);

    return NextResponse.json(
      { error: err.message || "Error creando viaje" },
      { status: 500 }
    );
  }
}