import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs"; // 🔥 importante en Vercel

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount } = body;

    // 🔒 validar monto
    if (!amount || amount < 50) {
      return NextResponse.json(
        { error: "Monto inválido" },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // 💥 asegurar entero
      currency: "usd",
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });

  } catch (error: any) {
    console.error("Stripe error:", error);

    return NextResponse.json(
      { error: error.message || "Error creando pago" },
      { status: 500 }
    );
  }
}