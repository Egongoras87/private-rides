"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginUser() {
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirm, setConfirm] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  }, []);

  const enviarCodigo = async () => {
    if (!telefono) {
      alert("Ingresa teléfono");
      return;
    }

    const appVerifier = (window as any).recaptchaVerifier;

    const confirmation = await signInWithPhoneNumber(
      auth,
      "+1" + telefono,
      appVerifier
    );

    setConfirm(confirmation);
    alert("Código enviado");
  };

  const verificarCodigo = async () => {
    if (!codigo || !confirm) {
      alert("Ingresa el código");
      return;
    }

    await confirm.confirm(codigo);

    alert("Login exitoso");

    router.push("/");
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Login Usuario</h2>

      <input
        placeholder="Teléfono"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />

      <br /><br />

      <button onClick={enviarCodigo}>
        Enviar código
      </button>

      <br /><br />

      <input
        placeholder="Código"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
      />

      <br /><br />

      <button onClick={verificarCodigo}>
        Verificar
      </button>

      <div id="recaptcha-container"></div>
    </div>
  );
}