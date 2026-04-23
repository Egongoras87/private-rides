import { NextResponse } from "next/server";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbytynhcWRnpE_CY1P9U2QWN_VQAA53DW2XKNk2DQiKP0RQ7gNt5mESzetbi_qqkLpKdYw/exec"; // termina en /exec

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      data = { status: "ok" };
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { success: false, message: "Server connection failed" },
      { status: 500 }
    );
  }
}