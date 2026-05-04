"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged
} from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginUser() {
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirm, setConfirm] = useState<any>(null);

  const router = useRouter();

  // 🔐 REDIRECCIÓN AUTOMÁTICA
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const redirect = new URLSearchParams(window.location.search).get("redirect");
        router.push(redirect || "/");
      }
    });

    return () => unsub();
  }, []);

  // 🔐 RECAPTCHA (SOLO UNA VEZ)
  useEffect(() => {
    if (!(window as any).recaptchaVerifier) {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
  }, []);

  // 📩 ENVIAR CÓDIGO
  const enviarCodigo = async () => {
    if (!telefono || telefono.length < 8) {
      alert("Número inválido");
      return;
    }

    try {
      const appVerifier = (window as any).recaptchaVerifier;

      const confirmation = await signInWithPhoneNumber(
        auth,
        "+1" + telefono.replace(/\D/g, ""),
        appVerifier
      );

      setConfirm(confirmation);
      alert("Código enviado");
    } catch (err) {
      console.error(err);
      alert("Error enviando código");
    }
  };

  // ✅ VERIFICAR
  const verificarCodigo = async () => {
    if (!codigo || !confirm) {
      alert("Ingresa el código");
      return;
    }

    try {
      await confirm.confirm(codigo);

      const redirect = new URLSearchParams(window.location.search).get("redirect");

      router.push(redirect || "/");
    } catch (err) {
      console.error(err);
      alert("Código incorrecto");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0f0f0f",
        color: "#fff",
        fontFamily: "system-ui"
      }}
    >
      <div
        style={{
          width: 320,
          padding: 25,
          borderRadius: 16,
          background: "#1c1c1c",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
          textAlign: "center"
        }}
      >
        <h2 style={{ marginBottom: 20 }}>🚗 Login Usuario</h2>

        <input
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          style={inputStyle}
        />

        <button
  onClick={enviarCodigo}
  style={btnBlue}
  onMouseDown={press}
  onMouseUp={release}
  onMouseLeave={release}
>
  📩 Enviar código
</button>

        <div style={{ height: 15 }} />

        <input
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          style={inputStyle}
        />

        <button
  onClick={verificarCodigo}
  style={btnGreen}
  onMouseDown={press}
  onMouseUp={release}
  onMouseLeave={release}
>
  ✅ Verificar
</button>

        <p style={{ marginTop: 20, fontSize: 13, color: "#aaa" }}>
          Welcome to the Private Rides User App
        </p>

        <div id="recaptcha-container"></div>
      </div>
    </div>
  );
}

// 🎨 estilos
const inputStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  marginBottom: 12,
  background: "#2a2a2a",
  color: "#fff",
  outline: "none"
};

const btnBlue = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(145deg, #007bff, #0056b3)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 6px 0 rgba(0,0,0,0.4)",
  transition: "all 0.1s ease"
};

const btnGreen = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(145deg, #28a745, #1e7e34)",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
  boxShadow: "0 6px 0 rgba(0,0,0,0.4)",
  transition: "all 0.1s ease"
};
const press = (e: any) => {
  e.currentTarget.style.transform = "translateY(4px)";
  e.currentTarget.style.boxShadow = "0 2px 0 rgba(0,0,0,0.4)";
};

const release = (e: any) => {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 6px 0 rgba(0,0,0,0.4)";
};