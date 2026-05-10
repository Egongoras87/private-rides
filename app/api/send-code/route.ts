import { NextRequest, NextResponse } from "next/server";
import { checkSmsLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // 🔒 VALIDACIÓN ANTI ABUSO
    await checkSmsLimit({ phone, ip });

    // 👉 Aquí llamas Firebase Auth
    // (desde frontend normalmente, pero puedes controlar flujo aquí)

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 429 }
    );
  }
}
