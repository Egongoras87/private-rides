import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10" as any // Versión estable de Stripe
});

// 🔥 CONSTANTES DE TARIFA (Deben ser iguales a las de tu frontend)
const BASE_FARE = 8;
const PRICE_PER_MILE = 2.0;
const MIN_FARE = 12;

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
      distancia, // 👈 Ahora dependemos de la distancia enviada
      paymentMethodId
    } = data;

    // 🛡️ RECALCULO DE SEGURIDAD (Ignoramos el 'precio' que venga del cliente)
    const precioCalculado = BASE_FARE + (distancia * PRICE_PER_MILE);
    const precioFinal = Math.max(precioCalculado, MIN_FARE);
    const precioFinalFijo = parseFloat(precioFinal.toFixed(2));

    let paymentIntentId: string | null = null;

    // 💳 PROCESAR PAGO SOLO SI ES STRIPE
    if (metodoPago === "stripe") {
      if (!paymentMethodId) {
        return NextResponse.json(
          { error: "paymentMethodId requerido" },
          { status: 400 }
        );
      }

      // Validamos que exista una distancia para calcular el cobro
      if (!distancia || distancia <= 0) {
        return NextResponse.json(
          { error: "Distancia inválida para calcular precio" },
          { status: 400 }
        );
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(precioFinalFijo * 100), // Usamos el precio calculado en el servidor
        currency: "usd",
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never"
        }
      });

      paymentIntentId = paymentIntent.id;
    }

    // 🔥 CREAR VIAJE (Estructura original mantenida)
    const id = Date.now().toString();

    await adminDb.ref("viajes/" + id).set({
      ...data, // Mantiene origen, destino, fechas, etc.
      precio: precioFinalFijo, // 👈 SOBRESCRIBIMOS con el precio real del servidor
      id,
      userId: decoded.uid,
      estado: "Pendiente",
      timestamp: Date.now(),
      
      // 🔥 ESTADO DE PAGO REAL
      pagado: metodoPago === "stripe",
      estadoPago: metodoPago === "stripe" ? "pagado" : "pendiente",
      paymentIntentId,
      
      // 🔥 NUEVO (OBLIGATORIO)
      driversNotificados: {}
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