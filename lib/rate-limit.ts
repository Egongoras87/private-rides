import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const MAX_SMS_DIA = 10;
const COOLDOWN_MS = 60 * 1000; // 60 segundos
const MAX_IP_MIN = 10;

export async function checkSmsLimit({
  phone,
  ip
}: {
  phone: string;
  ip: string;
}) {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  const ref = db.collection("sms_limits").doc(phone);
  const snap = await ref.get();

  let data = snap.exists ? snap.data() : null;

  // Reset diario
  if (!data || data.date !== today) {
    data = {
      date: today,
      count: 0,
      lastRequest: 0,
      ips: {}
    };
  }

  // 🔒 Límite diario
  if (data.count >= MAX_SMS_DIA) {
    throw new Error("Límite diario alcanzado");
  }

  // ⏱️ Cooldown
  if (now - data.lastRequest < COOLDOWN_MS) {
    throw new Error("Espera antes de solicitar otro código");
  }

  // 🌐 Control por IP
  const ipData = data.ips?.[ip] || { count: 0, lastMinute: now };

  if (now - ipData.lastMinute < 60 * 1000) {
    if (ipData.count >= MAX_IP_MIN) {
      throw new Error("Demasiadas solicitudes desde esta IP");
    }
    ipData.count++;
  } else {
    ipData.count = 1;
    ipData.lastMinute = now;
  }

  // Guardar cambios
  await ref.set(
    {
      date: today,
      count: data.count + 1,
      lastRequest: now,
      ips: {
        ...data.ips,
        [ip]: ipData
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return true;
}