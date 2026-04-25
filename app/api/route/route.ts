import { NextResponse } from "next/server";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNebie7p5_oVRUof3sSTyuo7KHJ_zfriWO58QDVIM_d93jHZ4e9DkvA_9TpUTEZOEtDA/exec";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // 🚀 enviar a Google Sheets
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    const text = await res.text();

    let json;

    try {
      json = JSON.parse(text);
    } catch {
      json = { success: true };
    }

    return NextResponse.json(json);

  } catch (error) {
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}