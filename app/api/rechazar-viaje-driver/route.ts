import { NextResponse } from "next/server";
import Stripe from "stripe";
import { initializeApp, cert, getApps, getApp, App } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16" as any, 
});

// Configuración de Firebase Admin (Asegúrate de tener tus variables .env)
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

const adminApp = getApps().length > 0 
  ? getApp() 
  : initializeApp({
      credential: cert(firebaseConfig),
      databaseURL: "https://private-rides-52e08-default-rtdb.firebaseio.com",
    });

export async function POST(req: Request) {
  try {
    const { viajeId } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!viajeId || !authHeader) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);
    const driverId = decodedToken.uid;

    const db = getDatabase(adminApp);
    const viajeRef = db.ref(`viajes/${viajeId}`);
    const snapViaje = await viajeRef.once("value");

    if (!snapViaje.exists()) {
      return NextResponse.json({ error: "Viaje no encontrado" }, { status: 404 });
    }

    const v = snapViaje.val();

    // 1. ANOTAR QUE ESTE DRIVER ESPECÍFICO RECHAZÓ
    await viajeRef.child("rechazos").child(driverId).set({
      timestamp: Date.now(),
      motivo: "manual_reject"
    });

    // 2. VERIFICAR SI QUEDAN DRIVERS DISPONIBLES
    // Obtenemos todos los drivers que están online en Las Vegas
    const driversSnap = await db.ref("drivers").orderByChild("online").equalTo(true).once("value");
    const driversOnline = driversSnap.val() || {};
    const totalDriversOnline = Object.keys(driversOnline).length;

    // Obtenemos cuántos han rechazado ya este viaje
    const rechazosSnap = await viajeRef.child("rechazos").once("value");
    const totalRechazos = rechazosSnap.numChildren();

    // 3. LÓGICA DE CANCELACIÓN TOTAL
if (totalRechazos >= totalDriversOnline) {

  if (v.refundProcesado) return NextResponse.json({ success: true, alreadyRefunded: true });

  await viajeRef.update({ refundProcesado: true });

  let refund = null;

  if (v.metodoPago === "stripe" && v.paymentIntentId) {

    refund = await stripe.refunds.create({
      payment_intent: v.paymentIntentId,
      amount: Math.round(v.precio * 100)
    });
  }

  await viajeRef.update({
    estado: "Cancelado",
    estadoPago:
     refund
    ? "reembolsado"
    : v.estadoPago,
    canceladoPor: "no_drivers_available",
    refundId: refund?.id || null,
    refundAt: Date.now(),
    refundPercent: refund ? 1 : 0,
    finalizadoAt: Date.now()
  });
      return NextResponse.json({ success: true, message: "Viaje cancelado por falta de drivers" });
    }

    return NextResponse.json({ success: true, message: "Viaje ignorado para este driver" });

  } catch (error: any) {
    console.error("ERROR EN RECHAZAR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}