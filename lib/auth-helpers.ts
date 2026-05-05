import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function requireDriver(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("No token");

  const token = authHeader.replace("Bearer ", "");
  const decoded = await adminAuth.verifyIdToken(token);
  const uid = decoded.uid;

  const snap = await adminDb.ref("drivers/" + uid).once("value");

  if (!snap.exists()) {
    throw new Error("No autorizado (no es driver)");
  }

  return { uid, driver: snap.val() };
}