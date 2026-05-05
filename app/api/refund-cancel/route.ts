import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getDatabase } from "firebase-admin/database";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";

export async function POST(req: Request) {
  try {
    // 1. EXTRAER Y VALIDAR VARIABLES DE ENTORNO
    const {
      FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY,
      STRIPE_SECRET_KEY
    } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Faltan variables de entorno" }, { status: 500 });
    }

    // 2. ARREGLO DE LA PRIVATE KEY (Para Vercel)
    const formattedKey = FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, "\n")      // Convierte el texto "\n" en saltos de línea reales
      .replace(/\r/g, "")         // Elimina retornos de carro de Windows[cite: 1]
      .replace(/\n{2,}/g, "\n")   // Elimina saltos de línea dobles accidentales[cite: 1]
      .trim();                    // Limpia espacios al inicio y final[cite: 1]

    // 3. INICIALIZACIÓN SEGURA DE FIREBASE (Patrón Singleton)
    const adminApp = getApps().length > 0 
      ? getApp() 
      : initializeApp({
          credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: formattedKey,
          }),
          databaseURL: "https://private-rides-52e08-default-rtdb.firebaseio.com",
        });

    const db = getDatabase(adminApp);

    // 4. INICIALIZACIÓN DE STRIPE
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia" as any, 
    });

    // --- EL RESTO DE TU LÓGICA PERMANECE IGUAL ---
    const { viajeId } = await req.json();
    if (!viajeId) return NextResponse.json({ error: "Falta viajeId" }, { status: 400 });

    const viajeRef = db.ref("viajes/" + viajeId);
    const snap = await viajeRef.once("value");

    if (!snap.exists()) {
      return NextResponse.json({ error: "Viaje no existe" }, { status: 404 });
    }

    const v = snap.val();

    if (v.estado === "Finalizado") {
      return NextResponse.json({ error: "Viaje finalizado" }, { status: 400 });
    }

    if (v.metodoPago !== "stripe" || !v.paymentIntentId) {
      await viajeRef.update({
        estado: "Cancelado",
        canceladoPor: "user",
        refundPercent: 0
      });
      return NextResponse.json({ refunded: false });
    }

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

  } catch (err: any) {
    console.error("🔥 REFUND ERROR:", err);
    return NextResponse.json(
      { error: "Error procesando refund", details: err.message },
      { status: 500 }
    );
  }
}