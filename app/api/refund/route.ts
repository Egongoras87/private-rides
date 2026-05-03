import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(req: Request) {
  const { paymentIntentId } = await req.json();

  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });

    return NextResponse.json({ success: true, refund });

  } catch (error) {
    console.error("REFUND ERROR:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}